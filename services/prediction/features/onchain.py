"""
Fetch on-chain features from the feature-store service or Redis.

Returns a flat dict of on-chain metrics normalised for model consumption.
"""

import json
import os
from typing import Dict, Optional

import httpx
import redis.asyncio as aioredis
import structlog

logger = structlog.get_logger()

FEATURE_STORE_URL = os.getenv("FEATURE_STORE_URL", "http://localhost:8007")

ONCHAIN_KEYS = [
    "whale_activity_score",
    "exchange_netflow",
    "funding_rate",
    "google_trends_score",
    "social_volume_zscore",
]

# Module-level shared HTTP client — avoids creating a new TCP connection per call.
_http_client: Optional[httpx.AsyncClient] = None


def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=2.0)
    return _http_client


def _defaults() -> Dict[str, float]:
    d = {k: 0.0 for k in ONCHAIN_KEYS}
    d["_source"] = "default"
    return d


async def fetch_onchain_features(
    symbol: str,
    redis_client: Optional[aioredis.Redis] = None,
    feature_store_url: Optional[str] = None,
) -> Dict[str, float]:
    """
    Fetch on-chain features for *symbol*.

    Strategy:
    1. Try the feature-store REST endpoint ``GET /features/{symbol}``.
    2. Fall back to Redis hash ``onchain:{symbol}``.
    3. Return zeros on failure.
    """
    url = feature_store_url or FEATURE_STORE_URL
    client = _get_http_client()

    # Attempt 1: feature-store HTTP (single attempt, short timeout).
    # Require at least one real onchain key in the response before claiming
    # the source — a 200 with no onchain keys is NOT available data.
    try:
        resp = await client.get(f"{url}/features/{symbol.replace('/', '_')}")
        if resp.status_code == 200:
            data = resp.json()
            present = [k for k in ONCHAIN_KEYS if k in data]
            if present:
                result = {k: float(data.get(k, 0.0)) for k in ONCHAIN_KEYS}
                result["_source"] = "feature_store"
                return result
    except Exception:
        pass

    # Attempt 2: Redis — trends:{symbol} written by trend-analysis (JSON string).
    if redis_client is not None:
        try:
            raw = await redis_client.get(f"trends:{symbol}")
            if raw:
                d = json.loads(raw)
                em = d.get("exchange_metrics") or {}
                gt = d.get("google_trends") or {}
                sv = d.get("social_volume") or {}
                wf = d.get("whale_flow") or {}
                result = {k: 0.0 for k in ONCHAIN_KEYS}
                found = False
                if em.get("funding_rate") is not None:
                    result["funding_rate"] = float(em["funding_rate"])
                    found = True
                if gt.get("current_interest") is not None:
                    result["google_trends_score"] = float(gt["current_interest"])
                    found = True
                if sv.get("z_score") is not None:
                    result["social_volume_zscore"] = float(sv["z_score"])
                    found = True
                if wf.get("net_flow_score") is not None:
                    result["whale_activity_score"] = float(wf["net_flow_score"])
                    found = True
                if wf.get("net_flow_usd") is not None:
                    result["exchange_netflow"] = float(wf["net_flow_usd"])
                    found = True
                if found:
                    result["_source"] = "redis"
                    return result
        except Exception:
            pass

    return _defaults()
