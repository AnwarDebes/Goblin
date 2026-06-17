#!/usr/bin/env bash
# Full stop of the Goblin stack: microservices, dashboard, watchdog and data layer.
# Data is preserved on disk (shared/redis-data, shared/pgdata), so a later
# goblin_start.sh brings everything back. Also disables the ~/.bashrc autostart
# hook so a new shell or container restart does not relaunch the bot.
set +e
GOBLIN=/home/coder/Goblin
PG_BIN=/usr/lib/postgresql/16/bin

echo "[goblin-stop] disabling autostart hook in ~/.bashrc"
sed -i 's|^\([[:space:]]*\)\(bash[[:space:]].*goblin_autostart\.sh.*\)|\1# \2|' "$HOME/.bashrc"

echo "[goblin-stop] stopping watchdog + releasing lock"
pkill -f 'scripts/goblin_autostart.sh'
rm -rf /tmp/goblin_autostart.lock

echo "[goblin-stop] stopping the microservices (uvicorn)"
pkill -9 -f 'uvicorn main:app'

echo "[goblin-stop] stopping the dashboard on :3000"
fuser -k 3000/tcp 2>/dev/null
pkill -f 'next-server'

echo "[goblin-stop] stopping redis"
pkill -x redis-server

echo "[goblin-stop] stopping postgres (fast shutdown)"
"$PG_BIN/pg_ctl" stop -D "$GOBLIN/shared/pgdata" -m fast 2>/dev/null || pkill -x postgres

sleep 3
echo "[goblin-stop] ---- verification ----"
echo "  uvicorn services left : $(pgrep -fc 'uvicorn main:app')"
echo "  watchdog left         : $(pgrep -fc 'scripts/goblin_autostart.sh')"
echo "  redis left            : $(pgrep -xc redis-server)"
echo "  postgres left         : $(pgrep -xc postgres)"
echo "  gateway :8080         : $(curl -s -m3 -o /dev/null -w '%{http_code}' http://localhost:8080/ 2>/dev/null || echo DOWN)"
echo "  dashboard :3000       : $(curl -s -m3 -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>/dev/null || echo DOWN)"
echo "[goblin-stop] data preserved on disk:"
du -sh "$GOBLIN/shared/redis-data" "$GOBLIN/shared/pgdata" 2>/dev/null | sed 's/^/    /'
echo "[goblin-stop] done. Restart everything with: bash $GOBLIN/scripts/goblin_start.sh"
