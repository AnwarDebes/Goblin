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
    NEWEST=$(ls -t shared/models/*_latest.pt 2>/dev/null | head -1)
    if [ -n "$NEWEST" ]; then MAGE=$(( ($(date +%s) - $(stat -c %Y "$NEWEST")) / 60 )); [ "$MAGE" -gt 30 ] && P="$P checkpoints-stale-${MAGE}min"; fi

    # POSITIVE: first/new trade executed (the thing the user is waiting for)
    TR=$(R LLEN trade_history); TR=${TR:-0}
    if [ "$TR" -gt "$PREV_TRADES" ]; then
        echo "$(date '+%H:%M') ✅ TRADE EXECUTED — trade_history $PREV_TRADES -> $TR"
        PREV_TRADES=$TR
    fi

    [ -n "$P" ] && echo "$(date '+%H:%M') ⚠️ UNHEALTHY:$P"
    sleep 120
done
