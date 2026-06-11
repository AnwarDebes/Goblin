"""
On-chain / market-structure features sourced from trend-analysis.

Reads the merged trends:{symbol} Redis key written by the trend-analysis
service (exchange_metrics, google_trends, social_volume, whale_flow).

A key is emitted ONLY when its source exists and is fresh — no zero-filling —
so downstream consumers can distinguish a real zero from missing data.
"""
import json
from datetime import datetime, timezone

import redis.asyncio as aioredis
import structlog

logger = structlog.get_logger()

# Per-source freshness windows (seconds), matched to collector intervals.
MAX_AGE_S = {
    "exchange_metrics": 600,
    "google_trends": 6 * 3600,
    "social_volume": 3600,
    "whale_flow": 1800,
}


def _fresh(sub: dict, kind: str) -> bool:
    ts = sub.get("timestamp")
    if not ts:
        return True  # whale_flow has no per-item timestamp; rely on trends key TTL
    try:
        t = datetime.fromisoformat(ts)
        if t.tzinfo is None:
            t = t.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - t).total_seconds() <= MAX_AGE_S.get(kind, 3600)
    except ValueError:
        return True


async def compute_onchain_features(symbol: str, redis_client: aioredis.Redis) -> dict[str, float]:
    feats: dict[str, float] = {}
    try:
        raw = await redis_client.get(f"trends:{symbol}")
        if not raw:
            return feats
        data = json.loads(raw)
        em = data.get("exchange_metrics") or {}
        if em.get("funding_rate") is not None and _fresh(em, "exchange_metrics"):
            feats["funding_rate"] = float(em["funding_rate"])
        gt = data.get("google_trends") or {}
        if gt.get("current_interest") is not None and _fresh(gt, "google_trends"):
            feats["google_trends_score"] = float(gt["current_interest"])
        sv = data.get("social_volume") or {}
        if sv.get("z_score") is not None and _fresh(sv, "social_volume"):
            feats["social_volume_zscore"] = float(sv["z_score"])
        wf = data.get("whale_flow") or {}
        if wf.get("net_flow_score") is not None:
            feats["whale_activity_score"] = float(wf["net_flow_score"])
        if wf.get("net_flow_usd") is not None:
            feats["exchange_netflow"] = float(wf["net_flow_usd"])
    except Exception as e:
        logger.debug("No onchain trend data", symbol=symbol, error=str(e))
    return feats
