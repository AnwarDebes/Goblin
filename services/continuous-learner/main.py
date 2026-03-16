"""
Goblin Continuous Learner — Reinforcement Learning & Online Training Service.

Runs as a persistent background service that:
1. Continuously collects new market data from TimescaleDB
2. Tracks prediction outcomes (reward signals)
3. Performs incremental RL-weighted training on both TCN and XGBoost
4. Hot-swaps model files so the prediction service picks up improvements
5. Logs training metrics to Redis for the AI Nerve Monitor

The key RL mechanism:
- Each prediction is recorded with its timestamp and features
- After the outcome window (N candles), the actual price direction is observed
- Reward = +1 (correct direction), -1 (wrong direction), 0 (neutral/hold correct)
- Training samples are weighted by cumulative reward history
- TCN uses policy-gradient-style loss weighting
- XGBoost uses sample_weight parameter for reward-biased training
"""

import asyncio
import json
import os
import sys
import time
import signal
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import asyncpg
import numpy as np
import pandas as pd
import redis.asyncio as aioredis
import structlog

logger = structlog.get_logger()

# ── Configuration ──────────────────────────────────────────────────────

POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", 5432))
POSTGRES_DB = os.getenv("POSTGRES_DB", "goblin")
POSTGRES_USER = os.getenv("POSTGRES_USER", "goblin")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "")

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")

MODELS_DIR = Path(os.getenv("MODELS_DIR", "/home/coder/Goblin/shared/models"))
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# Training schedule
TRAIN_INTERVAL_MINUTES = int(os.getenv("TRAIN_INTERVAL_MINUTES", "10"))
REWARD_LOOKBACK_CANDLES = 5  # How many candles ahead to check outcome
MIN_SAMPLES_FOR_TRAINING = 500
LEARNING_RATE_TCN = 0.0003
LEARNING_RATE_XGB = 0.03
TCN_EPOCHS_PER_CYCLE = int(os.getenv("TCN_EPOCHS_PER_CYCLE", "20"))
XGB_BOOST_ROUNDS_PER_CYCLE = int(os.getenv("XGB_BOOST_ROUNDS_PER_CYCLE", "100"))
TCN_HIDDEN_CHANNELS = int(os.getenv("TCN_HIDDEN_CHANNELS", "128"))
TCN_BATCH_SIZE = int(os.getenv("TCN_BATCH_SIZE", "256"))
XGB_MAX_DEPTH = int(os.getenv("XGB_MAX_DEPTH", "8"))
TRAINING_DAYS = int(os.getenv("TRAINING_DAYS", "90"))
MAX_TRAINING_SYMBOLS = int(os.getenv("MAX_TRAINING_SYMBOLS", "100"))

# Feature names matching prediction service's features/technical.py
TECHNICAL_FEATURES = [
    "rsi_14", "rsi_7", "macd_histogram", "macd_signal",
    "bb_percent_b", "bb_bandwidth", "atr_pct", "obv_trend",
    "stoch_rsi_k", "stoch_rsi_d", "williams_r",
    "ema_9_21_cross", "ema_25_50_cross", "volume_ratio",
    "momentum_5m", "momentum_15m", "momentum_30m", "momentum_60m",
    "spread_pct", "vwap_deviation",
]

_FALLBACK_SYMBOLS = [
    "BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT",
    "DOGE/USDT", "ADA/USDT", "AVAX/USDT", "DOT/USDT", "LINK/USDT",
]

async def _load_symbols_from_db(pool: asyncpg.Pool) -> list:
    """Load top symbols by candle/tick count from DB. Falls back to hardcoded list."""
    try:
        async with pool.acquire() as conn:
            # Prefer symbols with candle data, sorted by count
            rows = await conn.fetch(
                """SELECT symbol, COUNT(*) as cnt FROM candles
                   GROUP BY symbol ORDER BY cnt DESC LIMIT $1""",
                MAX_TRAINING_SYMBOLS,
            )
            if rows and len(rows) >= 5:
                return [r["symbol"] for r in rows]
            # Fallback: derive from ticks (symbols with most data)
            rows = await conn.fetch(
                """SELECT symbol, COUNT(*) as cnt FROM ticks
                   GROUP BY symbol ORDER BY cnt DESC LIMIT $1""",
                MAX_TRAINING_SYMBOLS,
            )
            if rows:
                return [r["symbol"] for r in rows]
    except Exception:
        pass
    return _FALLBACK_SYMBOLS

DEFAULT_SYMBOLS = _FALLBACK_SYMBOLS  # Updated at runtime in main()

