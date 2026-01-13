"""
Signal Service - Converts predictions to trading signals
"""
import asyncio
import json
import os
import uuid
from datetime import datetime
from typing import Optional, Dict
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
import structlog
from fastapi import FastAPI
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from prometheus_client import Counter, Gauge, generate_latest

# Configuration
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", 0.6))
STARTING_CAPITAL = float(os.getenv("STARTING_CAPITAL", 11.0))
MAX_POSITION_PCT = float(os.getenv("MAX_POSITION_PCT", 0.50))
TRADING_PAIRS = os.getenv("TRADING_PAIRS", "BTC/USDT,ETH/USDT,SOL/USDT").split(",")

logger = structlog.get_logger()

# Metrics
SIGNALS_GENERATED = Counter("signal_generated_total", "Signals generated", ["symbol", "action"])
SIGNALS_SKIPPED = Counter("signal_skipped_total", "Signals skipped", ["reason"])


class Signal(BaseModel):
    signal_id: str
    symbol: str
    action: str
    amount: float
    price: float
    confidence: float
    timestamp: str


class Position(BaseModel):
    symbol: str
    side: str
    amount: float
    entry_price: float


# Global State
redis_client: Optional[aioredis.Redis] = None
current_positions: Dict[str, Position] = {}
last_signals: Dict[str, Signal] = {}


async def generate_signal(prediction: dict) -> Optional[Signal]:
    symbol = prediction["symbol"]
    direction = prediction["direction"]
    confidence = prediction["confidence"]
    current_price = prediction["current_price"]

    if confidence < CONFIDENCE_THRESHOLD:
        SIGNALS_SKIPPED.labels(reason="low_confidence").inc()
        return None

    if direction == "neutral":
        SIGNALS_SKIPPED.labels(reason="neutral").inc()
        return None

    has_position = symbol in current_positions

    if direction == "up" and not has_position:
        action = "buy"
    elif direction == "down" and has_position:
        action = "sell"
    else:
        SIGNALS_SKIPPED.labels(reason="no_action").inc()
        return None

    if action == "buy":
        portfolio = await redis_client.get("portfolio_state")
        available = json.loads(portfolio).get("available_capital", STARTING_CAPITAL) if portfolio else STARTING_CAPITAL
        trade_value = available * MAX_POSITION_PCT * confidence
        amount = trade_value / current_price
    else:
        amount = current_positions[symbol].amount

    signal = Signal(
        signal_id=str(uuid.uuid4())[:8], symbol=symbol, action=action,
        amount=amount, price=current_price, confidence=confidence,
        timestamp=datetime.utcnow().isoformat()
    )

    SIGNALS_GENERATED.labels(symbol=symbol, action=action).inc()
    last_signals[symbol] = signal
    logger.info("Signal generated", signal_id=signal.signal_id, symbol=symbol, action=action)

    return signal


async def listen_for_predictions():
    pubsub = redis_client.pubsub()
    channels = [f"predictions:{s.strip().replace('/', '_')}" for s in TRADING_PAIRS]
    await pubsub.subscribe(*channels)

    async for message in pubsub.listen():
        if message["type"] == "message":
            try:
                prediction = json.loads(message["data"])
                signal = await generate_signal(prediction)
                if signal:
                    await redis_client.publish("raw_signals", signal.model_dump_json())
            except Exception as e:
                logger.error("Error processing prediction", error=str(e))


async def listen_for_position_updates():
    global current_positions
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("position_opened", "position_closed")

    async for message in pubsub.listen():
        if message["type"] == "message":
            data = json.loads(message["data"])
            symbol = data["symbol"]
            if message["channel"] == "position_opened":
                pos_data = await redis_client.hget("positions", symbol)
                if pos_data:
                    current_positions[symbol] = Position(**json.loads(pos_data))
            else:
                current_positions.pop(symbol, None)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client
    logger.info("Starting Signal Service...")

    redis_client = aioredis.Redis(host=REDIS_HOST, port=REDIS_PORT, password=REDIS_PASSWORD, decode_responses=True)
    await redis_client.ping()

    positions = await redis_client.hgetall("positions")
    for symbol, data in positions.items():
        pos = json.loads(data)
        if pos.get("status") == "open":
            current_positions[symbol] = Position(**pos)

    pred_task = asyncio.create_task(listen_for_predictions())
    pos_task = asyncio.create_task(listen_for_position_updates())

    yield

    pred_task.cancel()
    pos_task.cancel()
    if redis_client:
        await redis_client.close()


app = FastAPI(title="Signal Service", version="1.0.0", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "healthy", "positions_tracked": len(current_positions)}


@app.get("/signals")
async def get_signals():
    return {k: v.model_dump() for k, v in last_signals.items()}


@app.post("/manual-signal")
async def create_manual_signal(symbol: str, action: str, amount: float):
    tick = await redis_client.hget("latest_ticks", symbol)
    if not tick:
        return {"error": "No price data"}
    tick = json.loads(tick)
    signal = Signal(
        signal_id=f"manual-{str(uuid.uuid4())[:4]}", symbol=symbol, action=action,
        amount=amount, price=tick["price"], confidence=1.0, timestamp=datetime.utcnow().isoformat()
    )
    await redis_client.publish("raw_signals", signal.model_dump_json())
    return signal


@app.get("/metrics", response_class=PlainTextResponse)
async def metrics():
    return generate_latest()
