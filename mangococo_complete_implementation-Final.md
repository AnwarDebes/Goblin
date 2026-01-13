# MangoCoco Complete Implementation Plan

## Single Server Deployment - Crypto Trading Platform

---

## System Overview

MangoCoco is an AI-powered cryptocurrency trading platform that:
- Streams real-time prices from MEXC exchange
- Uses LSTM neural networks to predict price movements
- Generates trading signals based on predictions
- Executes trades automatically with risk management
- Provides a web dashboard for monitoring

**Target**: Trade BTC/USDT, ETH/USDT, SOL/USDT with $11 starting capital.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SINGLE SERVER                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Redis     │  │ TimescaleDB │  │      Prometheus         │  │
│  │  (pub/sub)  │  │ (time-series)│  │     (metrics)          │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────────────────┬─┘  │
│         │                │                                  │    │
│  ┌──────┴────────────────┴──────────────────────────────────┴─┐  │
│  │                    DOCKER NETWORK                          │  │
│  └──────┬────────────────┬──────────────────┬────────────────┘  │
│         │                │                  │                    │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌───────┴───────┐           │
│  │ Market Data │  │  Prediction │  │    Signal     │           │
│  │  (MEXC WS)  │  │  (LSTM/GPU) │  │  (Generator)  │           │
│  └─────────────┘  └─────────────┘  └───────────────┘           │
│         │                │                  │                    │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌───────┴───────┐           │
│  │    Risk     │  │  Executor   │  │   Position    │           │
│  │  (Validate) │  │  (Trading)  │  │   (Track)     │           │
│  └─────────────┘  └─────────────┘  └───────────────┘           │
│         │                                                        │
│  ┌──────┴─────────────────────────────────────────────────────┐  │
│  │              API Gateway + Web Dashboard                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
~/mangococo/
├── config/
│   ├── .env                    # Environment variables
│   ├── init-db.sql            # Database schema
│   └── prometheus.yml         # Monitoring config
├── services/
│   ├── market-data/           # Price streaming
│   ├── prediction/            # ML predictions
│   ├── signal/                # Signal generation
│   ├── risk/                  # Risk validation
│   ├── executor/              # Trade execution
│   ├── position/              # Position tracking
│   ├── api-gateway/           # Central API
│   └── dashboard/             # Web UI
├── shared/
│   ├── redis-data/            # Redis persistence
│   ├── timescale-data/        # Database storage
│   └── models/                # ML models
├── docker-compose.yml         # Container orchestration
└── logs/                      # Application logs
```

---

## Step 1: Create Project Structure

```bash
mkdir -p ~/mangococo
cd ~/mangococo

mkdir -p config
mkdir -p services/{market-data,prediction,signal,risk,executor,position,api-gateway,dashboard}
mkdir -p shared/{redis-data,timescale-data,models}
mkdir -p logs
```

---

## Step 2: Create Environment Configuration

Create file: `~/mangococo/config/.env`

```env
# ===========================================
# MangoCoco Configuration
# ===========================================

# Environment
ENVIRONMENT=production
LOG_LEVEL=INFO

# ===========================================
# MEXC CREDENTIALS - REPLACE THESE!
# ===========================================
MEXC_API_KEY=your_api_key_here
MEXC_SECRET_KEY=your_secret_key_here

# ===========================================
# DATABASE
# ===========================================
POSTGRES_HOST=timescaledb
POSTGRES_PORT=5432
POSTGRES_DB=mangococo
POSTGRES_USER=mangococo
POSTGRES_PASSWORD=<your_secure_postgres_password>

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<your_secure_redis_password>

# ===========================================
# TRADING CONFIGURATION
# ===========================================
TRADING_PAIRS=BTC/USDT,ETH/USDT,SOL/USDT
STARTING_CAPITAL=11.00

# Risk Limits
MAX_POSITION_PCT=0.50
MIN_POSITION_USD=1.00
MAX_DAILY_LOSS_PCT=0.20
MAX_TRADE_LOSS_PCT=0.05
MAX_OPEN_POSITIONS=2
MIN_TIME_BETWEEN_TRADES=60

