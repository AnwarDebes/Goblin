#!/bin/bash
# Goblin backup loop - pg_dump every 15 min to shared/backups (home dir, survives
# container rebuilds). Keeps the last 50 dumps. Run via:
#   nohup bash /home/coder/Goblin/scripts/goblin_backup_loop.sh >/dev/null 2>&1 &
set -u
ROOT="/home/coder/Goblin"
BACKUPS="$ROOT/shared/backups"
set -a; source "$ROOT/config/trading.env"; source "$ROOT/config/.secrets.env" 2>/dev/null || true; set +a
export PGPASSWORD="$POSTGRES_PASSWORD"
mkdir -p "$BACKUPS"

while true; do
    STAMP=$(date +%Y%m%d_%H%M%S)
    if pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
        -F c -f "$BACKUPS/goblin_${STAMP}.dump" 2>>"$BACKUPS/backup_errors.log"; then
        # also snapshot the live Redis portfolio state alongside the SQL dump
        redis-cli -a "$REDIS_PASSWORD" --no-auth-warning GET portfolio_state \
            > "$BACKUPS/portfolio_${STAMP}.json" 2>/dev/null || true
    fi
    # prune: keep newest 50 of each
    ls -1t "$BACKUPS"/goblin_*.dump 2>/dev/null | tail -n +51 | xargs -r rm -f
    ls -1t "$BACKUPS"/portfolio_*.json 2>/dev/null | tail -n +51 | xargs -r rm -f
    sleep 900
done
