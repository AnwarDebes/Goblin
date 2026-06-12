#!/bin/bash
# Goblin autostart watchdog.
# Safe to call from every shell: exits instantly if Goblin is already up
# or another autostart is in flight. On a fresh container (post-restart),
# launches goblin_start.sh --resume in the background, then keeps a
# 5-minute health-check loop alive so a mid-run crash also self-heals.

ROOT="/home/coder/Goblin"
LOCK="/tmp/goblin_autostart.lock"   # /tmp is wiped on container restart, so the lock auto-clears
LOG="$ROOT/logs/autostart.log"

healthy() {
    curl -sf -o /dev/null --max-time 2 http://localhost:8080/health 2>/dev/null
}

# Re-arm the boot hook: if a new code-server version was downloaded (fresh
# unpatched tarball in cache), patch it so the NEXT boot autostarts again.
(bash "$ROOT/scripts/wrap_code_server_cache.sh" >> "$ROOT/logs/autostart.log" 2>&1 &)

# Fast path: already running, nothing to do.
healthy && exit 0

# One autostart at a time (atomic via mkdir).
mkdir "$LOCK" 2>/dev/null || exit 0

(
    echo "[$(date '+%F %T')] api-gateway down - launching goblin_start.sh --resume"
    bash "$ROOT/goblin_start.sh" --resume >> "$LOG" 2>&1 || \
        echo "[$(date '+%F %T')] resume FAILED - check $LOG"

    # Watchdog: while this container lives, resume again if the gateway dies.
    while true; do
        sleep 300
        if ! healthy; then
            echo "[$(date '+%F %T')] watchdog: api-gateway down - resuming"
            bash "$ROOT/goblin_start.sh" --resume >> "$LOG" 2>&1
        fi
    done
) >> "$LOG" 2>&1 &

disown
exit 0
