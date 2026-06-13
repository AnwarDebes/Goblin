#!/bin/bash
# Comprehensive Goblin health monitor. Emits a line only when something is wrong
# (silence = healthy, deduped), a full report on every trade, position changes,
# and a periodic ALL-SYSTEMS heartbeat + forward-edge snapshot. Covers services,
# the trade pipeline, system resources, data stores, and risk/regression checks.
cd /home/coder/Goblin
set -a; source config/trading.env; source config/.secrets.env 2>/dev/null; set +a
R() { redis-cli -h localhost -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --no-auth-warning "$@" 2>/dev/null; }
PG() { PGPASSWORD="$POSTGRES_PASSWORD" psql -h localhost -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "$1" 2>/dev/null; }

WORKER_FAILS=0
PREV_TRADES=$(R LLEN trade_history); PREV_TRADES=${PREV_TRADES:-0}
PREV_OPEN=-1; FE_TICK=0
LAST_P=""; LAST_PT=0
ERR_REF=0
EXPECTED_PAIRS=$(echo "$TRADING_PAIRS" | tr ',' '\n' | grep -c .)

while true; do
    P=""; UP=0
    # 1. all 12 services
    for pe in market-data:8001 prediction:8002 signal:8003 risk:8004 executor:8005 \
              position:8006 feature-store:8007 sentiment:8008 trend:8009 \
              optimizer:8010 backtesting:8011 gateway:8080; do
        if curl -sf -o /dev/null --max-time 5 "http://localhost:${pe##*:}/health"; then UP=$((UP+1)); else P="$P ${pe%%:*}-DOWN"; fi
    done
    # 2. signal listener heartbeat (prediction->signal pipeline alive)
    curl -s --max-time 5 http://localhost:8003/health 2>/dev/null | grep -q '"prediction_listener_ok": *true' || P="$P signal-listener-stale"
    # 3. executor must stay live
    curl -s --max-time 5 http://localhost:8005/health 2>/dev/null | grep -q '"mode": *"live"' || P="$P executor-not-live"
    # 4. continuous learner alive + producing output
    kill -0 "$(cat logs/continuous-learner.pid 2>/dev/null)" 2>/dev/null || P="$P CL-dead"
    CL_LOG_AGE=$(( ($(date +%s) - $(stat -c %Y logs/continuous-learner.log 2>/dev/null || echo "$(date +%s)")) / 60 ))
    [ "$CL_LOG_AGE" -gt 45 ] && P="$P CL-no-output-${CL_LOG_AGE}min"
    # 5. candle freshness (1m must be < 6 min old)
    AGE=$(PG "SELECT EXTRACT(EPOCH FROM (NOW()-MAX(time)))/60 FROM candles WHERE timeframe='1m'")
    if [ -n "$AGE" ]; then awk "BEGIN{exit !($AGE>6)}" && P="$P candles-stale-${AGE%.*}min"; fi
    # 6. portfolio_state present + daily drawdown not near kill
    PS=$(R GET portfolio_state)
    if [ -z "$PS" ]; then P="$P portfolio_state-missing"; else
        DD=$(echo "$PS" | python3 -c "import sys,json;d=json.load(sys.stdin);sc=d.get('starting_capital',1) or 1;print(d.get('daily_pnl',0)/sc)" 2>/dev/null)
        [ -n "$DD" ] && awk "BEGIN{exit !($DD < -0.04)}" && P="$P daily-drawdown-near-kill($DD)"
    fi
    # 7. background daemons + GPU + data stores
    nvidia-smi >/dev/null 2>&1 || P="$P gpu-unavailable"
    pgrep -f goblin_backup_loop >/dev/null || P="$P backup-loop-dead"
    pgrep -f tunnel_kv_sync >/dev/null || P="$P kv-sync-dead"
    pgrep -f "cloudflared tunnel" >/dev/null || P="$P cloudflared-down"
    [ "$(R PING)" = "PONG" ] || P="$P redis-unreachable"
    [ "$(PG 'SELECT 1')" = "1" ] || P="$P postgres-unreachable"
    # 8. frontend data path (worker), tolerate one transient miss
    if curl -sf -o /dev/null --max-time 12 "https://goblin-api.goblin-anwar.workers.dev/health" 2>/dev/null; then WORKER_FAILS=0; else
        WORKER_FAILS=$((WORKER_FAILS+1)); [ "$WORKER_FAILS" -ge 2 ] && P="$P frontend-worker-down"; fi
    # 9. market-data keeping up with all pairs
    MDS=$(curl -s --max-time 5 http://localhost:8001/health 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin).get('symbols_total',0))" 2>/dev/null)
    if [ -n "$MDS" ] && [ "$MDS" -lt $((EXPECTED_PAIRS - 4)) ]; then P="$P market-data-only-$MDS/$EXPECTED_PAIRS-pairs"; fi
    # 10. system resources: disk (fills => total failure), RAM, GPU VRAM
    HFREE=$(df -BG --output=avail /home/coder 2>/dev/null | tail -1 | tr -dc '0-9'); [ -n "$HFREE" ] && [ "$HFREE" -lt 5 ] && P="$P home-disk-low-${HFREE}G"
    RFREE=$(df -BG --output=avail / 2>/dev/null | tail -1 | tr -dc '0-9'); [ -n "$RFREE" ] && [ "$RFREE" -lt 3 ] && P="$P root-disk-low-${RFREE}G"
    MFREE=$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo 2>/dev/null); [ -n "$MFREE" ] && [ "$MFREE" -lt 400 ] && P="$P ram-low-${MFREE}MB"
    GMEM=$(nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits 2>/dev/null | head -1)
    if [ -n "$GMEM" ]; then GU=$(echo "${GMEM%,*}"|tr -dc 0-9); GT=$(echo "${GMEM#*,}"|tr -dc 0-9)
        [ -n "$GT" ] && [ "$GT" -gt 0 ] && [ "$((GU*100/GT))" -ge 98 ] && P="$P gpu-vram-${GU}/${GT}MB"; fi
    # 11. risk/regression: stuck 'closing' positions (the dust bug) + deep-underwater open positions
    STUCK=$(R HVALS positions | python3 -c "import sys,json;print(sum(1 for l in sys.stdin if l.strip() and json.loads(l).get('status')=='closing'))" 2>/dev/null)
    [ -n "$STUCK" ] && [ "$STUCK" -gt 0 ] && P="$P stuck-closing-$STUCK"
    DEEP=$(R HVALS positions | python3 -c "
import sys,json
for l in sys.stdin:
    if not l.strip(): continue
    p=json.loads(l)
    if p.get('status')=='open':
        e=p.get('entry_price',0) or 0; c=p.get('current_price',0) or 0
        if e>0 and (c-e)/e < -0.08: print(p.get('symbol','?')); break" 2>/dev/null)
    [ -n "$DEEP" ] && P="$P position-deep-loss-$DEEP"
    # 12. new tracebacks in trade-critical service logs (up-but-erroring)
    ERRTOT=$(grep -c Traceback logs/signal.log logs/risk.log logs/executor.log logs/position.log logs/prediction.log logs/continuous-learner.log logs/market-data.log logs/feature-store.log 2>/dev/null | awk -F: '{s+=$2}END{print s+0}')
    if [ "$ERR_REF" -gt 0 ] && [ "$ERRTOT" -gt "$ERR_REF" ]; then P="$P new-tracebacks-$((ERRTOT-ERR_REF))"; fi
    ERR_REF=$ERRTOT

    # POSITIVE: every new closed trade — full detail + running stats
    TR=$(R LLEN trade_history); TR=${TR:-0}
    if [ "$TR" -gt "$PREV_TRADES" ]; then
        /home/coder/Goblin/venv/bin/python3 /home/coder/Goblin/scripts/trade_report.py "$(date '+%H:%M')" "$PREV_TRADES" 2>/dev/null
        PREV_TRADES=$TR
    fi
    # POSITIVE: position open/close state change + live exposure
    OPEN=$(echo "$PS" | python3 -c "import sys,json;print(int(json.load(sys.stdin).get('open_positions',0)))" 2>/dev/null); OPEN=${OPEN:-0}
    if [ "$OPEN" != "$PREV_OPEN" ] && [ "$PREV_OPEN" != "-1" ]; then
        POS=$(R HKEYS positions 2>/dev/null | tr '\n' ' ')
        echo "$(date '+%H:%M') 📈 POSITION CHANGE — open $PREV_OPEN -> $OPEN  [$POS]"
    fi
    PREV_OPEN=$OPEN

    FE_TICK=$((FE_TICK+1))
    # Periodic forward-edge snapshot (~every 30 min)
    if [ $((FE_TICK % 15)) -eq 0 ]; then
        FE=$(/home/coder/Goblin/venv/bin/python3 /home/coder/Goblin/scripts/forward_edge.py 2>/dev/null | tail -1)
        [ -n "$FE" ] && echo "$(date '+%H:%M') 📊 forward-edge: $FE"
    fi
    # Periodic ALL-SYSTEMS heartbeat (~every 30 min, offset) — positive confirmation
    if [ $((FE_TICK % 15)) -eq 7 ]; then
        CAP=$(echo "$PS" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f\"\${d.get('total_capital',0):.4f} pnl \${d.get('lifetime_pnl',0):+.4f}\")" 2>/dev/null)
        STATS=$(/home/coder/Goblin/venv/bin/python3 scripts/trade_report.py "" 0 2>/dev/null | tail -1 | sed 's/.*RUNNING/trades/')
        echo "$(date '+%H:%M') ✅ ALL-SYSTEMS: $UP/12 svc | cap $CAP | $STATS | pairs ${MDS:-?}/$EXPECTED_PAIRS | disk ${HFREE}G | ram ${MFREE}MB | gpu ${GU:-?}/${GT:-?}MB | open $OPEN"
    fi

    # Dedup: emit a problem only when new/changed, every 15 min if persistent, or on clear.
    NOW=$(date +%s)
    if [ -n "$P" ]; then
        if [ "$P" != "$LAST_P" ] || [ $((NOW - LAST_PT)) -ge 900 ]; then
            echo "$(date '+%H:%M') ⚠️ UNHEALTHY:$P"; LAST_PT=$NOW
        fi
        LAST_P="$P"
    else
        [ -n "$LAST_P" ] && echo "$(date '+%H:%M') ✅ RECOVERED (was:$LAST_P)"
        LAST_P=""; LAST_PT=0
    fi
    sleep 120
done