# 5-class labels matching prediction service's xgboost_model.py
CLASS_5 = ["strong_sell", "sell", "hold", "buy", "strong_buy"]
# 3-class labels matching prediction service's tcn_model.py
CLASS_3 = ["up", "down", "neutral"]

running = True


def handle_signal(signum, frame):
    global running
    running = False


signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)


# ── Technical Feature Computation ─────────────────────────────────────
# Mirrors features/technical.py from the prediction service exactly

def _ema(data: np.ndarray, span: int) -> np.ndarray:
    alpha = 2.0 / (span + 1)
    out = np.zeros_like(data, dtype=np.float64)
    out[0] = data[0]
    for i in range(1, len(data)):
        out[i] = alpha * data[i] + (1 - alpha) * out[i - 1]
    return out


def _sma(data: np.ndarray, period: int) -> np.ndarray:
    return pd.Series(data).rolling(period, min_periods=1).mean().values


def _rsi(data: np.ndarray, period: int = 14) -> np.ndarray:
    delta = np.diff(data, prepend=data[0])
    gain = np.where(delta > 0, delta, 0.0)
    loss = np.where(delta < 0, -delta, 0.0)
    avg_gain = pd.Series(gain).rolling(period, min_periods=1).mean().values
    avg_loss = pd.Series(loss).rolling(period, min_periods=1).mean().values
    rs = np.divide(avg_gain, avg_loss, out=np.ones_like(avg_gain), where=avg_loss > 0)
    return 100.0 - (100.0 / (1.0 + rs))


def compute_features_for_df(df: pd.DataFrame) -> np.ndarray:
    """Compute the 20 technical features matching the prediction service.
    Returns array of shape (len(df), 20).
    """
    close = df["close"].values.astype(np.float64)
    high = df["high"].values.astype(np.float64)
    low = df["low"].values.astype(np.float64)
    opn = df["open"].values.astype(np.float64)
    volume = df["volume"].values.astype(np.float64)
    n = len(close)

    if n < 2:
        return np.zeros((n, 20))

    # RSI
    rsi_14 = _rsi(close, 14)
    rsi_7 = _rsi(close, 7)

    # MACD (8/17 EMA, matching technical.py)
    ema8 = _ema(close, 8)
    ema17 = _ema(close, 17)
    macd_line = ema8 - ema17
    macd_sig = _ema(macd_line, 9)
    macd_hist = macd_line - macd_sig

    # Bollinger Bands (20-period)
    sma20 = _sma(close, 20)
    std20 = pd.Series(close).rolling(20, min_periods=1).std().values
    bb_upper = sma20 + 2 * std20
    bb_lower = sma20 - 2 * std20
    bb_range = bb_upper - bb_lower
    bb_percent_b = np.divide(close - bb_lower, bb_range, out=np.full(n, 0.5), where=bb_range > 0)
    bb_bandwidth = np.divide(bb_range, sma20, out=np.zeros(n), where=sma20 > 0)

    # ATR %
    tr = np.maximum(high - low, np.maximum(np.abs(high - np.roll(close, 1)),
                                            np.abs(low - np.roll(close, 1))))
    tr[0] = high[0] - low[0]
    atr14 = pd.Series(tr).rolling(14, min_periods=1).mean().values
    atr_pct = np.divide(atr14, close, out=np.zeros(n), where=close > 0) * 100

    # OBV trend
    obv = np.zeros(n)
    for i in range(1, n):
        if close[i] > close[i - 1]:
            obv[i] = obv[i - 1] + volume[i]
        elif close[i] < close[i - 1]:
            obv[i] = obv[i - 1] - volume[i]
        else:
            obv[i] = obv[i - 1]
    obv_ema = _ema(obv, 20)
    obv_trend = np.where(obv > obv_ema, 1.0, -1.0)

    # Stochastic RSI
    rsi_series = rsi_14
    stoch_k = np.zeros(n)
    for i in range(14, n):
        window = rsi_series[i - 14 + 1:i + 1]
        rng = window.max() - window.min()
        stoch_k[i] = (rsi_series[i] - window.min()) / rng if rng > 0 else 50.0
    stoch_d = _sma(stoch_k, 3)

    # Williams %R
    williams = np.zeros(n)
    for i in range(14, n):
        hh = high[i - 14 + 1:i + 1].max()
        ll = low[i - 14 + 1:i + 1].min()
        rng = hh - ll
        williams[i] = ((hh - close[i]) / rng * -100) if rng > 0 else -50.0

    # EMA crosses
    ema9 = _ema(close, 9)
    ema21 = _ema(close, 21)
    ema25 = _ema(close, 25)
    ema50 = _ema(close, 50)
    ema_9_21_cross = np.where(ema9 > ema21, 1.0, -1.0)
    ema_25_50_cross = np.where(ema25 > ema50, 1.0, -1.0)

    # Volume ratio
    vol_sma20 = _sma(volume, 20)
    volume_ratio = np.divide(volume, vol_sma20, out=np.ones(n), where=vol_sma20 > 0)

    # Momentum at various lookbacks
    def pct_change(arr, periods):
        shifted = np.roll(arr, periods)
        shifted[:periods] = arr[0]
        return np.divide(arr - shifted, shifted, out=np.zeros(n), where=shifted > 0) * 100

    mom_5 = pct_change(close, 5)
    mom_15 = pct_change(close, 15)
    mom_30 = pct_change(close, 30)
    mom_60 = pct_change(close, 60)

    # Spread %
    spread_pct = np.divide(high - low, close, out=np.zeros(n), where=close > 0) * 100

    # VWAP deviation
    cum_vol = np.cumsum(volume)
    cum_vwap = np.cumsum(close * volume)
    vwap = np.divide(cum_vwap, cum_vol, out=close.copy(), where=cum_vol > 0)
    vwap_dev = np.divide(close - vwap, vwap, out=np.zeros(n), where=vwap > 0) * 100

    # Stack all 20 features
    features = np.column_stack([
        rsi_14, rsi_7, macd_hist, macd_sig,
        bb_percent_b, bb_bandwidth, atr_pct, obv_trend,
        stoch_k, stoch_d, williams,
        ema_9_21_cross, ema_25_50_cross, volume_ratio,
        mom_5, mom_15, mom_30, mom_60,
        spread_pct, vwap_dev,
    ])

    # Replace NaN/Inf
    features = np.nan_to_num(features, nan=0.0, posinf=0.0, neginf=0.0)
    return features


