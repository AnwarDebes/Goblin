"""
Data loader for the Backtesting service.
Reads historical candles, sentiment scores, and feature vectors
from TimescaleDB and merges them into a unified DataFrame.
"""
from datetime import datetime
from typing import Optional

import asyncpg
import pandas as pd
import structlog

logger = structlog.get_logger()
_sentiment_mentions_column: Optional[str] = None


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


async def load_candles(
    pool: asyncpg.Pool,
    symbols: list[str],
    start: datetime,
    end: datetime,
    timeframe: str = "1m",
) -> pd.DataFrame:
    """
    Load OHLCV candles from the ``candles`` hypertable.

    Returns a DataFrame with columns:
        time, symbol, open, high, low, close, volume
    sorted by (symbol, time).
    """
    async with pool.acquire() as conn:
        rows = []
        try:
            rows = await conn.fetch(
                """
                SELECT time, symbol, open, high, low, close, volume
                FROM candles
                WHERE symbol = ANY($1)
                  AND timeframe = $2
                  AND time >= $3
                  AND time <= $4
                ORDER BY symbol, time ASC
                """,
                symbols,
                timeframe,
                start,
                end,
            )
        except asyncpg.UndefinedTableError:
            rows = []

        # Fallback: derive candles directly from raw ticks when candles table is empty.
        if not rows:
            interval = _timeframe_to_interval(timeframe)
            rows = await conn.fetch(
                f"""
                SELECT
                    time_bucket(INTERVAL '{interval}', time) AS time,
                    symbol,
                    first(price, time) AS open,
                    max(price) AS high,
                    min(price) AS low,
                    last(price, time) AS close,
                    sum(COALESCE(volume, 0)) AS volume
                FROM ticks
                WHERE symbol = ANY($1)
                  AND time >= $2
                  AND time <= $3
                GROUP BY symbol, time_bucket(INTERVAL '{interval}', time)
                ORDER BY symbol, time ASC
                """,
                symbols,
                start,
                end,
            )

    if not rows:
        logger.warning("No candles found", symbols=symbols, start=start, end=end)
        return pd.DataFrame(columns=["time", "symbol", "open", "high", "low", "close", "volume"])

    df = pd.DataFrame([dict(r) for r in rows])
    df["time"] = pd.to_datetime(df["time"], utc=True)
    for col in ("open", "high", "low", "close", "volume"):
        df[col] = pd.to_numeric(df[col], errors="coerce")

    logger.info("Candles loaded", rows=len(df), symbols=df["symbol"].nunique())
    return df


async def load_sentiment(
    pool: asyncpg.Pool,
    symbols: list[str],
    start: datetime,
    end: datetime,
) -> pd.DataFrame:
    """
    Load sentiment scores from the ``sentiment_scores`` table.

    Returns a DataFrame with columns:
        time, symbol, source, score, mentions
    """
    try:
        async with pool.acquire() as conn:
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
                SELECT time, symbol, source, score, {mentions_expr} AS mentions
                FROM sentiment_scores
                WHERE symbol = ANY($1)
                  AND time >= $2
                  AND time <= $3
                ORDER BY symbol, time ASC
                """,
                symbols,
                start,
                end,
            )
    except asyncpg.UndefinedTableError:
        logger.info("sentiment_scores table does not exist yet")
        return pd.DataFrame(columns=["time", "symbol", "score"])

    if not rows:
        return pd.DataFrame(columns=["time", "symbol", "score"])

    df = pd.DataFrame([dict(r) for r in rows])
    df["time"] = pd.to_datetime(df["time"], utc=True)

    # Aggregate multiple sources into a single score per (symbol, time bucket)
    # Use 5-minute buckets so sentiment aligns reasonably with 1m candles
    df = df.set_index("time")
    agg = (
        df.groupby([pd.Grouper(freq="5min"), "symbol"])
        .agg(sentiment_score=("score", "mean"), mentions=("mentions", "sum"))
        .reset_index()
    )
    agg.rename(columns={"time": "time"}, inplace=True)

    logger.info("Sentiment loaded", rows=len(agg))
    return agg


async def load_features(
    pool: asyncpg.Pool,
    symbols: list[str],
    start: datetime,
    end: datetime,
) -> pd.DataFrame:
    """
    Load pre-computed feature vectors from the ``feature_vectors`` table.

    Returns a DataFrame where each JSONB feature dict is expanded into columns.
    """
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT time, symbol, features
                FROM feature_vectors
                WHERE symbol = ANY($1)
                  AND time >= $2
                  AND time <= $3
                ORDER BY symbol, time ASC
                """,
                symbols,
                start,
                end,
            )
    except asyncpg.UndefinedTableError:
        logger.info("feature_vectors table does not exist yet")
        return pd.DataFrame()

    if not rows:
        return pd.DataFrame()

    import json

    records = []
    for r in rows:
        rec = {"time": r["time"], "symbol": r["symbol"]}
        feats = r["features"]
        if isinstance(feats, str):
            feats = json.loads(feats)
        rec.update(feats)
        records.append(rec)

    df = pd.DataFrame(records)
    df["time"] = pd.to_datetime(df["time"], utc=True)

    logger.info("Features loaded", rows=len(df))
    return df


