#!/bin/bash
# Keep the Cloudflare Worker's `api_origin` KV pointer synced to the live
# api-gateway tunnel. trycloudflare quick-tunnel URLs rotate on every
# reconnect/restart; when the pointer goes stale the Worker returns
# "Origin DNS error" and the Vercel frontend shows nothing. This loop
# re-points within ~60s of any rotation, so the permanent URL
# (https://goblin-api.goblin-anwar.workers.dev) always follows the live tunnel.
ROOT="/home/coder/Goblin"
set -a; source "$ROOT/config/trading.env"; source "$ROOT/config/.secrets.env" 2>/dev/null; set +a
LOG="$ROOT/logs/cloudflared-api.log"
OUT="$ROOT/logs/tunnel-kv-sync.log"

if [ -z "${CF_API_TOKEN:-}" ] || [ -z "${CF_ACCOUNT_ID:-}" ] || [ -z "${CF_KV_NAMESPACE_ID:-}" ]; then
    echo "[$(date '+%F %T')] CF creds missing - sync disabled" >> "$OUT"; exit 0
fi
KV_URL="https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_KV_NAMESPACE_ID}/values/api_origin"
AUTH="Authorization: Bearer ${CF_API_TOKEN}"

while true; do
    # newest live trycloudflare URL in the api tunnel log (newest-first, deduped)
    LIVE=""
    for u in $(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" "$LOG" 2>/dev/null | tail -8 | tac | awk '!seen[$0]++'); do
        if curl -sf -o /dev/null --max-time 6 "$u/health" 2>/dev/null; then LIVE="$u"; break; fi
    done
    if [ -n "$LIVE" ]; then
        CUR=$(curl -s --max-time 8 "$KV_URL" -H "$AUTH" 2>/dev/null)
        if [ "$CUR" != "$LIVE" ]; then
            if curl -s --max-time 10 -X PUT "$KV_URL" -H "$AUTH" --data "$LIVE" >/dev/null 2>&1; then
                echo "[$(date '+%F %T')] api_origin re-pointed: ${CUR:-<empty>} -> $LIVE" >> "$OUT"
                printf "%s\n%s\n" "$(sed -n '1p' "$ROOT/logs/tunnel-url.txt" 2>/dev/null)" "$LIVE" > "$ROOT/logs/tunnel-url.txt"
            fi
        fi
    fi
    sleep 60
done
