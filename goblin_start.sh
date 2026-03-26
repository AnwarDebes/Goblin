#!/bin/bash
# ============================================================
# Goblin Start — Full system bootstrap from zero to running
#
# 1. Install PostgreSQL+TimescaleDB, Redis, Python dependencies
# 2. Kill old processes and reset for clean state
# 3. Start all services and verify health
# 4. Verify models use best/latest and CL is working
# 5. Verify GPU is fully working for training
#
# Usage:
#   bash goblin_start.sh              # full start
#   bash goblin_start.sh --no-dash    # skip dashboard
# ============================================================
set -euo pipefail

ROOT="/home/coder/Goblin"
LOGS="$ROOT/logs"
MODELS="$ROOT/shared/models"
ENV_FILE="$ROOT/config/trading.env"
SECRETS_FILE="$ROOT/config/.secrets.env"
SKIP_DASHBOARD=false

if [[ "${1:-}" == "--no-dash" ]]; then
    SKIP_DASHBOARD=true
fi

# Load config
set -a
source "$ENV_FILE"
[ -f "$SECRETS_FILE" ] && source "$SECRETS_FILE"
set +a
export REDIS_HOST="${REDIS_HOST:-localhost}"
export POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
export FEATURE_STORE_URL=http://localhost:8007
export MARKET_DATA_URL=http://localhost:8001
export PREDICTION_URL=http://localhost:8002
export EXECUTOR_URL=http://localhost:8005
export POSITION_URL=http://localhost:8006
export SIGNAL_URL=http://localhost:8003
export RISK_URL=http://localhost:8004
export API_GATEWAY_URL=http://localhost:8080

mkdir -p "$LOGS"

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║           GOBLIN FULL START              ║"
echo "  ╚══════════════════════════════════════════╝"
echo "  Mode:    $TRADING_MODE"
echo "  Capital: \$${STARTING_CAPITAL}"
echo ""

# ============================================================
# PHASE 0: Kill any old processes for clean slate
# ============================================================
echo "  [PHASE 0] Killing old processes..."

# Kill via PID files
for pidfile in "$LOGS"/*.pid; do
    [ -f "$pidfile" ] || continue
    pid=$(cat "$pidfile" 2>/dev/null || true)
    [ -n "$pid" ] && kill -9 "$pid" 2>/dev/null || true
    rm -f "$pidfile"
done

# Kill by pattern
pkill -9 -f "uvicorn main:app" 2>/dev/null || true
pkill -9 -f "continuous-learner/main.py" 2>/dev/null || true
pkill -9 -f "next start" 2>/dev/null || true
pkill -9 -f "next-server" 2>/dev/null || true
pkill -9 -f "cloudflared.*tunnel" 2>/dev/null || true

# Force-kill anything on our ports
for port in 8001 8002 8003 8004 8005 8006 8007 8008 8009 8010 8011 8080 3000; do
    lsof -ti:$port 2>/dev/null | xargs kill -9 2>/dev/null || true
done
sleep 2
echo "    Old processes cleared."

# ============================================================
# PHASE 1: Install infrastructure (PostgreSQL+TimescaleDB, Redis, Python)
# ============================================================
echo ""
echo "  [PHASE 1] Installing infrastructure..."

# --- Python 3 ---
if ! command -v python3 &>/dev/null; then
    echo "    Installing Python 3..."
    sudo apt-get update -qq
    sudo apt-get install -y -qq python3 python3-pip python3-venv python3-dev > /dev/null 2>&1
    echo "    Python 3 installed: $(python3 --version)"
else
    echo "    Python 3 ........... $(python3 --version 2>&1 | head -1)"
fi

# --- Redis ---
if ! command -v redis-server &>/dev/null; then
    echo "    Installing Redis..."
    sudo apt-get install -y -qq redis-server > /dev/null 2>&1
fi
if ! redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --no-auth-warning PING >/dev/null 2>&1; then
    echo "    Configuring Redis..."
    # Start Redis if not running at all
    if ! redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" PING >/dev/null 2>&1; then
        sudo service redis-server start 2>/dev/null || sudo redis-server --daemonize yes --requirepass "$REDIS_PASSWORD" --appendonly yes
        sleep 1
    fi
    # Set password via CONFIG SET on running instance
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" CONFIG SET requirepass "$REDIS_PASSWORD" >/dev/null 2>&1 || true
    # Persist to config file for future restarts
    if [ -f /etc/redis/redis.conf ]; then
        if grep -q "^requirepass " /etc/redis/redis.conf 2>/dev/null; then
            sudo sed -i "s/^requirepass .*/requirepass $REDIS_PASSWORD/" /etc/redis/redis.conf 2>/dev/null || true
        else
            echo "requirepass $REDIS_PASSWORD" | sudo tee -a /etc/redis/redis.conf >/dev/null 2>&1 || true
        fi
    fi
    mkdir -p /home/coder/Goblin/shared/redis-data
