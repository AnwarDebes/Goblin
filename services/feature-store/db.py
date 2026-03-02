"""
Database layer for the Feature Store service.
Manages asyncpg connection pool and provides read access
to candles and sentiment data in TimescaleDB.
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import asyncpg
import structlog

logger = structlog.get_logger()

# Configuration
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "timescaledb")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", 5432))
POSTGRES_DB = os.getenv("POSTGRES_DB", "goblin")
POSTGRES_USER = os.getenv("POSTGRES_USER", "goblin")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "")

_pool: Optional[asyncpg.Pool] = None
_sentiment_mentions_column: Optional[str] = None


def _to_float(value, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _timeframe_to_interval(timeframe: str) -> str:
    mapping = {
        "1m": "1 minute",
        "5m": "5 minutes",
        "15m": "15 minutes",
        "30m": "30 minutes",
        "1h": "1 hour",
        "4h": "4 hours",
        "1d": "1 day",
    }
    return mapping.get(timeframe, "1 minute")


async def init_pool() -> asyncpg.Pool:
    """Create and return the asyncpg connection pool."""
    global _pool
    _pool = await asyncpg.create_pool(
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
        database=POSTGRES_DB,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
        min_size=2,
        max_size=10,
    )
    logger.info("TimescaleDB pool initialized", host=POSTGRES_HOST, db=POSTGRES_DB)
    return _pool


async def close_pool():
    """Close the connection pool."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("TimescaleDB pool closed")


def get_pool() -> Optional[asyncpg.Pool]:
    """Return the current pool (may be None if not initialized)."""
    return _pool


async def fetch_candles(
    symbol: str,
    timeframe: str = "1m",
    limit: int = 200,
) -> list[dict]:
    """
    Fetch the most recent candles for a symbol and timeframe.
    Returns list of dicts with keys: time, open, high, low, close, volume.
    """
    if not _pool:
        return []

    try:
        async with _pool.acquire() as conn:
            rows = []
            try:
                rows = await conn.fetch(
                    """
                    SELECT time, open, high, low, close, volume
                    FROM candles
                    WHERE symbol = $1 AND timeframe = $2
                    ORDER BY time DESC
                    LIMIT $3
                    """,
                    symbol,
                    timeframe,
                    limit,
                )
            except asyncpg.UndefinedTableError:
                rows = []

            # Fallback path: derive candles from raw ticks when candles table is empty/unavailable.
            if not rows:
                interval = _timeframe_to_interval(timeframe)
                rows = await conn.fetch(
                    f"""
                    WITH bucketed AS (
                        SELECT
                            time_bucket(INTERVAL '{interval}', time) AS bucket,
                            first(price, time) AS open,
                            max(price) AS high,
                            min(price) AS low,
                            last(price, time) AS close,
                            sum(COALESCE(volume, 0)) AS volume
                        FROM ticks
                        WHERE symbol = $1
                        GROUP BY bucket
                        ORDER BY bucket DESC
                        LIMIT $2
                    )
                    SELECT bucket AS time, open, high, low, close, volume
                    FROM bucketed
                    ORDER BY time DESC
                    """,
                    symbol,
                    limit,
                )
        # Return in chronological order (oldest first)
        return [
            {
                "time": row["time"],
                "open": _to_float(row["open"]),
                "high": _to_float(row["high"]),
                "low": _to_float(row["low"]),
                "close": _to_float(row["close"]),
                "volume": _to_float(row["volume"]),
            }
            for row in reversed(rows)
        ]
    except Exception as e:
        logger.error("Failed to fetch candles", symbol=symbol, error=str(e))
        return []


async def fetch_sentiment_scores(
    symbol: str,
    hours: int = 24,
) -> list[dict]:
    """
    Fetch sentiment scores for a symbol over the last N hours.
    Returns list of dicts with keys: time, source, score, mentions.
    """
    if not _pool:
        return []

    try:
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        async with _pool.acquire() as conn:
            global _sentiment_mentions_column
            if _sentiment_mentions_column is None:
                cols = await conn.fetch(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'sentiment_scores'
                    """
                )
                col_set = {row["column_name"] for row in cols}
                if "mentions" in col_set:
                    _sentiment_mentions_column = "mentions"
                elif "volume" in col_set:
                    _sentiment_mentions_column = "volume"
                else:
                    _sentiment_mentions_column = ""

            mentions_expr = _sentiment_mentions_column or "1"
            rows = await conn.fetch(
                f"""
                SELECT time, source, score, {mentions_expr} AS mentions
                FROM sentiment_scores
                WHERE symbol = $1 AND time >= $2
                ORDER BY time ASC
                """,
                symbol,
                since,
            )
        return [
            {
                "time": row["time"],
                "source": row["source"],
                "score": _to_float(row["score"]),
                "mentions": _to_float(row["mentions"], 1.0),
            }
            for row in rows
        ]
    except asyncpg.UndefinedTableError:
        # Table doesn't exist yet - sentiment pipeline not deployed
        return []
    except Exception as e:
        logger.error("Failed to fetch sentiment scores", symbol=symbol, error=str(e))
        return []


async def store_features(
    symbol: str,
    features: dict,
):
    """
    Persist a computed feature vector to TimescaleDB for historical analysis.
    """
    if not _pool:
        return

    try:
        import json

        async with _pool.acquire() as conn:
            await conn.execute(
                """
                CREATE TABLE IF NOT EXISTS feature_vectors (
                    time        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    symbol      TEXT NOT NULL,
                    features    JSONB NOT NULL
                );
                """,
            )
            # Try to make it a hypertable (idempotent)
            try:
                await conn.execute(
                    "SELECT create_hypertable('feature_vectors', 'time', if_not_exists => TRUE);"
                )
            except Exception:
                pass

            await conn.execute(
                """
                INSERT INTO feature_vectors (symbol, features)
                VALUES ($1, $2::jsonb)
                """,
                symbol,
                json.dumps(features),
            )
    except Exception as e:
        logger.error("Failed to store features", symbol=symbol, error=str(e))