# ML Configuration
SEQUENCE_LENGTH=60
PREDICTION_HORIZON=5
CONFIDENCE_THRESHOLD=0.6
USE_GPU=true
```

---

## Step 3: Create Database Schema

Create file: `~/mangococo/config/init-db.sql`

```sql
-- MangoCoco Database Schema
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Market Data
CREATE TABLE IF NOT EXISTS ticks (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    bid DECIMAL(20, 8),
    ask DECIMAL(20, 8),
    volume DECIMAL(20, 8),
    PRIMARY KEY (time, symbol)
);
SELECT create_hypertable('ticks', 'time', if_not_exists => TRUE);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    order_id VARCHAR(100) UNIQUE NOT NULL,
    exchange_order_id VARCHAR(100),
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(4) NOT NULL,
    order_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    price DECIMAL(20, 8),
    amount DECIMAL(20, 8) NOT NULL,
    filled DECIMAL(20, 8) DEFAULT 0,
    cost DECIMAL(20, 8) DEFAULT 0,
    fee DECIMAL(20, 8) DEFAULT 0
);

-- Positions
CREATE TABLE IF NOT EXISTS positions (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(5) NOT NULL,
    entry_price DECIMAL(20, 8) NOT NULL,
    current_price DECIMAL(20, 8),
    amount DECIMAL(20, 8) NOT NULL,
    unrealized_pnl DECIMAL(20, 8) DEFAULT 0,
    realized_pnl DECIMAL(20, 8) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'open'
);

-- Signals
CREATE TABLE IF NOT EXISTS signals (
    time TIMESTAMPTZ NOT NULL,
    signal_id VARCHAR(100) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    action VARCHAR(10) NOT NULL,
    confidence DECIMAL(5, 4) NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    executed BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (time, signal_id)
);
SELECT create_hypertable('signals', 'time', if_not_exists => TRUE);

-- Portfolio
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    time TIMESTAMPTZ NOT NULL PRIMARY KEY,
    total_value DECIMAL(20, 8) NOT NULL,
    cash_balance DECIMAL(20, 8) NOT NULL,
    positions_value DECIMAL(20, 8) NOT NULL,
    daily_pnl DECIMAL(20, 8) NOT NULL
);
SELECT create_hypertable('portfolio_snapshots', 'time', if_not_exists => TRUE);

-- Initial portfolio
INSERT INTO portfolio_snapshots (time, total_value, cash_balance, positions_value, daily_pnl)
VALUES (NOW(), 11.00, 11.00, 0, 0) ON CONFLICT DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_ticks_symbol_time ON ticks(symbol, time DESC);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mangococo;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mangococo;
```

---

## Step 4: Create Prometheus Configuration

Create file: `~/mangococo/config/prometheus.yml`

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'market-data'
    static_configs:
      - targets: ['market-data:8000']
  
  - job_name: 'prediction'
    static_configs:
      - targets: ['prediction:8000']
  
  - job_name: 'signal'
    static_configs:
      - targets: ['signal:8000']
  
  - job_name: 'risk'
    static_configs:
      - targets: ['risk:8000']
  
  - job_name: 'executor'
    static_configs:
      - targets: ['executor:8000']
  
  - job_name: 'position'
    static_configs:
      - targets: ['position:8000']
  
  - job_name: 'api-gateway'
    static_configs:
      - targets: ['api-gateway:8000']
```

---

## Step 5: Create Market Data Service

### 5.1 Dockerfile

Create file: `~/mangococo/services/market-data/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y gcc curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 5.2 Requirements

Create file: `~/mangococo/services/market-data/requirements.txt`

```
fastapi==0.109.0
uvicorn[standard]==0.27.0
pydantic==2.5.3
pydantic-settings==2.1.0
ccxt==4.2.19
redis==5.0.1
structlog==24.1.0
python-dotenv==1.0.0
prometheus-client==0.19.0
orjson==3.9.10
```

### 5.3 Main Application

Create file: `~/mangococo/services/market-data/main.py`

```python
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
```

---

## Step 6: Create Prediction Service

### 6.1 Dockerfile

Create file: `~/mangococo/services/prediction/Dockerfile`

```dockerfile
FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime

WORKDIR /app

RUN apt-get update && apt-get install -y gcc curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/models

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 6.2 Requirements

Create file: `~/mangococo/services/prediction/requirements.txt`

```
fastapi==0.109.0
uvicorn[standard]==0.27.0
pydantic==2.5.3
redis==5.0.1
pandas==2.1.4
numpy==1.26.3
scikit-learn==1.4.0
ta==0.11.0
structlog==24.1.0
python-dotenv==1.0.0
prometheus-client==0.19.0
```

### 6.3 Main Application

Create file: `~/mangococo/services/prediction/main.py`

```python
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
```

---

## Step 7: Create Signal Service

### 7.1 Dockerfile

Create file: `~/mangococo/services/signal/Dockerfile`