fi
if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --no-auth-warning PING >/dev/null 2>&1; then
    echo "    Redis .............. OK"
else
    echo "    [FAIL] Cannot connect to Redis!"
    exit 1
fi

# --- PostgreSQL + TimescaleDB ---
if ! command -v psql &>/dev/null; then
    echo "    Installing PostgreSQL..."
    sudo apt-get install -y -qq postgresql postgresql-contrib > /dev/null 2>&1
fi
if ! sudo service postgresql status >/dev/null 2>&1; then
    echo "    Starting PostgreSQL..."
    sudo service postgresql start 2>/dev/null || true
    sleep 2
fi

# Create user and database if needed
export PGPASSWORD="$POSTGRES_PASSWORD"
if ! psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1" >/dev/null 2>&1; then
    echo "    Setting up database..."
    sudo -u postgres psql -c "CREATE USER $POSTGRES_USER WITH PASSWORD '$POSTGRES_PASSWORD';" 2>/dev/null || true
    sudo -u postgres psql -c "CREATE DATABASE $POSTGRES_DB OWNER $POSTGRES_USER;" 2>/dev/null || true
    sudo -u postgres psql -c "ALTER USER $POSTGRES_USER CREATEDB;" 2>/dev/null || true
fi

# Install TimescaleDB
if ! psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1" >/dev/null 2>&1; then
    echo "    [FAIL] Cannot connect to PostgreSQL!"
    exit 1
fi