def compute_targets_5class(close: np.ndarray, horizon: int = 5) -> np.ndarray:
    """5-class targets for XGBoost matching prediction service labels."""
    future_ret = np.zeros(len(close))
    for i in range(len(close) - horizon):
        future_ret[i] = (close[i + horizon] - close[i]) / max(close[i], 1e-10)

    targets = np.full(len(close), 2)  # default: hold
    targets[future_ret > 0.015] = 4   # strong_buy
    targets[future_ret > 0.003] = 3   # buy (where not already strong_buy)
    targets[future_ret < -0.015] = 0  # strong_sell
    targets[future_ret < -0.003] = 1  # sell (where not already strong_sell)
    # Fix precedence
    targets[(future_ret > 0.015)] = 4
    targets[(future_ret < -0.015)] = 0
    return targets


def compute_targets_3class(close: np.ndarray, horizon: int = 5) -> np.ndarray:
    """3-class targets for TCN: 0=up, 1=down, 2=neutral."""
    future_ret = np.zeros(len(close))
    for i in range(len(close) - horizon):
        future_ret[i] = (close[i + horizon] - close[i]) / max(close[i], 1e-10)

    targets = np.full(len(close), 2)  # neutral
    targets[future_ret > 0.001] = 0   # up
    targets[future_ret < -0.001] = 1  # down
    return targets


# ── Reward Tracker ────────────────────────────────────────────────────

