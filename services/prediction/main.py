"""
Prediction Service - LSTM models for price prediction
"""
import asyncio
import json
import os
from datetime import datetime
from typing import Optional, List, Dict
from contextlib import asynccontextmanager

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
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
SEQUENCE_LENGTH = int(os.getenv("SEQUENCE_LENGTH", 60))
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", 0.6))
USE_GPU = os.getenv("USE_GPU", "true").lower() == "true"
TRADING_PAIRS = os.getenv("TRADING_PAIRS", "BTC/USDT,ETH/USDT,SOL/USDT").split(",")

logger = structlog.get_logger()
device = torch.device("cuda" if USE_GPU and torch.cuda.is_available() else "cpu")

# Metrics
PREDICTIONS_MADE = Counter("prediction_total", "Total predictions", ["symbol"])
PREDICTION_LATENCY = Histogram("prediction_latency_seconds", "Prediction latency")
MODEL_CONFIDENCE = Gauge("prediction_confidence", "Model confidence", ["symbol"])


class LSTMPredictor(nn.Module):
    def __init__(self, input_size=5, hidden_size=128, num_layers=2, dropout=0.2):
        super().__init__()
        self.lstm = nn.LSTM(input_size=input_size, hidden_size=hidden_size,
                           num_layers=num_layers, batch_first=True, dropout=dropout)
        self.fc = nn.Sequential(
            nn.Linear(hidden_size, 64), nn.ReLU(), nn.Dropout(dropout), nn.Linear(64, 3)
        )
        self.softmax = nn.Softmax(dim=1)

    def forward(self, x):
        lstm_out, _ = self.lstm(x)
        return self.softmax(self.fc(lstm_out[:, -1, :]))


class PredictionResponse(BaseModel):
    symbol: str
    timestamp: str
    direction: str
    confidence: float
    predicted_change_pct: float
    current_price: float


# Global State
redis_client: Optional[aioredis.Redis] = None
models: Dict[str, LSTMPredictor] = {}
price_history: Dict[str, List[dict]] = {}


def calculate_features(df: pd.DataFrame) -> np.ndarray:
    features = pd.DataFrame()
    features['price_norm'] = (df['close'] - df['close'].rolling(20).mean()) / (df['close'].rolling(20).std() + 1e-10)
    features['returns'] = df['close'].pct_change()
    features['volatility'] = df['close'].rolling(10).std() / (df['close'].rolling(10).mean() + 1e-10)
    features['volume_ratio'] = df['volume'] / (df['volume'].rolling(20).mean() + 1e-10)
    delta = df['close'].diff()
    gain = delta.where(delta > 0, 0).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    features['rsi'] = gain / (gain + loss + 1e-10)
    return features.fillna(0).values


async def make_prediction(symbol: str) -> Optional[PredictionResponse]:
    if symbol not in price_history or len(price_history[symbol]) < SEQUENCE_LENGTH:
        return None

    start_time = datetime.utcnow()

    df = pd.DataFrame(price_history[symbol][-SEQUENCE_LENGTH:])
    features = calculate_features(df)
    tensor = torch.FloatTensor(features).unsqueeze(0).to(device)

    if symbol not in models:
        models[symbol] = LSTMPredictor().to(device)
        models[symbol].eval()

    with torch.no_grad():
        probs = models[symbol](tensor).cpu().numpy()[0]

    directions = ["up", "down", "neutral"]
    direction_idx = np.argmax(probs)
    direction = directions[direction_idx]
    confidence = float(probs[direction_idx])
    current_price = price_history[symbol][-1].get("close", 0)

    predicted_change = 0.5 * confidence if direction == "up" else (-0.5 * confidence if direction == "down" else 0)

    PREDICTION_LATENCY.observe((datetime.utcnow() - start_time).total_seconds())
    PREDICTIONS_MADE.labels(symbol=symbol).inc()
    MODEL_CONFIDENCE.labels(symbol=symbol).set(confidence)

    response = PredictionResponse(
        symbol=symbol, timestamp=datetime.utcnow().isoformat(),
        direction=direction, confidence=confidence,
        predicted_change_pct=predicted_change, current_price=current_price
    )

    await redis_client.publish(f"predictions:{symbol.replace('/', '_')}", response.model_dump_json())
    logger.info("Prediction made", symbol=symbol, direction=direction, confidence=f"{confidence:.2%}")

    return response


async def collect_market_data():
    global price_history
    pubsub = redis_client.pubsub()
    channels = [f"ticks:{s.strip().replace('/', '_')}" for s in TRADING_PAIRS]
    await pubsub.subscribe(*channels)

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


async def prediction_loop():
    while True:
        await asyncio.sleep(60)
        for symbol in TRADING_PAIRS:
            try:
                await make_prediction(symbol.strip())
            except Exception as e:
                logger.error("Prediction failed", symbol=symbol, error=str(e))


@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client
    logger.info("Starting Prediction Service...", device=str(device))

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
    return {"status": "healthy", "device": str(device), "gpu": torch.cuda.is_available(),
            "symbols_tracked": len(price_history), "models_loaded": len(models)}


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