```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y gcc curl && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 7.2 Requirements

Create file: `~/mangococo/services/signal/requirements.txt`

```
fastapi==0.109.0
uvicorn[standard]==0.27.0
pydantic==2.5.3
redis==5.0.1
structlog==24.1.0
python-dotenv==1.0.0
prometheus-client==0.19.0
```

### 7.3 Main Application

Create file: `~/mangococo/services/signal/main.py`

```python
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
```

---

## Step 8: Create Risk Service

### 8.1 Dockerfile

Create file: `~/mangococo/services/risk/Dockerfile`

```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y gcc curl && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 8.2 Requirements

Create file: `~/mangococo/services/risk/requirements.txt`

```
fastapi==0.109.0
uvicorn[standard]==0.27.0
pydantic==2.5.3
redis==5.0.1
structlog==24.1.0
python-dotenv==1.0.0
prometheus-client==0.19.0
```

### 8.3 Main Application

Create file: `~/mangococo/services/risk/main.py`

```python
"""
Risk Manager Service - Validates all trading signals
"""
import asyncio
import json
import os
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
import structlog
from fastapi import FastAPI
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from prometheus_client import Counter, Gauge, generate_latest

# Configuration
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")
STARTING_CAPITAL = float(os.getenv("STARTING_CAPITAL", 11.0))
MAX_POSITION_PCT = float(os.getenv("MAX_POSITION_PCT", 0.50))
MIN_POSITION_USD = float(os.getenv("MIN_POSITION_USD", 1.0))
MAX_DAILY_LOSS_PCT = float(os.getenv("MAX_DAILY_LOSS_PCT", 0.20))
MAX_OPEN_POSITIONS = int(os.getenv("MAX_OPEN_POSITIONS", 2))
MIN_TIME_BETWEEN_TRADES = int(os.getenv("MIN_TIME_BETWEEN_TRADES", 60))

logger = structlog.get_logger()

# Metrics
SIGNALS_RECEIVED = Counter("risk_signals_received_total", "Signals received")
SIGNALS_APPROVED = Counter("risk_signals_approved_total", "Signals approved")
SIGNALS_REJECTED = Counter("risk_signals_rejected_total", "Signals rejected", ["reason"])
CAPITAL = Gauge("risk_available_capital", "Available capital")


class Signal(BaseModel):
    signal_id: str
    symbol: str
    action: str = Field(..., pattern="^(buy|sell)$")
    amount: float
    price: float
    confidence: float = 0.5


class Portfolio(BaseModel):
    total_capital: float = STARTING_CAPITAL
    available_capital: float = STARTING_CAPITAL
    daily_pnl: float = 0.0
    open_positions: int = 0
    last_trade_time: Optional[str] = None


# Global State
redis_client: Optional[aioredis.Redis] = None
portfolio = Portfolio()


async def validate_signal(signal: Signal) -> tuple[bool, str, float]:
    global portfolio
    
    # Check daily loss limit
    if portfolio.daily_pnl <= -(STARTING_CAPITAL * MAX_DAILY_LOSS_PCT):
        return False, "daily_loss_limit_reached", 0
    
    # Check max positions (buys only)
    if signal.action == "buy" and portfolio.open_positions >= MAX_OPEN_POSITIONS:
        return False, "max_positions_reached", 0
    
    # Check time between trades
    if portfolio.last_trade_time:
        seconds_since = (datetime.utcnow() - datetime.fromisoformat(portfolio.last_trade_time)).total_seconds()
        if seconds_since < MIN_TIME_BETWEEN_TRADES:
            return False, f"too_soon_wait_{int(MIN_TIME_BETWEEN_TRADES - seconds_since)}s", 0
    
    # Check position size
    trade_value = signal.amount * signal.price
    max_position = portfolio.available_capital * MAX_POSITION_PCT
    
    if trade_value < MIN_POSITION_USD:
        return False, "below_minimum_position", 0
    
    adjusted_amount = signal.amount
    if trade_value > max_position:
        adjusted_amount = max_position / signal.price
    
    if adjusted_amount * signal.price > portfolio.available_capital:
        return False, "insufficient_capital", 0
    
    return True, "approved", adjusted_amount


async def process_signal(signal_data: dict):
    global portfolio
    SIGNALS_RECEIVED.inc()
    
    try:
        signal = Signal(**signal_data)
        approved, reason, adjusted_amount = await validate_signal(signal)
        
        if approved:
            SIGNALS_APPROVED.inc()
            validated = signal_data.copy()
            validated["amount"] = adjusted_amount
            await redis_client.publish("validated_signals", json.dumps(validated))
            portfolio.last_trade_time = datetime.utcnow().isoformat()
            await save_portfolio()
            logger.info("Signal approved", signal_id=signal.signal_id)
        else:
            SIGNALS_REJECTED.labels(reason=reason).inc()
            logger.warning("Signal rejected", signal_id=signal.signal_id, reason=reason)
    except Exception as e:
        logger.error("Error processing signal", error=str(e))


async def listen_for_signals():
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("raw_signals")
    async for message in pubsub.listen():
        if message["type"] == "message":
            await process_signal(json.loads(message["data"]))


async def load_portfolio():
    global portfolio
    data = await redis_client.get("portfolio_state")
    if data:
        portfolio = Portfolio(**json.loads(data))
    CAPITAL.set(portfolio.available_capital)


async def save_portfolio():
    await redis_client.set("portfolio_state", portfolio.model_dump_json())
    CAPITAL.set(portfolio.available_capital)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client
    logger.info("Starting Risk Manager Service...")
    
    redis_client = aioredis.Redis(host=REDIS_HOST, port=REDIS_PORT, password=REDIS_PASSWORD, decode_responses=True)
    await redis_client.ping()
    await load_portfolio()
    
    listener_task = asyncio.create_task(listen_for_signals())
    
    yield
    
    listener_task.cancel()
    if redis_client:
        await redis_client.close()


app = FastAPI(title="Risk Manager Service", version="1.0.0", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "healthy", "capital": portfolio.available_capital}


@app.get("/portfolio")
async def get_portfolio():
    return portfolio


@app.get("/limits")
async def get_limits():
    return {"max_position_pct": MAX_POSITION_PCT, "min_position_usd": MIN_POSITION_USD,
            "max_daily_loss_pct": MAX_DAILY_LOSS_PCT, "max_open_positions": MAX_OPEN_POSITIONS}


@app.post("/update-capital")
async def update_capital(amount: float):
    global portfolio
    portfolio.available_capital = amount
    await save_portfolio()
    return {"available_capital": portfolio.available_capital}


@app.post("/position-opened")
async def position_opened():
    global portfolio
    portfolio.open_positions += 1
    await save_portfolio()
    return {"open_positions": portfolio.open_positions}


@app.post("/position-closed")
async def position_closed(pnl: float = 0):
    global portfolio
    portfolio.open_positions = max(0, portfolio.open_positions - 1)
    portfolio.daily_pnl += pnl
    await save_portfolio()
    return {"open_positions": portfolio.open_positions, "daily_pnl": portfolio.daily_pnl}


@app.get("/metrics", response_class=PlainTextResponse)
async def metrics():
    return generate_latest()
```