class RewardTracker:
    """Tracks prediction outcomes and computes RL reward signals."""

    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
        self.reward_key = "rl:rewards"
        self.prediction_key = "rl:predictions"

    async def record_prediction(self, symbol: str, direction: str,
                                 confidence: float, price: float):
        """Record a prediction for later reward evaluation."""
        entry = {
            "symbol": symbol,
            "direction": direction,
            "confidence": confidence,
            "price": price,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await self.redis.lpush(self.prediction_key, json.dumps(entry))
        await self.redis.ltrim(self.prediction_key, 0, 9999)

    async def evaluate_rewards(self, pool: asyncpg.Pool) -> Dict[str, float]:
        """Check past predictions against actual outcomes, return reward weights per symbol."""
        rewards = {}
        pending = await self.redis.lrange(self.prediction_key, 0, 999)
        resolved = []
        unresolved = []

        for raw in pending:
            try:
                pred = json.loads(raw)
                pred_time = datetime.fromisoformat(pred["timestamp"])
                age_minutes = (datetime.now(timezone.utc) - pred_time).total_seconds() / 60

                # Need at least 25 minutes for 5-candle (5m) outcome
                if age_minutes < 25:
                    unresolved.append(raw)
                    continue

                # Check actual price movement
                async with pool.acquire() as conn:
                    row = await conn.fetchrow(
                        """SELECT close FROM candles
                           WHERE symbol = $1 AND time > $2
                           ORDER BY time ASC LIMIT 1""",
                        pred["symbol"],
                        pred_time + timedelta(minutes=25),
                    )

                if row is None:
                    if age_minutes > 120:  # Too old, discard
                        resolved.append(raw)
                    else:
                        unresolved.append(raw)
                    continue

                actual_price = float(row["close"])
                pred_price = pred["price"]
                actual_return = (actual_price - pred_price) / max(pred_price, 1e-10)

                # Compute reward
                direction = pred["direction"].lower()
                if direction in ("buy", "strong_buy", "up"):
                    reward = 1.0 if actual_return > 0.001 else (-1.0 if actual_return < -0.001 else 0.0)
                elif direction in ("sell", "strong_sell", "down"):
                    reward = 1.0 if actual_return < -0.001 else (-1.0 if actual_return > 0.001 else 0.0)
                else:
                    reward = 0.5 if abs(actual_return) < 0.002 else -0.5

                sym = pred["symbol"]
                if sym not in rewards:
                    rewards[sym] = []
                rewards[sym].append(reward)

                resolved.append(raw)

            except Exception as e:
                logger.debug("Reward eval error", error=str(e))
                resolved.append(raw)

        # Update Redis: keep only unresolved
        if resolved:
            pipe = self.redis.pipeline()
            pipe.delete(self.prediction_key)
            for item in unresolved:
                pipe.rpush(self.prediction_key, item)
            await pipe.execute()

        # Store reward stats
        reward_summary = {}
        for sym, rews in rewards.items():
            avg = sum(rews) / len(rews) if rews else 0
            reward_summary[sym] = avg
            await self.redis.hset("rl:reward_avg", sym, str(round(avg, 4)))

        return reward_summary


# ── Model Training Functions ──────────────────────────────────────────

def train_tcn_rl(
    features: np.ndarray,
    targets: np.ndarray,
    reward_weights: Optional[np.ndarray],
    existing_model_path: Optional[str],
    output_path: Path,
    epochs: int = 5,
    lr: float = 0.0003,
) -> dict:
    """Train/update TCN model with RL reward weighting.

    Uses the same TCNNetwork architecture as the prediction service.
    If an existing model exists, loads it and fine-tunes (online learning).
    Reward weights bias the loss toward correctly predicting rewarded directions.
    """
    import torch
    import torch.nn as nn
    import torch.nn.functional as F

    # Import the actual TCN architecture from the prediction service
    sys.path.insert(0, "/home/coder/Goblin/services/prediction")
    from models.tcn_model import TCNNetwork

    n_features = features.shape[2] if features.ndim == 3 else 20
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    model = TCNNetwork(
        n_features=n_features,
        hidden_channels=TCN_HIDDEN_CHANNELS,
        n_classes=3,
        kernel_size=3,
        dropout=0.2,
    ).to(device)

    # Load existing weights if available (online learning)
    if existing_model_path and os.path.isfile(existing_model_path):
        try:
            state = torch.load(existing_model_path, map_location=device, weights_only=True)
            # If checkpoint has different hidden_channels, rebuild the network
            ckpt_hc = state.get("hidden_channels", TCN_HIDDEN_CHANNELS)
            if ckpt_hc != TCN_HIDDEN_CHANNELS:
                logger.info("TCN: checkpoint hidden_channels mismatch, training from scratch",
                            checkpoint=ckpt_hc, configured=TCN_HIDDEN_CHANNELS)
            else:
                if "model_state_dict" in state:
                    model.load_state_dict(state["model_state_dict"])
                else:
                    model.load_state_dict(state)
                logger.info("TCN: loaded existing model for fine-tuning")
        except Exception as e:
            logger.warning("TCN: could not load existing model, training from scratch", error=str(e))

    # Prepare data
    seq_length = 60
    X_seqs, y_seqs, w_seqs = [], [], []

    for i in range(seq_length, len(features)):
        X_seqs.append(features[i - seq_length:i])
        y_seqs.append(targets[i])
        if reward_weights is not None:
            w_seqs.append(max(reward_weights[i], 0.1))  # Floor at 0.1
        else:
            w_seqs.append(1.0)

    if len(X_seqs) < 100:
        return {"status": "skipped", "reason": "insufficient sequences"}

    X = torch.tensor(np.array(X_seqs, dtype=np.float32)).to(device)
    y = torch.tensor(np.array(y_seqs, dtype=np.int64)).to(device)
    w = torch.tensor(np.array(w_seqs, dtype=np.float32)).to(device)

    # Walk-forward split: 80/20
    split = int(len(X) * 0.8)
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]
    w_train = w[:split]

    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    criterion = nn.CrossEntropyLoss(reduction='none')  # Per-sample loss for RL weighting
    batch_size = TCN_BATCH_SIZE
    best_acc = 0.0

    for epoch in range(epochs):
        model.train()
        indices = torch.randperm(len(X_train))
        total_loss = 0.0
        n_batches = 0

        for start in range(0, len(indices), batch_size):
            batch_idx = indices[start:start + batch_size]
            xb = X_train[batch_idx]
            yb = y_train[batch_idx]
            wb = w_train[batch_idx]

            optimizer.zero_grad()
            logits = model(xb)
            loss_per_sample = criterion(logits, yb)

            # RL: weight loss by reward signal
            # Higher weight = model learns more from these samples
            weighted_loss = (loss_per_sample * wb).mean()
            weighted_loss.backward()

            # Gradient clipping for stability
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()

            total_loss += weighted_loss.item()
            n_batches += 1

        # Evaluate
        model.eval()
        with torch.no_grad():
            test_logits = model(X_test)
            preds = test_logits.argmax(dim=1)
            acc = (preds == y_test).float().mean().item()

        if acc > best_acc:
            best_acc = acc
            torch.save({
                "model_state_dict": model.state_dict(),
                "n_features": n_features,
                "hidden_channels": TCN_HIDDEN_CHANNELS,
                "n_classes": 3,
            }, output_path / "tcn_latest.pt")

    # Directional accuracy (ignore neutral class=2)
    model.eval()
    with torch.no_grad():
        test_logits = model(X_test)
        preds = test_logits.argmax(dim=1)
        dir_mask = y_test != 2
        dir_acc = (preds[dir_mask] == y_test[dir_mask]).float().mean().item() if dir_mask.sum() > 0 else 0.0

    metadata = {
        "model_type": "tcn",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "samples_train": int(len(X_train)),
        "samples_test": int(len(X_test)),
        "accuracy": round(best_acc, 4),
        "directional_accuracy": round(dir_acc, 4),
        "rl_weighted": reward_weights is not None,
        "features": TECHNICAL_FEATURES,
        "seq_length": seq_length,
        "device": str(device),
        "version": datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S"),
        "learning_type": "reinforcement_online",
    }

    with open(output_path / "tcn_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    logger.info("TCN RL training complete", accuracy=best_acc, dir_accuracy=dir_acc,
                rl_weighted=reward_weights is not None)
    return metadata


