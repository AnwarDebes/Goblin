#!/bin/bash
# ============================================================
# Goblin Reset — Stop all services, wipe runtime data, KEEP best models
#
# Usage:
#   bash goblin_reset.sh          # interactive confirmation
#   bash goblin_reset.sh --yes    # skip confirmation
# ============================================================
set -euo pipefail

ROOT="/home/coder/Goblin"
LOGS="$ROOT/logs"
MODELS="$ROOT/shared/models"
ENV_FILE="$ROOT/config/trading.env"

# Load config
set -a
source "$ENV_FILE"
set +a
export REDIS_HOST="${REDIS_HOST:-localhost}"
export POSTGRES_HOST="${POSTGRES_HOST:-localhost}"

echo ""
echo "  ========================================"
echo "  GOBLIN RESET"
echo "  ========================================"
echo "  This will:"
echo "    1. Kill ALL Goblin processes"
echo "    2. Flush Redis (trading state)"
echo "    3. Truncate PostgreSQL tables"
echo "    4. Clear logs, caches, PID files"
echo "    5. Clean old timestamped models (keep best/latest)"
echo "    6. Re-seed \$${STARTING_CAPITAL} capital"
echo ""
echo "  PRESERVED: *_best.pt/json, *_latest.pt/json, *_metadata.json, registry.json"
echo "  ========================================"
echo ""

if [[ "${1:-}" != "--yes" && "${1:-}" != "-y" ]]; then
    read -p "  Type 'yes' to wipe everything and start fresh: " confirm
    if [[ "$confirm" != "yes" ]]; then
        echo "  Aborted."
        exit 0
    fi
fi

# -----------------------------------------------------------
# 1. KILL ALL PROCESSES (aggressive)
# -----------------------------------------------------------
echo ""
echo "  [1/7] Killing all Goblin processes..."

