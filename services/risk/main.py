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
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")
STARTING_CAPITAL = float(os.getenv("STARTING_CAPITAL", 1000.0))
MAX_POSITION_PCT = float(os.getenv("MAX_POSITION_PCT", 0.25))
MIN_POSITION_USD = float(os.getenv("MIN_POSITION_USD", 5.0))
MAX_DAILY_LOSS_PCT = float(os.getenv("MAX_DAILY_LOSS_PCT", 0.10))
# MAX_OPEN_POSITIONS removed — the system dynamically limits positions based on
# available capital, MIN_POSITION_USD, and confidence.  No artificial cap.
MIN_TIME_BETWEEN_TRADES = int(os.getenv("MIN_TIME_BETWEEN_TRADES", 120))  # 2min: balances trade frequency with diversity across 500+ symbols
# Legacy exit parameters — NO LONGER USED by position manager (AI controls exits).
# Kept here only so the risk_parameters Redis key doesn't break other services that read it.
PROFIT_TARGET_PCT = float(os.getenv("PROFIT_TARGET_PCT", 0.001))
MAX_TRADE_LOSS_PCT = float(os.getenv("MAX_TRADE_LOSS_PCT", 0.005))
MAX_HOLD_TIME_MINUTES = float(os.getenv("MAX_HOLD_TIME_MINUTES", 30))

logger = structlog.get_logger()

# Metrics
SIGNALS_RECEIVED = Counter("risk_signals_received_total", "Signals received")
SIGNALS_APPROVED = Counter("risk_signals_approved_total", "Signals approved")
SIGNALS_REJECTED = Counter("risk_signals_rejected_total", "Signals rejected", ["reason"])
CAPITAL = Gauge("risk_available_capital", "Available capital")


class Signal(BaseModel):
    signal_id: str
    symbol: str
    action: str
    amount: float
    price: float
    confidence: float = 0.5
    edge_score: float = 0.0
    side: str = "long"
    regime: str = ""
    timestamp: str = ""
    vol_ratio: float = 1.0
    reason: str = ""


class Portfolio(BaseModel):
    total_capital: float = STARTING_CAPITAL
    available_capital: float = STARTING_CAPITAL
    starting_capital: float = STARTING_CAPITAL
    daily_pnl: float = 0.0
    open_positions: int = 0
    last_trade_time: Optional[str] = None


# Global State
redis_client: Optional[aioredis.Redis] = None
portfolio = Portfolio()


async def validate_signal(signal: Signal) -> tuple[bool, str, float]:
    global portfolio

    # Sells/exits bypass ALL risk limits — they must execute in full
    if signal.action in ("sell", "short_exit"):
        return True, "approved", signal.amount

    # Check daily loss limit (buys only)
    if portfolio.daily_pnl <= -(STARTING_CAPITAL * MAX_DAILY_LOSS_PCT):
        return False, "daily_loss_limit_reached", 0

    # Dynamic position limit: reject if remaining capital can't fund a minimum-sized position
    if signal.action == "buy":
        remaining_after = portfolio.available_capital - signal.amount
        if remaining_after < MIN_POSITION_USD * 0.5:
            return False, "insufficient_capital_for_new_positions", 0

    # Check time between trades (buys only)
    if portfolio.last_trade_time:
        seconds_since = (datetime.utcnow() - datetime.fromisoformat(portfolio.last_trade_time)).total_seconds()
        if seconds_since < MIN_TIME_BETWEEN_TRADES:
            return False, f"too_soon_wait_{int(MIN_TIME_BETWEEN_TRADES - seconds_since)}s", 0

    # Check position size (buys only)
    # signal.amount is USDT value (e.g. $1.50) for buys
    trade_value = signal.amount

    max_position = portfolio.available_capital * MAX_POSITION_PCT

    if trade_value < MIN_POSITION_USD:
        return False, "below_minimum_position", 0

    adjusted_amount = signal.amount
    if trade_value > max_position:
        adjusted_amount = max_position  # Cap USDT amount

    if adjusted_amount > portfolio.available_capital:
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
            # Only update cooldown timer for new entries (buys/shorts), not exits
            if signal.action in ("buy", "short_entry"):
                portfolio.last_trade_time = datetime.utcnow().isoformat()
            await save_portfolio()
            logger.info("Signal approved", signal_id=signal.signal_id,
                         symbol=signal.symbol, action=signal.action,
                         edge_score=round(signal.edge_score, 3),
                         confidence=round(signal.confidence, 3))
        else:
            SIGNALS_REJECTED.labels(reason=reason).inc()
            logger.warning("Signal rejected", signal_id=signal.signal_id, reason=reason)
    except Exception as e:
        logger.error("Error processing signal", error=str(e))


