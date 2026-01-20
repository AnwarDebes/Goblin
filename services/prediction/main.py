"""
Prediction Service - Momentum + RSI Strategy for Short-Term Trading
"""
import asyncio
import json
import os
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from contextlib import asynccontextmanager

import numpy as np
import pandas as pd
import redis.asyncio as aioredis
import structlog
from fastapi import FastAPI, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from prometheus_client import Counter, Gauge, Histogram, generate_latest

# Configuration
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")
STRATEGY_TYPE = os.getenv("STRATEGY_TYPE", "momentum_rsi")
RSI_PERIOD = int(os.getenv("RSI_PERIOD", 14))
RSI_OVERSOLD = int(os.getenv("RSI_OVERSOLD", 40))      # Very aggressive: buy at RSI 40
RSI_OVERBOUGHT = int(os.getenv("RSI_OVERBOUGHT", 60))   # Very aggressive: sell at RSI 60
VOLUME_SPIKE_THRESHOLD = float(os.getenv("VOLUME_SPIKE_THRESHOLD", 0.9))  # Very aggressive: no volume requirement
MOMENTUM_PERIOD = int(os.getenv("MOMENTUM_PERIOD", 2))  # Compare current price to 2 ticks ago - AGGRESSIVE for testing
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", 0.25))  # More aggressive: 25% confidence threshold
TRADING_PAIRS = os.getenv("TRADING_PAIRS", "BTC/USDT,ETH/USDT,SOL/USDT").split(",")

logger = structlog.get_logger()
device = "cpu"  # Using CPU for momentum strategy (no GPU needed)

# Metrics
PREDICTIONS_MADE = Counter("prediction_total", "Total predictions", ["symbol"])
PREDICTION_LATENCY = Histogram("prediction_latency_seconds", "Prediction latency")
MODEL_CONFIDENCE = Gauge("prediction_confidence", "Model confidence", ["symbol"])


# Removed LSTM model - using momentum + RSI strategy instead


class PredictionResponse(BaseModel):
    symbol: str
    timestamp: str
    direction: str  # "buy", "sell", or "hold"
    confidence: float
    rsi_value: float
    momentum_pct: float
    volume_ratio: float
    current_price: float


# Global State
redis_client: Optional[aioredis.Redis] = None
price_history: Dict[str, List[dict]] = {}


def calculate_rsi(prices: List[float], period: int = RSI_PERIOD) -> float:
    """Calculate RSI (Relative Strength Index)"""
    if len(prices) < period + 1:
        return 50.0  # Neutral RSI

    gains = []
    losses = []

    for i in range(1, len(prices)):
        change = prices[i] - prices[i-1]
        if change > 0:
            gains.append(change)
            losses.append(0)
        else:
            gains.append(0)
            losses.append(abs(change))

    if len(gains) >= period:
        avg_gain = sum(gains[-period:]) / period
        avg_loss = sum(losses[-period:]) / period

        if avg_loss == 0:
            return 100.0

        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        return rsi

    return 50.0


def calculate_momentum(prices: List[float], period: int = MOMENTUM_PERIOD) -> float:
    """Calculate price momentum as percentage change"""
    if len(prices) < period + 1:
        return 0.0

    current_price = prices[-1]
    past_price = prices[-(period + 1)]
    return ((current_price - past_price) / past_price) * 100


def calculate_volume_ratio(volumes: List[float]) -> float:
    """Calculate volume ratio compared to recent average"""
    if len(volumes) < 10:
        return 1.0

    recent_volume = volumes[-1]
    avg_volume = sum(volumes[-10:]) / 10
    return recent_volume / avg_volume if avg_volume > 0 else 1.0