# Stop via PID files first
for pidfile in "$LOGS"/*.pid; do
    [ -f "$pidfile" ] || continue
    name=$(basename "$pidfile" .pid)
    pid=$(cat "$pidfile" 2>/dev/null || true)
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
        echo "    Killed $name (PID $pid)"
    fi
    rm -f "$pidfile"
done

# Kill ALL stragglers by pattern — leave nothing running
pkill -9 -f "uvicorn main:app" 2>/dev/null && echo "    Killed remaining uvicorn processes" || true
pkill -9 -f "continuous-learner/main.py" 2>/dev/null && echo "    Killed continuous learner" || true
pkill -9 -f "next start" 2>/dev/null && echo "    Killed Next.js processes" || true
pkill -9 -f "next-server" 2>/dev/null || true

# Wait for processes to die
sleep 2

# Verify all ports are free
STILL_RUNNING=0
for port in 8001 8002 8003 8004 8005 8006 8007 8008 8009 8010 8011 8080 3000; do
    if lsof -ti:$port >/dev/null 2>&1; then
        # Force kill anything on this port
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        echo "    Force-killed process on port $port"
        STILL_RUNNING=$((STILL_RUNNING + 1))
    fi
done
[ $STILL_RUNNING -gt 0 ] && sleep 1

echo "    All processes killed."

# -----------------------------------------------------------
# 2. FLUSH REDIS
# -----------------------------------------------------------
echo ""
echo "  [2/7] Flushing Redis..."

if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --no-auth-warning PING >/dev/null 2>&1; then
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --no-auth-warning FLUSHALL >/dev/null 2>&1
    echo "    Flushed all Redis data."

    # Re-seed portfolio state
    PORTFOLIO_JSON="{\"total_capital\":${STARTING_CAPITAL},\"available_capital\":${STARTING_CAPITAL},\"positions_value\":0,\"open_positions\":0,\"starting_capital\":${STARTING_CAPITAL},\"daily_pnl\":0}"
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --no-auth-warning \
        SET portfolio_state "$PORTFOLIO_JSON" >/dev/null 2>&1
    echo "    Seeded portfolio_state with \$${STARTING_CAPITAL}."
else
    echo "    [WARN] Redis not running — skip (will be set up on start)."
fi

# -----------------------------------------------------------
# 3. TRUNCATE POSTGRESQL
# -----------------------------------------------------------
echo ""
echo "  [3/7] Cleaning PostgreSQL..."

export PGPASSWORD="$POSTGRES_PASSWORD"
if psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1" >/dev/null 2>&1; then
    psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<SQL
        DO \$\$
        DECLARE t TEXT;
        BEGIN
            FOR t IN SELECT tablename FROM pg_tables
                     WHERE schemaname = 'public'
                       AND tablename IN ('trade_history','portfolio_snapshots','signals','orders','ml_predictions','ticks','candles','positions','sentiment_scores')
            LOOP
                EXECUTE 'TRUNCATE TABLE ' || quote_ident(t) || ' CASCADE';
            END LOOP;

            -- Re-seed portfolio snapshot if table exists
            IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='portfolio_snapshots') THEN
                EXECUTE format('INSERT INTO portfolio_snapshots (time, total_value, cash_balance, positions_value, daily_pnl) VALUES (NOW(), %s, %s, 0, 0)', $STARTING_CAPITAL, $STARTING_CAPITAL);
            END IF;
        END\$\$;
SQL
    echo "    Truncated all trading tables."
    echo "    Seeded initial portfolio snapshot."
else
    echo "    [WARN] PostgreSQL not running — skip (will be set up on start)."
fi
unset PGPASSWORD

# -----------------------------------------------------------
# 4. CLEAR LOGS AND CACHES
# -----------------------------------------------------------
echo ""
echo "  [4/7] Clearing logs and caches..."

mkdir -p "$LOGS"
for logfile in "$LOGS"/*.log; do
    [ -f "$logfile" ] && > "$logfile"
done
rm -f "$LOGS"/*.pid
echo "    Cleared all log files and PID files."

# Python caches
CLEANED=0
while IFS= read -r -d '' dir; do
    rm -rf "$dir" 2>/dev/null || true
    CLEANED=$((CLEANED + 1))
done < <(find "$ROOT/services" "$ROOT/scripts" -type d -name "__pycache__" -print0 2>/dev/null)
echo "    Removed $CLEANED __pycache__ directories."

# -----------------------------------------------------------
# 5. CLEAN OLD MODELS — KEEP BEST & LATEST
# -----------------------------------------------------------
echo ""
echo "  [5/7] Cleaning old models (keeping best & latest)..."

# Files to KEEP:
#   *_best.pt, *_latest.pt, *_metadata.json, registry.json, *.lock
# Files to REMOVE:
#   Timestamped copies like tcn_20260326_015110.pt, xgboost_20260326_*.json

REMOVED_MODELS=0
KEPT_MODELS=0

# Remove timestamped .pt files (not best/latest)
for f in "$MODELS"/*.pt; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    if [[ "$base" == *_best.pt ]] || [[ "$base" == *_latest.pt ]]; then
        KEPT_MODELS=$((KEPT_MODELS + 1))
    else
        rm -f "$f"
        REMOVED_MODELS=$((REMOVED_MODELS + 1))
    fi
done

# Remove timestamped .json files (keep best/latest/metadata/registry)
for f in "$MODELS"/*.json; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    if [[ "$base" == *_metadata.json ]] || [[ "$base" == "registry.json" ]] || [[ "$base" == *_best.json ]] || [[ "$base" == *_latest.json ]]; then
        KEPT_MODELS=$((KEPT_MODELS + 1))
    else
        rm -f "$f"
        REMOVED_MODELS=$((REMOVED_MODELS + 1))
    fi
done

# Remove tmp and lock files
find "$MODELS" -name "*.tmp" -delete 2>/dev/null || true
rm -f "$MODELS/.cl_singleton.lock"

echo "    Removed $REMOVED_MODELS old timestamped model files."
echo "    Kept $KEPT_MODELS best/latest model files."

# Show what's preserved
echo "    Preserved models:"
for f in "$MODELS"/*_best.pt "$MODELS"/*_latest.pt "$MODELS"/*_best.json "$MODELS"/*_latest.json; do
    [ -f "$f" ] && printf "      %s (%s)\n" "$(basename "$f")" "$(du -sh "$f" | cut -f1)"
done

# -----------------------------------------------------------
# 6. VERIFY CLEAN STATE
# -----------------------------------------------------------
echo ""
echo "  [6/6] Verifying clean state..."

# Check Redis
REDIS_KEYS=0
if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --no-auth-warning PING >/dev/null 2>&1; then
    REDIS_KEYS=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --no-auth-warning DBSIZE 2>/dev/null | grep -oP '\d+' || echo "0")
fi
echo "    Redis keys: $REDIS_KEYS (expected: 1 — portfolio_state)"

# Check all ports free
RUNNING=0
for p in 8001 8002 8003 8004 8005 8006 8007 8008 8009 8010 8011 8080 3000; do
    if curl -sf -o /dev/null --max-time 1 "http://localhost:$p/health" 2>/dev/null; then
        RUNNING=$((RUNNING + 1))
        echo "    [WARN] Port $p still responding!"
    fi
done
echo "    Services still responding: $RUNNING (expected: 0)"

# Check GPU is free
GPU_PROCS=$(nvidia-smi --query-compute-apps=pid --format=csv,noheader 2>/dev/null | wc -l)
echo "    GPU processes: $GPU_PROCS (expected: 0)"

# Model summary
MODEL_COUNT=$(find "$MODELS" \( -name "*_best.pt" -o -name "*_latest.pt" -o -name "*_best.json" -o -name "*_latest.json" \) 2>/dev/null | wc -l)
echo "    Best/latest models preserved: $MODEL_COUNT"

echo ""
echo "  ========================================"
echo "  RESET COMPLETE"
echo "  ========================================"
echo "  Capital:  \$${STARTING_CAPITAL}"
echo "  Models:   $MODEL_COUNT best/latest preserved"
echo "  State:    All trading data wiped"
echo ""
echo "  To start: bash $ROOT/goblin_start.sh"
echo "  ========================================"
echo ""