def train_xgboost_rl(
    features: np.ndarray,
    targets: np.ndarray,
    reward_weights: Optional[np.ndarray],
    existing_model_path: Optional[str],
    output_path: Path,
    n_rounds: int = 20,
    lr: float = 0.03,
) -> dict:
    """Train/update XGBoost with RL reward-weighted samples.

    Uses xgb.train() with xgb_model parameter for incremental learning.
    Reward weights increase importance of samples where the model was right/wrong.
    """
    import xgboost as xgb

    # Feature names matching prediction service
    feature_names = TECHNICAL_FEATURES + [
        "sentiment_score", "sentiment_momentum_1h", "sentiment_momentum_4h",
        "sentiment_momentum_24h", "sentiment_volume", "fear_greed_index",
        "whale_activity_score", "exchange_netflow", "funding_rate",
        "google_trends_score", "social_volume_zscore",
        "price_change_1m", "price_change_5m", "price_change_15m",
        "high_low_range", "close_open_ratio", "upper_shadow_pct",
        "lower_shadow_pct", "body_pct", "volume_change_pct",
    ]

    # Pad features to 40 columns if we only have 20 technical
    if features.shape[1] < len(feature_names):
        padding = np.zeros((features.shape[0], len(feature_names) - features.shape[1]))
        features = np.concatenate([features, padding], axis=1)
    elif features.shape[1] > len(feature_names):
        features = features[:, :len(feature_names)]

    # Walk-forward split
    split = int(len(features) * 0.8)
    X_train, X_test = features[:split], features[split:]
    y_train, y_test = targets[:split], targets[split:]

    # RL sample weights
    if reward_weights is not None:
        w_train = np.maximum(reward_weights[:split], 0.1)
    else:
        w_train = np.ones(len(X_train))

    dtrain = xgb.DMatrix(X_train, label=y_train, weight=w_train, feature_names=feature_names)
    dtest = xgb.DMatrix(X_test, label=y_test, feature_names=feature_names)

    params = {
        "objective": "multi:softprob",
        "num_class": 5,
        "eval_metric": "mlogloss",
        "max_depth": XGB_MAX_DEPTH,
        "learning_rate": lr,
        "tree_method": "hist",
        "device": "cuda",
        "subsample": 0.8,
        "colsample_bytree": 0.8,
    }

    # Incremental learning: continue from existing model
    existing_booster = None
    if existing_model_path and os.path.isfile(existing_model_path):
        try:
            existing_booster = xgb.Booster()
            existing_booster.load_model(existing_model_path)
            logger.info("XGBoost: loaded existing model for incremental training")
        except Exception as e:
            logger.warning("XGBoost: could not load existing, training fresh", error=str(e))
            existing_booster = None

    model = xgb.train(
        params,
        dtrain,
        num_boost_round=n_rounds,
        evals=[(dtest, "test")],
        verbose_eval=False,
        xgb_model=existing_booster,
    )

    # Evaluate
    preds_proba = model.predict(dtest)
    preds = np.argmax(preds_proba, axis=1)
    accuracy = float(np.mean(preds == y_test))

    # Directional accuracy (non-hold)
    # Directional: non-hold predictions that match non-hold targets
    dir_mask = (y_test != 2) | (preds != 2)  # either target or pred is non-hold
    if dir_mask.sum() > 0:
        # Check if predicted direction matches actual direction
        pred_dir = np.where(preds > 2, 1, np.where(preds < 2, -1, 0))
        true_dir = np.where(y_test > 2, 1, np.where(y_test < 2, -1, 0))
        nonzero = (pred_dir != 0) | (true_dir != 0)
        dir_acc = float(np.mean(pred_dir[nonzero] == true_dir[nonzero])) if nonzero.sum() > 0 else 0.0
    else:
        dir_acc = 0.0

    # Save
    model_path = output_path / "xgboost_latest.json"
    model.save_model(str(model_path))

    metadata = {
        "model_type": "xgboost",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "samples_train": int(len(X_train)),
        "samples_test": int(len(X_test)),
        "accuracy": round(accuracy, 4),
        "directional_accuracy": round(dir_acc, 4),
        "rl_weighted": reward_weights is not None,
        "features": feature_names,
        "n_boost_rounds": n_rounds,
        "incremental": existing_booster is not None,
        "version": datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S"),
        "learning_type": "reinforcement_online",
    }

    with open(output_path / "xgboost_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    logger.info("XGBoost RL training complete", accuracy=accuracy, dir_accuracy=dir_acc,
                incremental=existing_booster is not None)
    return metadata


