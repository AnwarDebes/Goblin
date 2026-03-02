"""
Database layer for sentiment analysis - asyncpg pool for TimescaleDB writes.
Ensures schema compatibility across v1/v2 table variants.
"""
import os
from datetime import datetime
from typing import List, Optional, Tuple

import asyncpg
import structlog

logger = structlog.get_logger()

POSTGRES_HOST = os.getenv("POSTGRES_HOST", "timescaledb")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", 5432))
POSTGRES_DB = os.getenv("POSTGRES_DB", "goblin")
POSTGRES_USER = os.getenv("POSTGRES_USER", "goblin")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "")
DB_ENABLED = os.getenv("DB_ENABLED", "true").lower() == "true"

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS sentiment_scores (
    time        TIMESTAMPTZ NOT NULL,
    symbol      TEXT NOT NULL,
    source      TEXT NOT NULL,
    score       DOUBLE PRECISION NOT NULL,
    mentions    INTEGER NOT NULL DEFAULT 1,
    label       TEXT,
    text_hash   TEXT,
    raw_data    JSONB
);

SELECT create_hypertable('sentiment_scores', 'time', if_not_exists => TRUE);
"""

INSERT_SQL = """
INSERT INTO sentiment_scores (time, symbol, source, score, mentions, label, text_hash, raw_data)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
ON CONFLICT DO NOTHING
"""


class SentimentDB:
    """Manages asyncpg connection pool for writing sentiment scores."""

    def __init__(self):
        self._pool: Optional[asyncpg.Pool] = None

    async def connect(self):
        """Create connection pool and ensure table exists."""
        if not DB_ENABLED:
            logger.info("db_disabled")
            return

        try:
            self._pool = await asyncpg.create_pool(
                host=POSTGRES_HOST,
                port=POSTGRES_PORT,
                database=POSTGRES_DB,
                user=POSTGRES_USER,
                password=POSTGRES_PASSWORD,
                min_size=2,
                max_size=10,
            )
            async with self._pool.acquire() as conn:
                await conn.execute(CREATE_TABLE_SQL)
                # Backward-compatible migrations for existing deployments.
                await conn.execute(
                    "ALTER TABLE sentiment_scores ADD COLUMN IF NOT EXISTS source TEXT"
                )
                await conn.execute(
                    "ALTER TABLE sentiment_scores ADD COLUMN IF NOT EXISTS mentions INTEGER DEFAULT 1"
                )
                await conn.execute(
                    "ALTER TABLE sentiment_scores ADD COLUMN IF NOT EXISTS label TEXT"
                )
                await conn.execute(
                    "ALTER TABLE sentiment_scores ADD COLUMN IF NOT EXISTS text_hash TEXT"
                )
                await conn.execute(
                    "ALTER TABLE sentiment_scores ADD COLUMN IF NOT EXISTS raw_data JSONB"
                )
                # Older schema used volume instead of mentions.
                has_volume = await conn.fetchval(
                    """
                    SELECT EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = 'sentiment_scores'
                          AND column_name = 'volume'
                    )
                    """
                )
                if has_volume:
                    await conn.execute(
                        """
                        UPDATE sentiment_scores
                        SET mentions = COALESCE(mentions, volume, 1)
                        WHERE mentions IS NULL
                        """
                    )
            logger.info("sentiment_db_connected")
        except Exception as e:
            logger.error("sentiment_db_connect_error", error=str(e))
            self._pool = None

    async def close(self):
        if self._pool:
            await self._pool.close()

    async def batch_insert(
        self,
        records: List[Tuple[datetime, str, str, float, int, Optional[str], Optional[str], str]],
    ):
        """Batch insert sentiment records.

        Each record is:
        (time, symbol, source, score, mentions, label, text_hash, raw_data_json)
        """
        if not self._pool or not records:
            return

        try:
            async with self._pool.acquire() as conn:
                await conn.executemany(INSERT_SQL, records)
            logger.info("sentiment_db_inserted", count=len(records))
        except Exception as e:
            logger.error("sentiment_db_insert_error", error=str(e), count=len(records))
