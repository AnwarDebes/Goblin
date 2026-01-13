"""
Position Manager Service - Tracks all open positions
"""
import asyncio
import json
import os
from datetime import datetime
from typing import Optional, Dict
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
import structlog
from fastapi import FastAPI, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from prometheus_client import Gauge, generate_latest

# Configuration
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")

logger = structlog.get_logger()

# Metrics
POSITION_VALUE = Gauge("position_value", "Position value", ["symbol"])
TOTAL_PNL = Gauge("position_total_pnl", "Total P&L")


class Position(BaseModel):
    symbol: str
    side: str
    entry_price: float
    current_price: float
    amount: float
    unrealized_pnl: float = 0
    realized_pnl: float = 0
    status: str = "open"
    opened_at: str = ""


# Global State
redis_client: Optional[aioredis.Redis] = None
positions: Dict[str, Position] = {}


async def handle_filled_order(order: dict):
    global positions
    symbol = order["symbol"]
    side = "long" if order["side"] == "buy" else "short"

    if symbol in positions and positions[symbol].status == "open":
        pos = positions[symbol]
        if (pos.side == "long" and order["side"] == "sell") or (pos.side == "short" and order["side"] == "buy"):
            realized = (order["price"] - pos.entry_price) * order["filled"] if pos.side == "long" else (pos.entry_price - order["price"]) * order["filled"]
            pos.realized_pnl = realized
            pos.status = "closed"
            await redis_client.publish("position_closed", json.dumps({"symbol": symbol, "pnl": realized}))
            logger.info("Position closed", symbol=symbol, pnl=realized)
    else:
        positions[symbol] = Position(
            symbol=symbol, side=side, entry_price=order["price"] or 0,
            current_price=order["price"] or 0, amount=order["filled"], opened_at=datetime.utcnow().isoformat()
        )
        await redis_client.publish("position_opened", json.dumps({"symbol": symbol}))
        logger.info("Position opened", symbol=symbol, side=side)

    await redis_client.hset("positions", symbol, positions[symbol].model_dump_json())


async def listen_for_orders():
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("order_updates")
    async for message in pubsub.listen():
        if message["type"] == "message":
            order = json.loads(message["data"])
            if order["status"] == "closed":
                await handle_filled_order(order)


async def update_prices():
    global positions
    while True:
        await asyncio.sleep(5)
        for symbol, pos in list(positions.items()):
            if pos.status != "open":
                continue
            tick_data = await redis_client.hget("latest_ticks", symbol)
            if tick_data:
                tick = json.loads(tick_data)
                pos.current_price = tick["price"]
                pos.unrealized_pnl = (pos.current_price - pos.entry_price) * pos.amount if pos.side == "long" else (pos.entry_price - pos.current_price) * pos.amount
                POSITION_VALUE.labels(symbol=symbol).set(pos.current_price * pos.amount)
                await redis_client.hset("positions", symbol, pos.model_dump_json())


async def load_positions():
    global positions
    all_pos = await redis_client.hgetall("positions")
    for symbol, data in all_pos.items():
        pos = Position(**json.loads(data))
        if pos.status == "open":
            positions[symbol] = pos


@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client
    logger.info("Starting Position Manager...")

    redis_client = aioredis.Redis(host=REDIS_HOST, port=REDIS_PORT, password=REDIS_PASSWORD, decode_responses=True)
    await load_positions()

    order_task = asyncio.create_task(listen_for_orders())
    price_task = asyncio.create_task(update_prices())

    yield

    order_task.cancel()
    price_task.cancel()
    if redis_client:
        await redis_client.close()


app = FastAPI(title="Position Manager", version="1.0.0", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "healthy", "positions": len([p for p in positions.values() if p.status == "open"])}


@app.get("/positions")
async def get_positions():
    return {k: v.model_dump() for k, v in positions.items() if v.status == "open"}


@app.get("/positions/{symbol}")
async def get_position(symbol: str):
    symbol = symbol.replace("_", "/").upper()
    if symbol in positions:
        return positions[symbol]
    raise HTTPException(status_code=404, detail="Position not found")


@app.get("/pnl")
async def get_total_pnl():
    unrealized = sum(p.unrealized_pnl for p in positions.values() if p.status == "open")
    realized = sum(p.realized_pnl for p in positions.values())
    total = unrealized + realized
    TOTAL_PNL.set(total)
    return {"unrealized_pnl": unrealized, "realized_pnl": realized, "total_pnl": total}


@app.get("/metrics", response_class=PlainTextResponse)
async def metrics():
    return generate_latest()