PG_VERSION=$(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SHOW server_version_num" 2>/dev/null | head -1 | cut -c1-2)
HAS_TIMESCALE=$(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT count(*) FROM pg_available_extensions WHERE name='timescaledb'" 2>/dev/null || echo "0")

if [ "$HAS_TIMESCALE" = "0" ]; then
    echo "    Installing TimescaleDB for PostgreSQL ${PG_VERSION}..."
    DISTRO=$(grep VERSION_CODENAME /etc/os-release 2>/dev/null | cut -d= -f2 || echo "noble")

    # Add repo with proper GPG key
    sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys E7391C94080429FF >/dev/null 2>&1
    sudo apt-key export 080429FF 2>/dev/null | sudo gpg --dearmor -o /usr/share/keyrings/timescaledb.gpg --yes 2>/dev/null
    echo "deb [signed-by=/usr/share/keyrings/timescaledb.gpg] https://packagecloud.io/timescale/timescaledb/ubuntu/ ${DISTRO} main" | sudo tee /etc/apt/sources.list.d/timescaledb.list >/dev/null
    sudo apt-get update -qq 2>/dev/null

    sudo apt-get install -y -qq "timescaledb-2-postgresql-${PG_VERSION}" 2>&1 | tail -3
    if [ $? -ne 0 ]; then
        echo "    [FAIL] TimescaleDB installation failed!"
        exit 1
    fi
fi

# Ensure shared_preload_libraries includes timescaledb
PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"
if ! grep -q "^shared_preload_libraries.*timescaledb" "$PG_CONF" 2>/dev/null; then
    echo "    Configuring TimescaleDB preload..."
    sudo sed -i "s/^#*shared_preload_libraries.*/shared_preload_libraries = 'timescaledb'/" "$PG_CONF" 2>/dev/null
    sudo service postgresql restart 2>/dev/null
    sleep 2
fi

# Create extension and init schema
echo "    Initializing database schema..."
psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE EXTENSION IF NOT EXISTS timescaledb;" >/dev/null 2>&1
psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$ROOT/config/init-db.sql" >/dev/null 2>&1 || true
echo "    PostgreSQL+TimescaleDB ... OK"
unset PGPASSWORD

# --- Python Virtual Environment + Dependencies ---
echo "    Setting up Python environment..."
VENV="$ROOT/venv"
if [ ! -f "$VENV/bin/python3" ]; then
    echo "    Creating virtual environment..."
    rm -rf "$VENV"
    python3 -m venv "$VENV"
fi
source "$VENV/bin/activate"

# Install all service requirements
echo "    Installing Python dependencies (this may take a few minutes)..."
pip install --upgrade pip setuptools wheel -q 2>/dev/null

# Install PyTorch with CUDA first (GPU support)
if ! python3 -c "import torch; assert torch.cuda.is_available()" 2>/dev/null; then
    echo "    Installing PyTorch with CUDA support..."
    pip install torch==2.6.0 --index-url https://download.pytorch.org/whl/cu124 -q 2>&1 | tail -1 || \
    pip install torch==2.6.0 -q 2>&1 | tail -1
fi

# Collect all unique requirements
TMPREQ=$(mktemp)
for reqfile in "$ROOT"/services/*/requirements.txt; do
    [ -f "$reqfile" ] && cat "$reqfile" >> "$TMPREQ"
done
sort -u "$TMPREQ" | grep -v "^torch==" > "${TMPREQ}.sorted"  # skip torch, already installed
pip install -r "${TMPREQ}.sorted" -q 2>&1 | tail -3 || true
rm -f "$TMPREQ" "${TMPREQ}.sorted"

echo "    Python environment .... OK"

# Verify key packages
python3 -c "import torch, xgboost, fastapi, redis, asyncpg; print(f'    torch={torch.__version__} CUDA={torch.cuda.is_available()}')" 2>/dev/null || \
echo "    [WARN] Some Python packages may be missing"

# ============================================================
# PHASE 2: Clean state (reset trading data, keep models)
# ============================================================
echo ""
echo "  [PHASE 2] Resetting trading state (keeping best models)..."

# Flush Redis and re-seed
export PGPASSWORD="$POSTGRES_PASSWORD"
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --no-auth-warning FLUSHALL >/dev/null 2>&1
PORTFOLIO_JSON="{\"total_capital\":${STARTING_CAPITAL},\"available_capital\":${STARTING_CAPITAL},\"positions_value\":0,\"open_positions\":0,\"starting_capital\":${STARTING_CAPITAL},\"daily_pnl\":0}"
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --no-auth-warning SET portfolio_state "$PORTFOLIO_JSON" >/dev/null 2>&1
echo "    Redis flushed, portfolio seeded with \$${STARTING_CAPITAL}"

# Truncate DB tables
psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
    DO \$\$
    DECLARE t TEXT;
    BEGIN
        FOR t IN SELECT tablename FROM pg_tables
                 WHERE schemaname = 'public'
                   AND tablename IN ('trade_history','portfolio_snapshots','signals','orders','ml_predictions','ticks','candles','positions','sentiment_scores')
        LOOP
            EXECUTE 'TRUNCATE TABLE ' || quote_ident(t) || ' CASCADE';
        END LOOP;
    END\$\$;
    INSERT INTO portfolio_snapshots (time, total_value, cash_balance, positions_value, daily_pnl)
    VALUES (NOW(), $STARTING_CAPITAL, $STARTING_CAPITAL, 0, 0);
" >/dev/null 2>&1
unset PGPASSWORD
echo "    PostgreSQL tables truncated"

# Clear logs
for logfile in "$LOGS"/*.log; do
    [ -f "$logfile" ] && > "$logfile"
done
rm -f "$LOGS"/*.pid
echo "    Logs cleared"

# ============================================================
# PHASE 3: Start all services in dependency order
# ============================================================
echo ""
echo "  [PHASE 3] Starting services..."

# Ensure venv is active
source "$VENV/bin/activate"

start_service() {
    local name=$1
    local dir=$2
    local port=$3
    local wait=${4:-3}

    printf "    Starting %-22s port %s ..." "$name" "$port"
    cd "$dir"
    python3 -m uvicorn main:app --host 0.0.0.0 --port "$port" > "$LOGS/$name.log" 2>&1 &
    echo $! > "$LOGS/$name.pid"
    cd - > /dev/null

    local attempts=0
    while [ $attempts -lt $((wait * 5)) ]; do
        if curl -s -o /dev/null --max-time 1 "http://localhost:$port/health" 2>/dev/null; then
            echo " UP"
            return 0
        fi
        sleep 0.2
        attempts=$((attempts + 1))
    done

    local pid=$(cat "$LOGS/$name.pid" 2>/dev/null)
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        echo " started (health pending)"
    else
        echo " FAILED — check $LOGS/$name.log"
    fi
}

echo ""
echo "    --- Data Layer ---"
start_service "market-data"         "$ROOT/services/market-data"         8001 5
start_service "feature-store"       "$ROOT/services/feature-store"       8007 4

echo ""
echo "    --- Risk & Execution ---"
start_service "risk"                "$ROOT/services/risk"                8004 3
start_service "portfolio-optimizer" "$ROOT/services/portfolio-optimizer"  8010 3
start_service "executor"            "$ROOT/services/executor"            8005 3
start_service "position"            "$ROOT/services/position"            8006 3

echo ""
echo "    --- Intelligence ---"
start_service "prediction"          "$ROOT/services/prediction"          8002 8
start_service "signal"              "$ROOT/services/signal"              8003 4
start_service "sentiment-analysis"  "$ROOT/services/sentiment-analysis"  8008 4
start_service "trend-analysis"      "$ROOT/services/trend-analysis"      8009 4

echo ""
echo "    --- Analytics & API ---"
start_service "backtesting"         "$ROOT/services/backtesting"         8011 3
start_service "api-gateway"         "$ROOT/services/api-gateway"         8080 4

echo ""
echo "    --- Continuous Learner (GPU Training) ---"
rm -f "$MODELS/.cl_singleton.lock"
printf "    Starting %-22s background ..." "continuous-learner"
cd "$ROOT/services/continuous-learner"
python3 main.py > "$LOGS/continuous-learner.log" 2>&1 &
echo $! > "$LOGS/continuous-learner.pid"
cd - > /dev/null
CL_PID=$(cat "$LOGS/continuous-learner.pid")
echo " PID $CL_PID"

# Dashboard
if [ "$SKIP_DASHBOARD" = false ]; then
    echo ""
    echo "    --- Dashboard ---"
    printf "    Starting %-22s port %s ..." "dashboard" "3000"
    if ! command -v node &>/dev/null; then
        NODE_BIN=$(find /tmp/code-server -name "node" -type f 2>/dev/null | head -1)
        if [ -n "$NODE_BIN" ]; then
            mkdir -p /home/coder/.local/bin
            ln -sf "$NODE_BIN" /home/coder/.local/bin/node
            export PATH="/home/coder/.local/bin:$PATH"
        fi
    fi
    cd "$ROOT/dashboard"
    ./node_modules/.bin/next start -p 3000 > "$LOGS/dashboard.log" 2>&1 &
    echo $! > "$LOGS/dashboard.pid"
    cd - > /dev/null

    for i in $(seq 1 15); do
        if curl -s -o /dev/null --max-time 1 "http://localhost:3000" 2>/dev/null; then
            echo " UP"
            break
        fi
        sleep 0.5
    done
    [ $i -ge 15 ] && echo " started (loading...)"
fi

# ============================================================
# PHASE 4: Verify models are using best/latest
# ============================================================
echo ""
echo "  [PHASE 4] Verifying models..."

echo ""
echo "    --- Model Files ---"
for variant in "" "_micro" "_short" "_medium" "_long"; do
    BEST="$MODELS/tcn${variant}_best.pt"
    LATEST="$MODELS/tcn${variant}_latest.pt"
    if [ -f "$BEST" ]; then
        BEST_SIZE=$(du -sh "$BEST" | cut -f1)
        BEST_DATE=$(stat -c %y "$BEST" 2>/dev/null | cut -d. -f1)
        printf "    tcn%-8s best:   %s  (%s)\n" "$variant" "$BEST_SIZE" "$BEST_DATE"
    fi
    if [ -f "$LATEST" ]; then
        LATEST_SIZE=$(du -sh "$LATEST" | cut -f1)
        LATEST_DATE=$(stat -c %y "$LATEST" 2>/dev/null | cut -d. -f1)
        printf "    tcn%-8s latest: %s  (%s)\n" "$variant" "$LATEST_SIZE" "$LATEST_DATE"
    fi
done

# Check prediction service loaded models
echo ""
echo "    --- Prediction Service Model Check ---"
sleep 3  # Give prediction service time to load models
PRED_HEALTH=$(curl -sf --max-time 5 http://localhost:8002/health 2>/dev/null || echo "{}")
if echo "$PRED_HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'    Status: {d.get(\"status\",\"unknown\")}')" 2>/dev/null; then
    true
else
    echo "    Prediction service health: checking..."
fi

# ============================================================
# PHASE 5: Verify GPU and training
# ============================================================
echo ""
echo "  [PHASE 5] Verifying GPU & training..."

echo ""
echo "    --- GPU Status ---"
if nvidia-smi >/dev/null 2>&1; then
    GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)
    GPU_MEM=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader 2>/dev/null | head -1)
    GPU_DRIVER=$(nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>/dev/null | head -1)
    CUDA_VER=$(nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>/dev/null | head -1)
    echo "    GPU:    $GPU_NAME"
    echo "    Memory: $GPU_MEM"
    echo "    Driver: $GPU_DRIVER"

    # Verify PyTorch CUDA
    python3 -c "
import torch
print(f'    PyTorch: {torch.__version__}')
print(f'    CUDA available: {torch.cuda.is_available()}')
if torch.cuda.is_available():
    print(f'    CUDA device: {torch.cuda.get_device_name(0)}')
    print(f'    CUDA memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB')
    # Quick GPU compute test
    x = torch.randn(1000, 1000, device='cuda')
    y = torch.matmul(x, x)
    torch.cuda.synchronize()
    print(f'    GPU compute test: PASSED (matmul 1000x1000)')
else:
    print('    [FAIL] CUDA not available to PyTorch!')
" 2>&1 | head -20
else
    echo "    [FAIL] nvidia-smi not available!"
fi

# Verify Continuous Learner is alive and will use GPU
echo ""
echo "    --- Continuous Learner Status ---"
CL_PID=$(cat "$LOGS/continuous-learner.pid" 2>/dev/null || echo "")
if [ -n "$CL_PID" ] && kill -0 "$CL_PID" 2>/dev/null; then
    echo "    CL process: RUNNING (PID $CL_PID)"
    # Wait a moment and check if it's producing output
    sleep 3
    CL_LINES=$(wc -l < "$LOGS/continuous-learner.log" 2>/dev/null || echo "0")
    echo "    CL log lines: $CL_LINES"
    if [ "$CL_LINES" -gt 0 ]; then
        echo "    CL last output:"
        tail -3 "$LOGS/continuous-learner.log" 2>/dev/null | sed 's/^/      /'
    fi
else
    echo "    [FAIL] Continuous Learner not running!"
    echo "    Check: tail -20 $LOGS/continuous-learner.log"
fi

# Check GPU memory usage after services started
sleep 2
GPU_USED=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader 2>/dev/null | head -1)
GPU_UTIL=$(nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader 2>/dev/null | head -1)
echo "    GPU memory used: $GPU_USED"
echo "    GPU utilization: $GPU_UTIL"

# ============================================================
# FINAL HEALTH CHECK
# ============================================================
echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║           HEALTH CHECK                   ║"
echo "  ╚══════════════════════════════════════════╝"

SERVICES=(
    "market-data:8001"
    "prediction:8002"
    "signal:8003"
    "risk:8004"
    "executor:8005"
    "position:8006"
    "feature-store:8007"
    "sentiment:8008"
    "trend:8009"
    "optimizer:8010"
    "backtesting:8011"
    "api-gateway:8080"
)

ALL_OK=true
UP_COUNT=0
TOTAL=${#SERVICES[@]}

for svc in "${SERVICES[@]}"; do
    name="${svc%%:*}"
    port="${svc##*:}"
    if curl -sf -o /dev/null --max-time 3 "http://localhost:$port/health" 2>/dev/null; then
        printf "    %-22s ✓ UP\n" "$name"
        UP_COUNT=$((UP_COUNT + 1))
    else
        printf "    %-22s ✗ DOWN\n" "$name"
        ALL_OK=false
    fi
done

# CL check
CL_PID=$(cat "$LOGS/continuous-learner.pid" 2>/dev/null || echo "")
if [ -n "$CL_PID" ] && kill -0 "$CL_PID" 2>/dev/null; then
    printf "    %-22s ✓ RUNNING\n" "continuous-learner"
    UP_COUNT=$((UP_COUNT + 1))
else
    printf "    %-22s ✗ DOWN\n" "continuous-learner"
    ALL_OK=false
fi
TOTAL=$((TOTAL + 1))

# Dashboard check
if [ "$SKIP_DASHBOARD" = false ]; then
    if curl -sf -o /dev/null --max-time 3 "http://localhost:3000" 2>/dev/null; then
        printf "    %-22s ✓ UP\n" "dashboard"
        UP_COUNT=$((UP_COUNT + 1))
    else
        printf "    %-22s ✗ DOWN\n" "dashboard"
    fi
    TOTAL=$((TOTAL + 1))
fi

echo ""
echo "  ╔══════════════════════════════════════════╗"
if $ALL_OK; then
    echo "  ║      ALL SYSTEMS GO ($UP_COUNT/$TOTAL)              ║"
else
    echo "  ║      $UP_COUNT/$TOTAL SERVICES UP                   ║"
fi
echo "  ╚══════════════════════════════════════════╝"
echo ""
echo "  Dashboard:  http://localhost:3000"
echo "  API:        http://localhost:8080"
echo "  Logs:       $LOGS/"
echo ""
echo "  To stop:    bash $ROOT/goblin_reset.sh"
echo ""
