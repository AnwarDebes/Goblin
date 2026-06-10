// Fixed public URL for the backend. Reads the current tunnel from KV key
// "api_origin" (written by goblin_start.sh on each start) and proxies to it.
// Deploy with scripts/deploy_cf_worker.sh.

export default {
  async fetch(request, env) {
    // cacheTtl 60: at most one KV read per edge location per minute; after a
    // tunnel restart the new origin is picked up within ~60s.
    const origin = await env.POINTER.get("api_origin", { cacheTtl: 60 });
    if (!origin) {
      return new Response(
        JSON.stringify({ error: "backend pointer not set - run goblin_start.sh" }),
        { status: 503, headers: { "content-type": "application/json" } },
      );
    }
    const url = new URL(request.url);
    const target = origin.replace(/\/+$/, "") + url.pathname + url.search;
    return fetch(new Request(target, request));
  },
};
