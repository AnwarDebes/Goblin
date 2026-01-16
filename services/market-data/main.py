"""
Market Data Service - Streams real-time prices from MEXC
"""
import asyncio
import json
import os
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

import ccxt
import redis.asyncio as aioredis
import structlog
from fastapi import FastAPI
from fastapi.responses import PlainTextResponse
from prometheus_client import Counter, Gauge, generate_latest

# Configuration
MEXC_API_KEY = os.getenv("MEXC_API_KEY", "")
MEXC_SECRET_KEY = os.getenv("MEXC_SECRET_KEY", "")
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")  # Use localhost when using host network mode
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")
TRADING_PAIRS = os.getenv("TRADING_PAIRS", "BTC/USDT,ETH/USDT,SOL/USDT").split(",")

logger = structlog.get_logger()

# Metrics
TICKS_RECEIVED = Counter("market_data_ticks_total", "Total ticks received", ["symbol"])
WS_CONNECTED = Gauge("market_data_ws_connected", "WebSocket connection status")
LAST_PRICE = Gauge("market_data_last_price", "Last price", ["symbol"])

# Global State
exchange: Optional[ccxt.mexc] = None
redis_client: Optional[aioredis.Redis] = None
is_connected = False
last_ticks = {}
polling_task = None


async def process_ticker(symbol: str, ticker: dict):
    """Process individual ticker data efficiently"""
    tick_data = {
        "symbol": symbol,
        "timestamp": datetime.utcnow().isoformat(),
        "price": float(ticker.get("last", 0)),
        "bid": float(ticker.get("bid", 0)),
        "ask": float(ticker.get("ask", 0)),
        "volume": float(ticker.get("quoteVolume", 0)),
        "change_pct": float(ticker.get("percentage", 0)),
    }

    # Store in Redis with optimized operations for high volume
    await redis_client.hset("latest_ticks", symbol, json.dumps(tick_data))

    # Publish to Redis pubsub for real-time updates (only for active trading pairs to reduce noise)
    if symbol in TRADING_PAIRS:  # Only publish for our trading pairs
        await redis_client.publish(f"ticks:{symbol.replace('/', '_')}", json.dumps(tick_data))

    TICKS_RECEIVED.labels(symbol=symbol).inc()
    LAST_PRICE.labels(symbol=symbol).set(tick_data["price"])


async def poll_market_data():
    """Poll ticker data from MEXC REST API - optimized for 200+ coins"""
    global is_connected, last_ticks, exchange

    symbols = [s.strip() for s in TRADING_PAIRS]
    logger.info(f"Starting market data polling for {len(symbols)} coins - high volume mode")

    while True:
        try:
            is_connected = True
            WS_CONNECTED.set(1)

            # Poll tickers in optimized batches to handle 200+ coins efficiently
            batch_size = 50  # Process 50 coins per batch
            poll_start = datetime.utcnow()

            for i in range(0, len(symbols), batch_size):
                batch_symbols = symbols[i:i + batch_size]
                try:
                    # Fetch multiple tickers at once if supported, otherwise individually
                    if hasattr(exchange, 'fetch_tickers'):
                        try:
                            tickers = exchange.fetch_tickers(batch_symbols)
                            for symbol, ticker in tickers.items():
                                await process_ticker(symbol, ticker)
                        except:
                            # Fallback to individual fetching
                            for symbol in batch_symbols:
                                try:
                                    ticker = exchange.fetch_ticker(symbol)
                                    await process_ticker(symbol, ticker)
                                    await asyncio.sleep(0.01)  # Small delay to avoid rate limits
                                except Exception as e:
                                    logger.debug(f"Failed to fetch {symbol}", error=str(e))
                    else:
                        # Individual fetching with rate limiting
                        for symbol in batch_symbols:
                            try:
                                ticker = exchange.fetch_ticker(symbol)
                                await process_ticker(symbol, ticker)
                                await asyncio.sleep(0.01)  # Small delay between requests
                            except Exception as e:
                                logger.debug(f"Failed to fetch {symbol}", error=str(e))

                except Exception as e:
                    logger.error(f"Batch processing failed for batch {i//batch_size + 1}", error=str(e))

            # Performance monitoring
            poll_duration = (datetime.utcnow() - poll_start).total_seconds()
            logger.info(f"Market data poll completed: {len(symbols)} coins in {poll_duration:.2f}s ({len(symbols)/poll_duration:.1f} coins/sec)")

            # Wait before next poll - faster for high-volume scanning
            await asyncio.sleep(1.0)  # Poll every 1 second for 200+ coins

        except Exception as e:
            is_connected = False
            WS_CONNECTED.set(0)
            logger.error("Market data polling error", error=str(e))
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

    # Use MEXC exchange without API keys for public market data
    exchange = ccxt.mexc({
        "enableRateLimit": True,
    })
    logger.info("MEXC exchange initialized (REST mode)")

    polling_task = asyncio.create_task(poll_market_data())

    yield

    if polling_task:
        polling_task.cancel()
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
