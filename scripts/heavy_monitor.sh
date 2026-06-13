#!/bin/bash
# Comprehensive Goblin health monitor. Emits ONE line only when something is
# wrong (silence = everything healthy), plus a positive line the first time a
# trade executes. Designed to be run under the Monitor tool or standalone.
cd /home/coder/Goblin
set -a; source config/trading.env; source config/.secrets.env 2>/dev/null; set +a
R() { redis-cli -h localhost -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --no-auth-warning "$@" 2>/dev/null; }
PG() { PGPASSWORD="$POSTGRES_PASSWORD" psql -h localhost -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "$1" 2>/dev/null; }

WORKER_FAILS=0
PREV_TRADES=$(R LLEN trade_history); PREV_TRADES=${PREV_TRADES:-0}
STALL_REF=""; STALL_COUNT=0
PREV_OPEN=-1; FE_TICK=0
LAST_P=""; LAST_PT=0   # dedup: don't re-spam an unchanged problem every cycle
EXPECTED_PAIRS=$(echo "$TRADING_PAIRS" | tr ',' '\n' | grep -c .)

while true; do
    P=""
    # 1. all 12 services
    for pe in market-data:8001 prediction:8002 signal:8003 risk:8004 executor:8005 \
              position:8006 feature-store:8007 sentiment:8008 trend:8009 \
              optimizer:8010 backtesting:8011 gateway:8080; do
        curl -sf -o /dev/null --max-time 5 "http://localhost:${pe##*:}/health" || P="$P ${pe%%:*}-DOWN"
    done
    # 2. signal listener heartbeat (prediction->signal pipeline alive)
    curl -s --max-time 5 http://localhost:8003/health 2>/dev/null | grep -q '"prediction_listener_ok": *true' || P="$P signal-listener-stale"
    # 3. executor must stay live
    curl -s --max-time 5 http://localhost:8005/health 2>/dev/null | grep -q '"mode": *"live"' || P="$P executor-not-live"
    # 4. continuous learner alive
    kill -0 "$(cat logs/continuous-learner.pid 2>/dev/null)" 2>/dev/null || P="$P CL-dead"
    # 5. CL training progressing (RL-complete count should rise; stall = stuck)
    CLN=$(grep -c "RL training complete" logs/continuous-learner.log 2>/dev/null); CLN=${CLN:-0}
    if [ "$CLN" = "$STALL_REF" ]; then STALL_COUNT=$((STALL_COUNT+1)); else STALL_REF=$CLN; STALL_COUNT=0; fi
    [ "$STALL_COUNT" -ge 8 ] && P="$P CL-training-stalled-16min"   # 8 * 2min
    # 6. candle freshness (1m must be < 6 min old)
    AGE=$(PG "SELECT EXTRACT(EPOCH FROM (NOW()-MAX(time)))/60 FROM candles WHERE timeframe='1m'")
    if [ -n "$AGE" ]; then awk "BEGIN{exit !($AGE>6)}" && P="$P candles-stale-${AGE%.*}min"; fi
    # 7. portfolio_state present + daily drawdown not near kill
    PS=$(R GET portfolio_state)
    if [ -z "$PS" ]; then P="$P portfolio_state-missing"; else
        DD=$(echo "$PS" | python3 -c "import sys,json;d=json.load(sys.stdin);sc=d.get('starting_capital',1) or 1;print(d.get('daily_pnl',0)/sc)" 2>/dev/null)
        [ -n "$DD" ] && awk "BEGIN{exit !($DD < -0.04)}" && P="$P daily-drawdown-near-kill($DD)"
    fi
    # 8. GPU present
    nvidia-smi >/dev/null 2>&1 || P="$P gpu-unavailable"
    # 9. background daemons
    pgrep -f goblin_backup_loop >/dev/null || P="$P backup-loop-dead"
    pgrep -f tunnel_kv_sync >/dev/null || P="$P kv-sync-dead"
    # 10. frontend data path (worker), tolerate one transient miss
    if curl -sf -o /dev/null --max-time 12 "https://goblin-api.goblin-anwar.workers.dev/health" 2>/dev/null; then WORKER_FAILS=0; else
        WORKER_FAILS=$((WORKER_FAILS+1)); [ "$WORKER_FAILS" -ge 2 ] && P="$P frontend-worker-down"; fi
    # 11. checkpoint freshness (a _latest model saved within 30 min => training is persisting)
    # 60-min threshold: the promotion gate legitimately refuses non-improving
    # variants for long stretches (so _latest is rightly stale); the training
    # stall check (#5) is the real CL-health signal.
    NEWEST=$(ls -t shared/models/*_latest.pt 2>/dev/null | head -1)
    if [ -n "$NEWEST" ]; then MAGE=$(( ($(date +%s) - $(stat -c %Y "$NEWEST")) / 60 )); [ "$MAGE" -gt 60 ] && P="$P checkpoints-stale-${MAGE}min"; fi

    # 12. market-data must keep up with all pairs (rate-limit / drop check)
    MDS=$(curl -s --max-time 5 http://localhost:8001/health 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin).get('symbols_total',0))" 2>/dev/null)
    if [ -n "$MDS" ] && [ "$MDS" -lt $((EXPECTED_PAIRS - 4)) ]; then P="$P market-data-only-$MDS/$EXPECTED_PAIRS-pairs"; fi

    # POSITIVE: first/new trade executed (the thing the user is waiting for)
    TR=$(R LLEN trade_history); TR=${TR:-0}
    if [ "$TR" -gt "$PREV_TRADES" ]; then
        echo "$(date '+%H:%M') ✅ TRADE EXECUTED — trade_history $PREV_TRADES -> $TR"
        PREV_TRADES=$TR
    fi
    # POSITIVE: position open/close state change + live exposure
    OPEN=$(R GET portfolio_state | python3 -c "import sys,json;print(int(json.load(sys.stdin).get('open_positions',0)))" 2>/dev/null); OPEN=${OPEN:-0}
    if [ "$OPEN" != "$PREV_OPEN" ] && [ "$PREV_OPEN" != "-1" ]; then
        POS=$(R HKEYS positions 2>/dev/null | tr '\n' ' ')
        echo "$(date '+%H:%M') 📈 POSITION CHANGE — open $PREV_OPEN -> $OPEN  [$POS]"
    fi
    PREV_OPEN=$OPEN

    # Periodic forward-edge snapshot (~every 30 min) so skill is always visible
    FE_TICK=$((FE_TICK+1))
    if [ $((FE_TICK % 15)) -eq 0 ]; then
        FE=$(/home/coder/Goblin/venv/bin/python3 /home/coder/Goblin/scripts/forward_edge.py 2>/dev/null | tail -1)
        [ -n "$FE" ] && echo "$(date '+%H:%M') 📊 forward-edge: $FE"
    fi

    # Emit a problem only when it's NEW/changed, or every 15 min if persistent,
    # or when it clears. Avoids spamming the same known issue every 2 minutes.
    NOW=$(date +%s)
    if [ -n "$P" ]; then
        if [ "$P" != "$LAST_P" ] || [ $((NOW - LAST_PT)) -ge 900 ]; then
            echo "$(date '+%H:%M') ⚠️ UNHEALTHY:$P"
            LAST_PT=$NOW
        fi
        LAST_P="$P"
    else
        [ -n "$LAST_P" ] && echo "$(date '+%H:%M') ✅ RECOVERED (was:$LAST_P)"
        LAST_P=""; LAST_PT=0
    fi
    sleep 120
done