def update_registry(models_dir: Path, tcn_meta: dict, xgb_meta: dict):
    """Update registry.json so the prediction service discovers the models."""
    registry_path = models_dir / "registry.json"
    entries = []

    if os.path.isfile(registry_path):
        try:
            with open(registry_path) as f:
                entries = json.load(f)
        except Exception:
            entries = []

    now = datetime.now(timezone.utc).isoformat()

    if tcn_meta.get("accuracy"):
        entries.append({
            "model_name": "tcn",
            "version": tcn_meta.get("version", now),
            "creation_date": now,
            "metrics": {
                "accuracy": tcn_meta.get("accuracy", 0),
                "directional_accuracy": tcn_meta.get("directional_accuracy", 0),
            },
            "path": str(models_dir / "tcn_latest.pt"),
        })

    if xgb_meta.get("accuracy"):
        entries.append({
            "model_name": "xgboost",
            "version": xgb_meta.get("version", now),
            "creation_date": now,
            "metrics": {
                "accuracy": xgb_meta.get("accuracy", 0),
                "directional_accuracy": xgb_meta.get("directional_accuracy", 0),
            },
            "path": str(models_dir / "xgboost_latest.json"),
        })

    with open(registry_path, "w") as f:
        json.dump(entries, f, indent=2)

    logger.info("Registry updated", tcn_version=tcn_meta.get("version"),
                xgb_version=xgb_meta.get("version"))


