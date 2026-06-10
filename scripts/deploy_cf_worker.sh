#!/bin/bash
# Deploy/redeploy the goblin-api proxy worker (scripts/cf-worker-goblin-api.js)
# to https://goblin-api.goblin-anwar.workers.dev.
#
# Only needed when the worker CODE changes. The tunnel-URL pointer is updated
# automatically by goblin_start.sh Phase 6 (KV key "api_origin") - no redeploy.
set -euo pipefail
ROOT="/home/coder/Goblin"
set -a; source "$ROOT/config/.secrets.env"; set +a
: "${CF_API_TOKEN:?}" "${CF_ACCOUNT_ID:?}" "${CF_KV_NAMESPACE_ID:?}"

curl -sf -X PUT "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/workers/scripts/goblin-api" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -F "metadata={\"main_module\":\"worker.js\",\"compatibility_date\":\"2026-01-01\",\"bindings\":[{\"type\":\"kv_namespace\",\"name\":\"POINTER\",\"namespace_id\":\"${CF_KV_NAMESPACE_ID}\"}]};type=application/json" \
  -F "worker.js=@${ROOT}/scripts/cf-worker-goblin-api.js;type=application/javascript+module;filename=worker.js" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('worker deploy:', 'OK' if d['success'] else d['errors'])"
