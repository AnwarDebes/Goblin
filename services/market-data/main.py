"""
Market Data Service - Streams real-time prices from MEXC
"""
import asyncio
import json
import os
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

import ccxt.pro as ccxtpro
import redis.asyncio as aioredis
import structlog
from fastapi import FastAPI
from fastapi.responses import PlainTextResponse
from prometheus_client import Counter, Gauge, generate_latest

# Configuration
MEXC_API_KEY = os.getenv("MEXC_API_KEY", "")
MEXC_SECRET_KEY = os.getenv("MEXC_SECRET_KEY", "")
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")
TRADING_PAIRS = os.getenv("TRADING_PAIRS", "BTC/USDT,ETH/USDT,SOL/USDT").split(",")

logger = structlog.get_logger()

# Metrics
TICKS_RECEIVED = Counter("market_data_ticks_total", "Total ticks received", ["symbol"])
WS_CONNECTED = Gauge("market_data_ws_connected", "WebSocket connection status")
LAST_PRICE = Gauge("market_data_last_price", "Last price", ["symbol"])

# Global State
exchange: Optional[ccxtpro.mexc] = None
redis_client: Optional[aioredis.Redis] = None
is_connected = False
last_ticks = {}
streaming_task = None


async def stream_market_data():
    """Stream real-time ticker data from MEXC"""
    global is_connected, last_ticks, exchange

    symbols = [s.strip() for s in TRADING_PAIRS]
    logger.info("Starting market data stream", symbols=symbols)

    while True:
        try:
            is_connected = True
            WS_CONNECTED.set(1)

            while True:
                tickers = await exchange.watch_tickers(symbols)

                for symbol, ticker in tickers.items():
                    tick_data = {
                        "symbol": symbol,
                        "timestamp": datetime.utcnow().isoformat(),
                        "price": float(ticker.get("last", 0)),
                        "bid": float(ticker.get("bid", 0)),
                        "ask": float(ticker.get("ask", 0)),
                        "volume": float(ticker.get("quoteVolume", 0)),
                        "change_pct": float(ticker.get("percentage", 0)),
                    }

                    TICKS_RECEIVED.labels(symbol=symbol).inc()
                    LAST_PRICE.labels(symbol=symbol).set(tick_data["price"])

                    last_ticks[symbol] = tick_data

                    channel = f"ticks:{symbol.replace('/', '_')}"
                    await redis_client.publish(channel, json.dumps(tick_data))
                    await redis_client.hset("latest_ticks", symbol, json.dumps(tick_data))

        except Exception as e:
            is_connected = False
            WS_CONNECTED.set(0)
            logger.error("WebSocket error, reconnecting...", error=str(e))
            await asyncio.sleep(5)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global exchange, redis_client, streaming_task

    logger.info("Starting Market Data Service...")

    redis_client = aioredis.Redis(
        host=REDIS_HOST, port=REDIS_PORT,
        password=REDIS_PASSWORD, decode_responses=True
    )
    await redis_client.ping()
    logger.info("Redis connected")

    exchange = ccxtpro.mexc({
        "apiKey": MEXC_API_KEY,
        "secret": MEXC_SECRET_KEY,
        "enableRateLimit": True,
    })
    logger.info("MEXC exchange initialized")

    streaming_task = asyncio.create_task(stream_market_data())

    yield

    if streaming_task:
        streaming_task.cancel()
    if exchange:
        await exchange.close()
    if redis_client:
        await redis_client.close()


app = FastAPI(title="Market Data Service", version="1.0.0", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "healthy" if is_connected else "degraded", "websocket": is_connected, "symbols": len(last_ticks)}


@app.get("/tickers")
async def get_all_tickers():
    return last_ticks


@app.get("/ticker/{symbol}")
async def get_ticker(symbol: str):
    symbol = symbol.replace("_", "/").upper()
    if symbol in last_ticks:
        return last_ticks[symbol]
    return {"error": f"Symbol {symbol} not found"}


@app.get("/metrics", response_class=PlainTextResponse)
async def metrics():
    return generate_latest()