async def log_to_nerve_monitor(redis: aioredis.Redis, message: str, details: dict,
                                level: str = "info", category: str = "model"):
    """Log training events to the AI Nerve Monitor."""
    import uuid
    entry = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "category": category,
        "action": "rl_training",
        "level": level,
        "symbol": "",
        "confidence": details.get("accuracy", 0),
        "details": details,
        "service": "continuous-learner",
        "message": message,
    }
    try:
        await redis.lpush("ai:logs", json.dumps(entry))
        await redis.ltrim("ai:logs", 0, 9999)
        await redis.lpush(f"ai:logs:{category}", json.dumps(entry))
        await redis.ltrim(f"ai:logs:{category}", 0, 999)
        await redis.publish("ai:activity", json.dumps(entry))

        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        await redis.hincrby(f"ai:stats:{today}", category, 1)
        await redis.hincrby(f"ai:stats:{today}", f"{category}:{level}", 1)
    except Exception:
        pass


# ── Main Training Loop ────────────────────────────────────────────────

async def load_candle_data(pool: asyncpg.Pool, symbols: list, days: int) -> pd.DataFrame:
    """Load candle data from TimescaleDB. Falls back to deriving from ticks."""
    start_time = datetime.now(timezone.utc) - timedelta(days=days)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT time, symbol, open, high, low, close, volume
               FROM candles
               WHERE symbol = ANY($1::text[]) AND time >= $2
               ORDER BY symbol, time ASC""",
            symbols, start_time,
        )

        # If not enough candle data, derive from ticks
        candle_symbols = {r["symbol"] for r in rows}
        missing = [s for s in symbols if s not in candle_symbols]
        if missing:
            tick_rows = await conn.fetch(
                """WITH bucketed AS (
                    SELECT
                        time_bucket(INTERVAL '5 minutes', time) AS time,
                        symbol,
                        first(price, time) AS open,
                        max(price) AS high,
                        min(price) AS low,
                        last(price, time) AS close,
                        sum(COALESCE(volume, 0)) AS volume
                    FROM ticks
                    WHERE symbol = ANY($1::text[]) AND time >= $2
                    GROUP BY time_bucket(INTERVAL '5 minutes', time), symbol
                    HAVING COUNT(*) >= 2
                )
                SELECT time, symbol, open, high, low, close, volume
                FROM bucketed
                ORDER BY symbol, time ASC""",
                missing[:50], start_time,  # Limit to 50 to avoid huge queries
            )
            rows = list(rows) + list(tick_rows)

    if not rows:
        return pd.DataFrame()
    return pd.DataFrame([dict(r) for r in rows])


async def training_cycle(pool: asyncpg.Pool, redis: aioredis.Redis,
                          reward_tracker: RewardTracker, cycle_num: int):
    """Run one training cycle: load data, compute rewards, train both models."""

    logger.info(f"=== Training cycle {cycle_num} starting ===")
    await log_to_nerve_monitor(redis, f"RL training cycle {cycle_num} starting",
                                {"cycle": cycle_num})

    # Load data
    candles_df = await load_candle_data(pool, DEFAULT_SYMBOLS, days=TRAINING_DAYS)
    if candles_df.empty or len(candles_df) < MIN_SAMPLES_FOR_TRAINING:
        logger.warning("Insufficient candle data for training", count=len(candles_df))
        return

    logger.info(f"Loaded {len(candles_df)} candles for {candles_df['symbol'].nunique()} symbols")

    # Evaluate pending prediction rewards
    reward_summary = await reward_tracker.evaluate_rewards(pool)
    if reward_summary:
        logger.info("Reward evaluation", rewards=reward_summary)

    # Compute features and targets per symbol
    all_features = []
    all_targets_3 = []
    all_targets_5 = []
    all_reward_weights = []

    for symbol in candles_df["symbol"].unique():
        sym_df = candles_df[candles_df["symbol"] == symbol].sort_values("time").reset_index(drop=True)
        if len(sym_df) < 100:
            continue

        feats = compute_features_for_df(sym_df)  # (N, 20)
        t3 = compute_targets_3class(sym_df["close"].values)
        t5 = compute_targets_5class(sym_df["close"].values)

        # RL reward weight: boost samples from symbols with recent positive rewards
        sym_reward = reward_summary.get(symbol, 0.0)
        # Map reward [-1, 1] to weight [0.5, 2.0]
        base_weight = 1.0 + sym_reward * 0.5
        weights = np.full(len(feats), base_weight)

        # Trim last REWARD_LOOKBACK_CANDLES (no future data)
        valid = len(feats) - REWARD_LOOKBACK_CANDLES
        all_features.append(feats[:valid])
        all_targets_3.append(t3[:valid])
        all_targets_5.append(t5[:valid])
        all_reward_weights.append(weights[:valid])

    if not all_features:
        logger.warning("No features computed")
        return

    features = np.concatenate(all_features)
    targets_3 = np.concatenate(all_targets_3)
    targets_5 = np.concatenate(all_targets_5)
    reward_weights = np.concatenate(all_reward_weights)

    logger.info(f"Training data: {len(features)} samples, {features.shape[1]} features")

    # Train TCN with RL
    tcn_existing = str(MODELS_DIR / "tcn_latest.pt")
    tcn_meta = await asyncio.to_thread(
        train_tcn_rl,
        features, targets_3,
        reward_weights if cycle_num > 1 else None,  # No RL weighting on first cycle
        tcn_existing if cycle_num > 1 else None,
        MODELS_DIR,
        TCN_EPOCHS_PER_CYCLE,
        LEARNING_RATE_TCN,
    )

    # Train XGBoost with RL
    xgb_existing = str(MODELS_DIR / "xgboost_latest.json")
    xgb_meta = await asyncio.to_thread(
        train_xgboost_rl,
        features, targets_5,
        reward_weights if cycle_num > 1 else None,
        xgb_existing if cycle_num > 1 else None,
        MODELS_DIR,
        XGB_BOOST_ROUNDS_PER_CYCLE,
        LEARNING_RATE_XGB,
    )

    # Update registry
    update_registry(MODELS_DIR, tcn_meta, xgb_meta)

    # Signal prediction service to reload (via Redis)
    await redis.set("model:reload_signal", datetime.now(timezone.utc).isoformat())
    await redis.publish("model:reload", "updated")

    # Save training summary
    summary = {
        "cycle": cycle_num,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "total_samples": len(features),
        "symbols": int(candles_df["symbol"].nunique()),
        "reward_summary": {k: round(v, 4) for k, v in reward_summary.items()},
        "tcn": tcn_meta,
        "xgboost": xgb_meta,
    }
    with open(MODELS_DIR / "training_summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    await log_to_nerve_monitor(
        redis,
        f"RL cycle {cycle_num} complete — TCN acc: {tcn_meta.get('accuracy', 0):.1%}, "
        f"XGB acc: {xgb_meta.get('accuracy', 0):.1%}",
        {
            "cycle": cycle_num,
            "tcn_accuracy": tcn_meta.get("accuracy", 0),
            "xgb_accuracy": xgb_meta.get("accuracy", 0),
            "tcn_dir_accuracy": tcn_meta.get("directional_accuracy", 0),
            "xgb_dir_accuracy": xgb_meta.get("directional_accuracy", 0),
            "rl_weighted": cycle_num > 1,
            "samples": len(features),
        },
        level="info",
    )

    logger.info(f"=== Training cycle {cycle_num} complete ===")


async def main():
    global DEFAULT_SYMBOLS

    logger.info("Goblin Continuous Learner starting",
                interval_min=TRAIN_INTERVAL_MINUTES,
                models_dir=str(MODELS_DIR))

    pool = await asyncpg.create_pool(
        host=POSTGRES_HOST, port=POSTGRES_PORT,
        database=POSTGRES_DB, user=POSTGRES_USER,
        password=POSTGRES_PASSWORD, min_size=2, max_size=10,
    )

    redis = aioredis.Redis(
        host=REDIS_HOST, port=REDIS_PORT,
        password=REDIS_PASSWORD, decode_responses=True,
    )
    await redis.ping()

    # Load symbols with actual data from DB
    DEFAULT_SYMBOLS = await _load_symbols_from_db(pool)
    logger.info("Training symbols loaded", count=len(DEFAULT_SYMBOLS),
                first_five=DEFAULT_SYMBOLS[:5])

    reward_tracker = RewardTracker(redis)
    cycle = 0

    # Run first training immediately
    try:
        cycle += 1
        await training_cycle(pool, redis, reward_tracker, cycle)
    except Exception as e:
        logger.error("Initial training cycle failed", error=str(e))

    # Then loop on schedule
    while running:
        try:
            # Sleep in small increments so we can respond to signals
            for _ in range(TRAIN_INTERVAL_MINUTES * 60):
                if not running:
                    break
                await asyncio.sleep(1)

            if not running:
                break

            cycle += 1
            await training_cycle(pool, redis, reward_tracker, cycle)

        except Exception as e:
            logger.error("Training cycle failed", cycle=cycle, error=str(e))
            # Wait a bit before retrying
            await asyncio.sleep(60)

    logger.info("Continuous learner shutting down")
    await pool.close()
    await redis.close()


if __name__ == "__main__":
    asyncio.run(main())