# ── Signal Ranking Buffer ─────────────────────────────────────────────
# Instead of FIFO processing (which picks alphabetically-first signals),
# buffer all incoming signals for a window and pick the BEST one by
# edge_score and confidence. This ensures the system always trades the
# highest-conviction opportunity.
SIGNAL_BUFFER_WINDOW_S = float(os.getenv("SIGNAL_BUFFER_WINDOW_S", 20))  # collect signals for 20s then pick best
_signal_buffer: list = []
_buffer_lock = asyncio.Lock()
_buffer_flush_event = asyncio.Event()


async def _collect_signals():
    """Collect raw signals into the buffer continuously."""
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("raw_signals")
    async for message in pubsub.listen():
        if message["type"] == "message":
            try:
                signal_data = json.loads(message["data"])
                async with _buffer_lock:
                    _signal_buffer.append(signal_data)
                SIGNALS_RECEIVED.inc()
            except Exception as e:
                logger.error("Error buffering signal", error=str(e))


async def _flush_buffer():
    """Periodically flush the buffer: sort by quality and process the best signal."""
    while True:
        await asyncio.sleep(SIGNAL_BUFFER_WINDOW_S)

        async with _buffer_lock:
            if not _signal_buffer:
                continue
            batch = list(_signal_buffer)
            _signal_buffer.clear()

        # Separate sells (must execute immediately) from buy entries
        sells = [s for s in batch if s.get("action") in ("sell", "short_exit")]
        buys = [s for s in batch if s.get("action") not in ("sell", "short_exit")]

        # Process ALL sell signals immediately (position exits are critical)
        for sell_signal in sells:
            await process_signal(sell_signal)

        if not buys:
            continue

        # Rank buy signals by edge_score (primary) and confidence (secondary)
        buys.sort(key=lambda s: (
            float(s.get("edge_score", 0)),
            float(s.get("confidence", 0)),
        ), reverse=True)

        # Log what we're choosing from
        if len(buys) > 1:
            best = buys[0]
            worst = buys[-1]
            logger.info("Signal ranker: picking best from buffer",
                         buffer_size=len(buys),
                         best_symbol=best.get("symbol"),
                         best_edge=round(float(best.get("edge_score", 0)), 3),
                         best_confidence=round(float(best.get("confidence", 0)), 3),
                         worst_symbol=worst.get("symbol"),
                         worst_edge=round(float(worst.get("edge_score", 0)), 3))

        # Process signals in ranked order (best first)
        # The validate_signal function handles cooldown/capital checks
        for signal_data in buys:
            await process_signal(signal_data)


async def listen_for_signals():
    """Start both the collector and the periodic flusher."""
    await asyncio.gather(
        _collect_signals(),
        _flush_buffer(),
    )


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
    
    # Store risk parameters in Redis for position service to use
    risk_parameters = {
        "PROFIT_TARGET_PCT": PROFIT_TARGET_PCT,
        "MAX_TRADE_LOSS_PCT": MAX_TRADE_LOSS_PCT,
        "MAX_HOLD_TIME_MINUTES": MAX_HOLD_TIME_MINUTES,
        "MAX_POSITION_PCT": MAX_POSITION_PCT,
        "MIN_POSITION_USD": MIN_POSITION_USD,
        "MAX_DAILY_LOSS_PCT": MAX_DAILY_LOSS_PCT,
        "MAX_OPEN_POSITIONS": "dynamic",
        "MIN_TIME_BETWEEN_TRADES": MIN_TIME_BETWEEN_TRADES
    }
    await redis_client.set("risk_parameters", json.dumps(risk_parameters))
    logger.info("Risk parameters stored in Redis", parameters=risk_parameters)

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
    """Automatically calculate portfolio from positions and MEXC balance"""
    # Load current portfolio state from Redis (updated by executor/position services)
    portfolio_state_str = await redis_client.get("portfolio_state")
    if portfolio_state_str:
        portfolio_data = json.loads(portfolio_state_str)
        # Update local portfolio object from executor-synced state (authoritative)
        portfolio.available_capital = portfolio_data.get("available_capital", portfolio.available_capital)
        portfolio.total_capital = portfolio_data.get("total_capital", portfolio.total_capital)
        portfolio.open_positions = portfolio_data.get("open_positions", 0)
        portfolio.daily_pnl = portfolio_data.get("daily_pnl", 0.0)
        portfolio.last_trade_time = portfolio_data.get("last_trade_time", portfolio.last_trade_time)
    
    return portfolio


@app.get("/limits")
async def get_limits():
    return {"max_position_pct": MAX_POSITION_PCT, "min_position_usd": MIN_POSITION_USD,
            "max_daily_loss_pct": MAX_DAILY_LOSS_PCT, "max_open_positions": "dynamic"}


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