async def make_prediction(symbol: str) -> Optional[PredictionResponse]:
    """Generate trading signals using Momentum + RSI strategy"""
    data_points = len(price_history.get(symbol, []))
    if symbol not in price_history or data_points < 3:  # Need at least 3 points for momentum calculation - AGGRESSIVE for testing
        return None

    start_time = datetime.utcnow()

    # Extract price and volume data
    prices = [tick.get("close", tick.get("price", 0)) for tick in price_history[symbol][-50:]]
    volumes = [tick.get("volume", 1) for tick in price_history[symbol][-50:]]
    current_price = prices[-1] if prices else 0

    # Calculate indicators
    rsi_value = calculate_rsi(prices)
    momentum_pct = calculate_momentum(prices)
    volume_ratio = calculate_volume_ratio(volumes)

    # DEBUG: Log momentum calculation
    logger.info(f"DEBUG: {symbol} momentum={momentum_pct:.4f}, prices={len(prices)}, rsi={rsi_value:.2f}")

    # Determine trading direction based on strategy rules
    direction = "hold"
    confidence = 0.5

    # AGGRESSIVE MOMENTUM TRADING STRATEGY - VERY LOW THRESHOLDS FOR TESTING
    # NOTE: momentum_pct is returned as whole percentage (0.05% = 0.05)
    # Using 0.05% threshold for maximum signal generation - REAL TRADING TEST

    # BUY signal: Price INCREASED 0.05% or more (momentum - ride the wave!)
    if momentum_pct >= 0.01:  # Very aggressive: buy on any upward movement >= 0.01%
        direction = "buy"
        confidence = min(0.95, 0.7 + abs(momentum_pct) * 2)  # 70-95% confidence, aggressive
        logger.info(f"🟢 BUY SIGNAL: {symbol} up {momentum_pct:.3f}% - AGGRESSIVE momentum trading!")

    # SELL signal: Price DROPPED 0.05% or more (cut losses / exit positions)
    elif momentum_pct <= -0.05:
        direction = "sell"
        confidence = min(0.95, 0.7 + abs(momentum_pct) * 2)  # 70-95% confidence, aggressive
        logger.info(f"🔴 SELL SIGNAL: {symbol} down {momentum_pct:.3f}% - AGGRESSIVE sell!")

    # Skip if confidence too low
    if confidence < CONFIDENCE_THRESHOLD:
        direction = "hold"
        confidence = 0.5

    PREDICTION_LATENCY.observe((datetime.utcnow() - start_time).total_seconds())
    PREDICTIONS_MADE.labels(symbol=symbol).inc()
    MODEL_CONFIDENCE.labels(symbol=symbol).set(confidence)

    response = PredictionResponse(
        symbol=symbol,
        timestamp=datetime.utcnow().isoformat(),
        direction=direction,
        confidence=confidence,
        rsi_value=rsi_value,
        momentum_pct=momentum_pct,
        volume_ratio=volume_ratio,
        current_price=current_price
    )

    await redis_client.publish(f"predictions:{symbol.replace('/', '_')}", response.model_dump_json())
    logger.info("Signal generated", symbol=symbol, direction=direction, confidence=f"{confidence:.2%}",
                rsi=rsi_value, momentum=momentum_pct)

    return response


async def collect_market_data():
    global price_history
    pubsub = redis_client.pubsub()
    channels = [f"ticks:{s.strip().replace('/', '_')}" for s in TRADING_PAIRS]
    logger.info(f"Subscribing to {len(channels)} channels: {channels[:5]}...")
    await pubsub.subscribe(*channels)
    logger.info("Successfully subscribed to Redis channels")

    async for message in pubsub.listen():
        if message["type"] == "message":
            tick = json.loads(message["data"])
            symbol = tick["symbol"]
            data_point = {"timestamp": tick["timestamp"], "open": tick["price"], "high": tick["price"],
                         "low": tick["price"], "close": tick["price"], "volume": tick.get("volume", 0)}

            if symbol not in price_history:
                price_history[symbol] = []
            price_history[symbol].append(data_point)
            if len(price_history[symbol]) > 200:
                price_history[symbol] = price_history[symbol][-200:]

            logger.info(f"Received data for {symbol}, total points: {len(price_history[symbol])}")


async def prediction_loop():
    """Generate predictions rapidly for 200+ coins - optimized for high volume scanning"""
    while True:
        await asyncio.sleep(0.05)  # Ultra-fast predictions every 50ms for hundreds of coins

        # Process coins in batches to avoid overwhelming the system
        batch_size = 20  # Process 20 coins per batch
        for i in range(0, len(TRADING_PAIRS), batch_size):
            batch = TRADING_PAIRS[i:i + batch_size]
            tasks = []
            for symbol in batch:
                tasks.append(make_prediction(symbol.strip()))

            # Execute batch in parallel for maximum speed
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for symbol, result in zip(batch, results):
                if isinstance(result, Exception):
                    logger.error("Prediction failed", symbol=symbol, error=str(result))
                elif result:
                    logger.debug("Prediction completed", symbol=symbol, direction=result.direction)

            # Small delay between batches to prevent overwhelming Redis
            await asyncio.sleep(0.01)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client
    logger.info("Starting Prediction Service (Momentum + RSI Strategy)")

    redis_client = aioredis.Redis(host=REDIS_HOST, port=REDIS_PORT, password=REDIS_PASSWORD, decode_responses=True)
    await redis_client.ping()

    data_task = asyncio.create_task(collect_market_data())
    pred_task = asyncio.create_task(prediction_loop())

    yield

    data_task.cancel()
    pred_task.cancel()
    if redis_client:
        await redis_client.close()


app = FastAPI(title="Prediction Service", version="1.0.0", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "healthy", "strategy": STRATEGY_TYPE,
            "symbols_tracked": len(price_history), "rsi_period": RSI_PERIOD,
            "oversold_threshold": RSI_OVERSOLD, "overbought_threshold": RSI_OVERBOUGHT,
            "device": device}


@app.post("/predict/{symbol}", response_model=PredictionResponse)
async def predict(symbol: str):
    symbol = symbol.replace("_", "/").upper()
    result = await make_prediction(symbol)
    if result is None:
        raise HTTPException(status_code=400, detail="Insufficient data")
    return result


@app.get("/predictions")
async def get_all_predictions():
    results = {}
    for symbol in TRADING_PAIRS:
        try:
            pred = await make_prediction(symbol.strip())
            if pred:
                results[symbol.strip()] = pred.model_dump()
        except:
            pass
    return results


@app.get("/metrics", response_class=PlainTextResponse)
async def metrics():
    return generate_latest()
