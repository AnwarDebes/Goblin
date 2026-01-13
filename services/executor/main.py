"""
Order Executor Service - Executes trades on MEXC
"""
import asyncio
import json
import os
import uuid
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

import ccxt
import redis.asyncio as aioredis
import structlog
from fastapi import FastAPI, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from prometheus_client import Counter, Histogram, generate_latest

# Configuration
MEXC_API_KEY = os.getenv("MEXC_API_KEY", "")
MEXC_SECRET_KEY = os.getenv("MEXC_SECRET_KEY", "")
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")

logger = structlog.get_logger()

# Metrics
ORDERS_SUBMITTED = Counter("executor_orders_total", "Orders submitted", ["symbol", "side"])
ORDERS_FILLED = Counter("executor_orders_filled_total", "Orders filled")
ORDERS_FAILED = Counter("executor_orders_failed_total", "Orders failed", ["reason"])
ORDER_LATENCY = Histogram("executor_latency_seconds", "Order latency")


class OrderRequest(BaseModel):
    signal_id: str = ""
    symbol: str
    side: str = Field(..., pattern="^(buy|sell)$")
    amount: float = Field(..., gt=0)
    price: Optional[float] = None
    order_type: str = "limit"


class OrderResponse(BaseModel):
    order_id: str
    exchange_order_id: Optional[str] = None
    status: str
    symbol: str
    side: str
    amount: float
    price: Optional[float] = None
    filled: float = 0
    cost: float = 0
    timestamp: str


# Global State
exchange: Optional[ccxt.mexc] = None
redis_client: Optional[aioredis.Redis] = None


async def execute_order(request: OrderRequest) -> OrderResponse:
    order_id = str(uuid.uuid4())[:8]
    start_time = datetime.utcnow()

    logger.info("Executing order", order_id=order_id, symbol=request.symbol, side=request.side)

    try:
        if request.order_type == "market":
            order = exchange.create_market_order(request.symbol, request.side, request.amount)
        else:
            if request.price is None:
                ticker = exchange.fetch_ticker(request.symbol)
                request.price = ticker["ask"] if request.side == "buy" else ticker["bid"]
            order = exchange.create_limit_order(request.symbol, request.side, request.amount, request.price)

        ORDER_LATENCY.observe((datetime.utcnow() - start_time).total_seconds())
        ORDERS_SUBMITTED.labels(symbol=request.symbol, side=request.side).inc()

        if order.get("status") == "closed":
            ORDERS_FILLED.inc()

        response = OrderResponse(
            order_id=order_id, exchange_order_id=order.get("id"), status=order.get("status", "unknown"),
            symbol=request.symbol, side=request.side, amount=request.amount,
            price=order.get("price"), filled=order.get("filled", 0), cost=order.get("cost", 0),
            timestamp=datetime.utcnow().isoformat()
        )

        await redis_client.publish("order_updates", response.model_dump_json())
        await redis_client.hset("orders", order_id, response.model_dump_json())

        logger.info("Order executed", order_id=order_id, status=response.status)
        return response

    except Exception as e:
        ORDERS_FAILED.labels(reason=type(e).__name__).inc()
        logger.error("Order failed", order_id=order_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


async def listen_for_validated_signals():
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("validated_signals")

    async for message in pubsub.listen():
        if message["type"] == "message":
            try:
                signal = json.loads(message["data"])
                request = OrderRequest(
                    signal_id=signal.get("signal_id", ""), symbol=signal["symbol"],
                    side=signal["action"], amount=signal["amount"], price=signal.get("price")
                )
                await execute_order(request)
            except Exception as e:
                logger.error("Failed to execute signal", error=str(e))


@asynccontextmanager
async def lifespan(app: FastAPI):
    global exchange, redis_client
    logger.info("Starting Executor Service...")

    redis_client = aioredis.Redis(host=REDIS_HOST, port=REDIS_PORT, password=REDIS_PASSWORD, decode_responses=True)
    await redis_client.ping()

    exchange = ccxt.mexc({"apiKey": MEXC_API_KEY, "secret": MEXC_SECRET_KEY, "enableRateLimit": True})
    exchange.load_markets()

    listener_task = asyncio.create_task(listen_for_validated_signals())
    logger.info("Executor ready")

    yield

    listener_task.cancel()
    if redis_client:
        await redis_client.close()


app = FastAPI(title="Order Executor Service", version="1.0.0", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.post("/orders", response_model=OrderResponse)
async def create_order(request: OrderRequest):
    return await execute_order(request)


@app.get("/orders/{order_id}")
async def get_order(order_id: str):
    data = await redis_client.hget("orders", order_id)
    if data:
        return json.loads(data)
    raise HTTPException(status_code=404, detail="Order not found")


@app.get("/balance")
async def get_balance():
    try:
        balance = exchange.fetch_balance()
        return {"USDT": {"free": balance.get("USDT", {}).get("free", 0),
                        "total": balance.get("USDT", {}).get("total", 0)}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/metrics", response_class=PlainTextResponse)
async def metrics():
    return generate_latest()