---

## Step 9: Create Executor Service

### 9.1 Dockerfile

Create file: `~/mangococo/services/executor/Dockerfile`

```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y gcc curl && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 9.2 Requirements

Create file: `~/mangococo/services/executor/requirements.txt`

```
fastapi==0.109.0
uvicorn[standard]==0.27.0
pydantic==2.5.3
ccxt==4.2.19
redis==5.0.1
structlog==24.1.0
python-dotenv==1.0.0
prometheus-client==0.19.0
```

### 9.3 Main Application

Create file: `~/mangococo/services/executor/main.py`

```python
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
```

---

## Step 10: Create Position Service

### 10.1 Dockerfile

Create file: `~/mangococo/services/position/Dockerfile`

```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y gcc curl && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 10.2 Requirements

Create file: `~/mangococo/services/position/requirements.txt`

```
fastapi==0.109.0
uvicorn[standard]==0.27.0
pydantic==2.5.3
redis==5.0.1
structlog==24.1.0
python-dotenv==1.0.0
prometheus-client==0.19.0
```

### 10.3 Main Application

Create file: `~/mangococo/services/position/main.py`

```python
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
```

---

## Step 11: Create API Gateway

### 11.1 Dockerfile

Create file: `~/mangococo/services/api-gateway/Dockerfile`

