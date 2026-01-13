"""
API Gateway - Central entry point for all services
"""
import os
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

import httpx
import redis.asyncio as aioredis
import structlog
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Configuration
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")

SERVICES = {
    "market_data": "http://market-data:8000",
    "prediction": "http://prediction:8000",
    "signal": "http://signal:8000",
    "risk": "http://risk:8000",
    "executor": "http://executor:8000",
    "position": "http://position:8000",
}

logger = structlog.get_logger()
redis_client: Optional[aioredis.Redis] = None
http_client: Optional[httpx.AsyncClient] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client, http_client
    logger.info("Starting API Gateway...")
    redis_client = aioredis.Redis(host=REDIS_HOST, port=REDIS_PORT, password=REDIS_PASSWORD, decode_responses=True)
    http_client = httpx.AsyncClient(timeout=30.0)
    yield
    if http_client:
        await http_client.aclose()
    if redis_client:
        await redis_client.close()


app = FastAPI(title="MangoCoco API Gateway", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.get("/status")
async def system_status():
    status = {}
    for name, url in SERVICES.items():
        try:
            response = await http_client.get(f"{url}/health", timeout=5.0)
            status[name] = {"healthy": response.status_code == 200, "response": response.json() if response.status_code == 200 else None}
        except Exception as e:
            status[name] = {"healthy": False, "error": str(e)}
    return {"timestamp": datetime.utcnow().isoformat(), "services": status}


@app.get("/api/tickers")
async def get_tickers():
    try:
        response = await http_client.get(f"{SERVICES['market_data']}/tickers")
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/ticker/{symbol}")
async def get_ticker(symbol: str):
    try:
        response = await http_client.get(f"{SERVICES['market_data']}/ticker/{symbol}")
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/portfolio")
async def get_portfolio():
    try:
        risk_resp = await http_client.get(f"{SERVICES['risk']}/portfolio")
        pos_resp = await http_client.get(f"{SERVICES['position']}/positions")
        pnl_resp = await http_client.get(f"{SERVICES['position']}/pnl")
        return {"portfolio": risk_resp.json(), "positions": pos_resp.json(), "pnl": pnl_resp.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/positions")
async def get_positions():
    try:
        response = await http_client.get(f"{SERVICES['position']}/positions")
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/balance")
async def get_balance():
    try:
        response = await http_client.get(f"{SERVICES['executor']}/balance")
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/predictions")
async def get_predictions():
    try:
        response = await http_client.get(f"{SERVICES['prediction']}/predictions")
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/api/predict/{symbol}")
async def predict(symbol: str):
    try:
        response = await http_client.post(f"{SERVICES['prediction']}/predict/{symbol}")
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/signals")
async def get_signals():
    try:
        response = await http_client.get(f"{SERVICES['signal']}/signals")
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/api/manual-trade")
async def manual_trade(symbol: str, action: str, amount: float):
    try:
        response = await http_client.post(f"{SERVICES['signal']}/manual-signal", params={"symbol": symbol, "action": action, "amount": amount})
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/risk/limits")
async def get_risk_limits():
    try:
        response = await http_client.get(f"{SERVICES['risk']}/limits")
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