async def build_backtest_dataframe(
    pool: asyncpg.Pool,
    symbols: list[str],
    start: datetime,
    end: datetime,
    timeframe: str = "1m",
) -> pd.DataFrame:
    """
    Load candles, sentiment, and features then merge into a single
    DataFrame suitable for the backtesting engine.

    The resulting DataFrame has one row per (symbol, time) with columns:
        time, symbol, open, high, low, close, volume,
        sentiment_score (forward-filled), plus any feature columns.
    """
    candles = await load_candles(pool, symbols, start, end, timeframe)
    if candles.empty:
        return candles

    sentiment = await load_sentiment(pool, symbols, start, end)
    features = await load_features(pool, symbols, start, end)

    df = candles.copy()

    # Merge sentiment (asof join on nearest previous sentiment timestamp).
    # Use a minimal left frame (time only) to avoid column name collisions
    # across per-symbol iterations.
    df["sentiment_score"] = 0.0
    if not sentiment.empty:
        for sym in df["symbol"].unique():
            mask = df["symbol"] == sym
            sym_times = df.loc[mask, ["time"]].sort_values("time")
            sym_sent = sentiment[sentiment["symbol"] == sym][["time", "sentiment_score"]].sort_values("time")

            if sym_sent.empty:
                continue

            merged = pd.merge_asof(
                sym_times,
                sym_sent,
                on="time",
                direction="backward",
            )
            df.loc[mask, "sentiment_score"] = merged["sentiment_score"].to_numpy()

    # Merge features (asof join) with the same collision-safe approach.
    if not features.empty:
        feature_cols = [c for c in features.columns if c not in ("time", "symbol")]
        for col in feature_cols:
            if col not in df.columns:
                df[col] = 0.0

        for sym in df["symbol"].unique():
            mask = df["symbol"] == sym
            sym_times = df.loc[mask, ["time"]].sort_values("time")
            sym_feats = features[features["symbol"] == sym][["time"] + feature_cols].sort_values("time")

            if sym_feats.empty:
                continue

            merged = pd.merge_asof(
                sym_times,
                sym_feats,
                on="time",
                direction="backward",
            )
            for col in feature_cols:
                df.loc[mask, col] = merged[col].to_numpy()

    df["sentiment_score"] = pd.to_numeric(df["sentiment_score"], errors="coerce").fillna(0.0)
    df = df.sort_values(["symbol", "time"]).reset_index(drop=True)

    logger.info(
        "Backtest DataFrame built",
        rows=len(df),
        columns=list(df.columns),
        symbols=df["symbol"].nunique(),
    )
    return df