```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y gcc curl && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 11.2 Requirements

Create file: `~/mangococo/services/api-gateway/requirements.txt`

```
fastapi==0.109.0
uvicorn[standard]==0.27.0
httpx==0.26.0
pydantic==2.5.3
redis==5.0.1
structlog==24.1.0
python-dotenv==1.0.0
```

### 11.3 Main Application

Create file: `~/mangococo/services/api-gateway/main.py`

```python
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
```

---

## Step 12: Create Dashboard

### 12.1 Dockerfile

Create file: `~/mangococo/services/dashboard/Dockerfile`

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 12.2 package.json

Create file: `~/mangococo/services/dashboard/package.json`

```json
{
  "name": "mangococo-dashboard",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "recharts": "^2.10.3"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.2.2",
    "vite": "^5.0.8"
  }
}
```

### 12.3 Config Files

Create file: `~/mangococo/services/dashboard/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
```

Create file: `~/mangococo/services/dashboard/vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://api-gateway:8000', '/status': 'http://api-gateway:8000' } }
})
```

Create file: `~/mangococo/services/dashboard/tailwind.config.js`

```javascript
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

Create file: `~/mangococo/services/dashboard/postcss.config.js`

```javascript
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
}
```

Create file: `~/mangococo/services/dashboard/nginx.conf`

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://api-gateway:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /status {
        proxy_pass http://api-gateway:8000;
    }
}
```

### 12.4 HTML and Source Files

Create file: `~/mangococo/services/dashboard/index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MangoCoco Trading</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create directory: `~/mangococo/services/dashboard/src`

Create file: `~/mangococo/services/dashboard/src/main.tsx`

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
)
```

Create file: `~/mangococo/services/dashboard/src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #0f172a;
  color: #e2e8f0;
}
```

Create file: `~/mangococo/services/dashboard/src/App.tsx`

```tsx
import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Ticker { symbol: string; price: number; change_pct: number }
interface Position { symbol: string; side: string; entry_price: number; current_price: number; amount: number; unrealized_pnl: number }
interface Portfolio { total_capital: number; available_capital: number; daily_pnl: number; open_positions: number }

function App() {
  const [tickers, setTickers] = useState<Record<string, Ticker>>({})
  const [positions, setPositions] = useState<Record<string, Position>>({})
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [priceHistory, setPriceHistory] = useState<any[]>([])
  const [status, setStatus] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      const [tickerRes, portfolioRes, statusRes] = await Promise.all([
        fetch('/api/tickers'), fetch('/api/portfolio'), fetch('/status')
      ])
      if (tickerRes.ok) setTickers(await tickerRes.json())
      if (portfolioRes.ok) {
        const data = await portfolioRes.json()
        setPortfolio(data.portfolio)
        setPositions(data.positions || {})
      }
      if (statusRes.ok) setStatus(await statusRes.json())
      setError(null)
    } catch { setError('Failed to fetch data') }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const btc = tickers['BTC/USDT']
    if (btc) {
      setPriceHistory(prev => [...prev, { time: new Date().toLocaleTimeString(), price: btc.price }].slice(-30))
    }
  }, [tickers])

  return (
    <div className="min-h-screen p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-emerald-400">🥭 MangoCoco Trading</h1>
        <p className="text-slate-400">AI-Powered Crypto Trading Dashboard</p>
      </header>

      {error && <div className="bg-red-900/50 border border-red-500 rounded p-4 mb-6">{error}</div>}

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Total Capital</p>
          <p className="text-2xl font-bold">${portfolio?.total_capital?.toFixed(2) || '0.00'}</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Available</p>
          <p className="text-2xl font-bold">${portfolio?.available_capital?.toFixed(2) || '0.00'}</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Daily P&L</p>
          <p className={`text-2xl font-bold ${(portfolio?.daily_pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            ${portfolio?.daily_pnl?.toFixed(2) || '0.00'}
          </p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Open Positions</p>
          <p className="text-2xl font-bold">{portfolio?.open_positions || 0}</p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-4 mb-8">
        <h2 className="text-xl font-semibold mb-4">BTC/USDT Price</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={priceHistory}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="time" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" domain={['auto', 'auto']} />
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
            <Line type="monotone" dataKey="price" stroke="#10b981" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {Object.entries(tickers).map(([symbol, ticker]) => (
          <div key={symbol} className="bg-slate-800 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold">{symbol}</span>
              <span className={ticker.change_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {ticker.change_pct >= 0 ? '+' : ''}{ticker.change_pct?.toFixed(2)}%
              </span>
            </div>
            <p className="text-2xl font-bold mt-2">${ticker.price?.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {Object.keys(positions).length > 0 && (
        <div className="bg-slate-800 rounded-lg p-4 mb-8">
          <h2 className="text-xl font-semibold mb-4">Open Positions</h2>
          <table className="w-full">
            <thead>
              <tr className="text-slate-400 text-left">
                <th className="pb-2">Symbol</th><th className="pb-2">Side</th><th className="pb-2">Entry</th>
                <th className="pb-2">Current</th><th className="pb-2">Amount</th><th className="pb-2">P&L</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(positions).map(([symbol, pos]) => (
                <tr key={symbol}>
                  <td className="py-2">{pos.symbol}</td>
                  <td className={pos.side === 'long' ? 'text-emerald-400' : 'text-red-400'}>{pos.side.toUpperCase()}</td>
                  <td>${pos.entry_price?.toFixed(2)}</td>
                  <td>${pos.current_price?.toFixed(2)}</td>
                  <td>{pos.amount?.toFixed(6)}</td>
                  <td className={pos.unrealized_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>${pos.unrealized_pnl?.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {status && (
        <div className="bg-slate-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">System Status</h2>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(status.services || {}).map(([name, data]: [string, any]) => (
              <div key={name} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${data.healthy ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                <span className="capitalize">{name.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
```

---

## Step 13: Create Docker Compose

Create file: `~/mangococo/docker-compose.yml`

```yaml
version: '3.8'

services:
  # Infrastructure
  redis:
    image: redis:7-alpine
    container_name: mc-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports:
      - "6379:6379"
    volumes:
      - ./shared/redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  timescaledb:
    image: timescale/timescaledb:latest-pg15
    container_name: mc-timescaledb
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - ./shared/timescale-data:/var/lib/postgresql/data
      - ./config/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Trading Services
  market-data:
    build: ./services/market-data
    container_name: mc-market-data
    restart: unless-stopped
    env_file: ./config/.env
    ports:
      - "8001:8000"
    depends_on:
      redis:
        condition: service_healthy

  prediction:
    build: ./services/prediction
    container_name: mc-prediction
    restart: unless-stopped
    env_file: ./config/.env
    ports:
      - "8002:8000"
    volumes:
      - ./shared/models:/app/models
    depends_on:
      redis:
        condition: service_healthy
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  signal:
    build: ./services/signal
    container_name: mc-signal
    restart: unless-stopped
    env_file: ./config/.env
    ports:
      - "8003:8000"
    depends_on:
      redis:
        condition: service_healthy

  risk:
    build: ./services/risk
    container_name: mc-risk
    restart: unless-stopped
    env_file: ./config/.env
    ports:
      - "8004:8000"
    depends_on:
      redis:
        condition: service_healthy

  executor:
    build: ./services/executor
    container_name: mc-executor
    restart: unless-stopped
    env_file: ./config/.env
    ports:
      - "8005:8000"
    depends_on:
      redis:
        condition: service_healthy

  position:
    build: ./services/position
    container_name: mc-position
    restart: unless-stopped
    env_file: ./config/.env
    ports:
      - "8006:8000"
    depends_on:
      redis:
        condition: service_healthy

  api-gateway:
    build: ./services/api-gateway
    container_name: mc-api-gateway
    restart: unless-stopped
    env_file: ./config/.env
    ports:
      - "8080:8000"
    depends_on:
      - market-data
      - prediction
      - signal
      - risk
      - executor
      - position

  dashboard:
    build: ./services/dashboard
    container_name: mc-dashboard
    restart: unless-stopped
    ports:
      - "3000:80"
    depends_on:
      - api-gateway

  # Monitoring
  prometheus:
    image: prom/prometheus:latest
    container_name: mc-prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./config/prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:latest
    container_name: mc-grafana
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

---

## Step 14: Deployment Commands

```bash
cd ~/mangococo

# Build and start everything
docker compose up -d --build

# Check status
docker compose ps

# View logs
docker compose logs -f

# View specific service
docker compose logs -f market-data
```

---

## Verification

After deployment, test these URLs:

| Service | URL |
|---------|-----|
| Dashboard | http://YOUR_IP:3000 |
| API Docs | http://YOUR_IP:8080/docs |
| System Status | http://YOUR_IP:8080/status |
| Prometheus | http://YOUR_IP:9090 |
| Grafana | http://YOUR_IP:3001 |

---

## Service Ports Reference

| Service | Port |
|---------|------|
| Redis | 6379 |
| TimescaleDB | 5432 |
| Market Data | 8001 |
| Prediction | 8002 |
| Signal | 8003 |
| Risk | 8004 |
| Executor | 8005 |
| Position | 8006 |
| API Gateway | 8080 |
| Dashboard | 3000 |
| Prometheus | 9090 |
| Grafana | 3001 |
