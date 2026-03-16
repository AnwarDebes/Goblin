"""
Compute technical-analysis features from OHLCV candle data.

All calculations use numpy / pandas only (no external TA library dependency).
The function returns a flat ``dict[str, float]`` suitable for feeding into
both the XGBoost model (flat vector) and for building the TCN input matrix.
"""

from typing import Dict

import numpy as np
import pandas as pd


def _ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()


def _sma(series: pd.Series, window: int) -> pd.Series:
    return series.rolling(window=window, min_periods=1).mean()


def compute_technical_features(df: pd.DataFrame) -> Dict[str, float]:
    """
    Compute technical features from a DataFrame of recent candles.

    Parameters
    ----------
    df : DataFrame
        Must contain columns: ``open``, ``high``, ``low``, ``close``, ``volume``.
        Should have at least 60 rows for full feature coverage.

    Returns
    -------
    dict
        Feature-name -> value mapping with 20 features.
    """
    if df.empty:
        return _empty_features()

    close = df["close"].astype(float)
    high = df["high"].astype(float)
    low = df["low"].astype(float)
    volume = df["volume"].astype(float)
    open_ = df["open"].astype(float)

    features: Dict[str, float] = {}

    # --- RSI (14 and 7) ---
    features["rsi_14"] = _rsi(close, 14)
    features["rsi_7"] = _rsi(close, 7)

    # --- MACD (8, 17, 9) tuned for crypto ---
    ema_fast = _ema(close, 8)
    ema_slow = _ema(close, 17)
    macd_line = ema_fast - ema_slow
    macd_signal = _ema(macd_line, 9)
    macd_hist = macd_line - macd_signal
    features["macd_histogram"] = float(macd_hist.iloc[-1])
    features["macd_signal"] = float(macd_signal.iloc[-1])

    # --- Bollinger Bands (20, 2) ---
    bb_mid = _sma(close, 20)
    bb_std = close.rolling(window=20, min_periods=1).std()
    bb_upper = bb_mid + 2 * bb_std
    bb_lower = bb_mid - 2 * bb_std
    bandwidth = bb_upper.iloc[-1] - bb_lower.iloc[-1]
    features["bb_percent_b"] = (
        float((close.iloc[-1] - bb_lower.iloc[-1]) / bandwidth) if bandwidth > 0 else 0.5
    )
    features["bb_bandwidth"] = float(bandwidth / bb_mid.iloc[-1]) if bb_mid.iloc[-1] > 0 else 0.0

    # --- ATR percentage ---
    tr = pd.concat(
        [
            high - low,
            (high - close.shift(1)).abs(),
            (low - close.shift(1)).abs(),
        ],
        axis=1,
    ).max(axis=1)
    atr_14 = tr.rolling(window=14, min_periods=1).mean()
    features["atr_pct"] = float(atr_14.iloc[-1] / close.iloc[-1] * 100) if close.iloc[-1] > 0 else 0.0

    # --- OBV trend ---
    obv = (np.sign(close.diff().fillna(0)) * volume).cumsum()
    obv_ema = _ema(obv, 14)
    features["obv_trend"] = 1.0 if obv.iloc[-1] > obv_ema.iloc[-1] else -1.0

    # --- Stochastic RSI ---
    rsi_series = _rsi_series(close, 14)
    stoch_k, stoch_d = _stoch_rsi(rsi_series, 14)
    features["stoch_rsi_k"] = stoch_k
    features["stoch_rsi_d"] = stoch_d

    # --- Williams %R ---
    features["williams_r"] = _williams_r(high, low, close, 14)

    # --- EMA crosses ---
    ema9 = _ema(close, 9)
    ema21 = _ema(close, 21)
    ema25 = _ema(close, 25)
    ema50 = _ema(close, 50)
    features["ema_9_21_cross"] = 1.0 if ema9.iloc[-1] > ema21.iloc[-1] else -1.0
    features["ema_25_50_cross"] = 1.0 if ema25.iloc[-1] > ema50.iloc[-1] else -1.0

    # --- Volume ratio ---
    vol_sma = _sma(volume, 20)
    features["volume_ratio"] = (
        float(volume.iloc[-1] / vol_sma.iloc[-1]) if vol_sma.iloc[-1] > 0 else 1.0
    )

    # --- Momentum at various lookbacks ---
    for label, periods in [("5m", 5), ("15m", 15), ("30m", 30), ("60m", 60)]:
        if len(close) > periods and abs(float(close.iloc[-1 - periods])) > 1e-15:
            features[f"momentum_{label}"] = float(
                (close.iloc[-1] - close.iloc[-1 - periods]) / close.iloc[-1 - periods] * 100
            )
        else:
            features[f"momentum_{label}"] = 0.0

    # --- Spread pct (approximated from high/low of last candle) ---
    features["spread_pct"] = (
        float((high.iloc[-1] - low.iloc[-1]) / close.iloc[-1] * 100) if close.iloc[-1] > 0 else 0.0
    )

    # --- VWAP deviation ---
    cum_vol = volume.cumsum()
    cum_vp = (close * volume).cumsum()
    vwap = cum_vp / cum_vol.replace(0, np.nan)
    features["vwap_deviation"] = (
        float((close.iloc[-1] - vwap.iloc[-1]) / vwap.iloc[-1] * 100) if vwap.iloc[-1] else 0.0
    )

    return features


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _rsi(close: pd.Series, period: int) -> float:
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(window=period, min_periods=1).mean()
    loss = (-delta.clip(upper=0)).rolling(window=period, min_periods=1).mean()
    rs = gain / loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    return float(rsi.iloc[-1]) if not np.isnan(rsi.iloc[-1]) else 50.0


def _rsi_series(close: pd.Series, period: int) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(window=period, min_periods=1).mean()
    loss = (-delta.clip(upper=0)).rolling(window=period, min_periods=1).mean()
    rs = gain / loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def _stoch_rsi(rsi: pd.Series, period: int):
    rsi_min = rsi.rolling(window=period, min_periods=1).min()
    rsi_max = rsi.rolling(window=period, min_periods=1).max()
    denom = rsi_max - rsi_min
    stoch_k = ((rsi - rsi_min) / denom.replace(0, np.nan)).fillna(0.5)
    stoch_d = stoch_k.rolling(window=3, min_periods=1).mean()
    return float(stoch_k.iloc[-1]), float(stoch_d.iloc[-1])


def _williams_r(high: pd.Series, low: pd.Series, close: pd.Series, period: int) -> float:
    hh = high.rolling(window=period, min_periods=1).max()
    ll = low.rolling(window=period, min_periods=1).min()
    denom = hh - ll
    wr = ((hh - close) / denom.replace(0, np.nan) * -100).fillna(-50.0)
    return float(wr.iloc[-1])


def compute_features_matrix(df: pd.DataFrame) -> np.ndarray:
    """Compute all 20 technical features for every row in *df*.

    Returns ndarray of shape ``(len(df), 20)`` — suitable for slicing
    the last 60 rows to build a TCN input sequence.  Much faster than
    calling :func:`compute_technical_features` per row.
    """
    if df.empty or len(df) < 2:
        return np.zeros((len(df), 20))

    close = df["close"].values.astype(np.float64)
    high = df["high"].values.astype(np.float64)
    low = df["low"].values.astype(np.float64)
    volume = df["volume"].values.astype(np.float64)
    n = len(close)

    def _np_ema(data, span):
        alpha = 2.0 / (span + 1)
        out = np.zeros_like(data, dtype=np.float64)
        out[0] = data[0]
        for i in range(1, len(data)):
            out[i] = alpha * data[i] + (1 - alpha) * out[i - 1]
        return out

    def _np_sma(data, period):
        return pd.Series(data).rolling(period, min_periods=1).mean().values

    def _np_rsi(data, period):
        delta = np.diff(data, prepend=data[0])
        gain = np.where(delta > 0, delta, 0.0)
        loss = np.where(delta < 0, -delta, 0.0)
        avg_gain = pd.Series(gain).rolling(period, min_periods=1).mean().values
        avg_loss = pd.Series(loss).rolling(period, min_periods=1).mean().values
        rs = np.divide(avg_gain, avg_loss, out=np.ones_like(avg_gain), where=avg_loss > 0)
        return 100.0 - (100.0 / (1.0 + rs))

    rsi_14 = _np_rsi(close, 14)
    rsi_7 = _np_rsi(close, 7)

    ema8 = _np_ema(close, 8)
    ema17 = _np_ema(close, 17)
    macd_line = ema8 - ema17
    macd_sig = _np_ema(macd_line, 9)
    macd_hist = macd_line - macd_sig

    sma20 = _np_sma(close, 20)
    std20 = pd.Series(close).rolling(20, min_periods=1).std().values
    bb_upper = sma20 + 2 * std20
    bb_lower = sma20 - 2 * std20
    bb_range = bb_upper - bb_lower
    bb_percent_b = np.divide(close - bb_lower, bb_range, out=np.full(n, 0.5), where=bb_range > 0)
    bb_bandwidth = np.divide(bb_range, sma20, out=np.zeros(n), where=sma20 > 0)

    tr = np.maximum(high - low, np.maximum(np.abs(high - np.roll(close, 1)), np.abs(low - np.roll(close, 1))))
    tr[0] = high[0] - low[0]
    atr14 = pd.Series(tr).rolling(14, min_periods=1).mean().values
    atr_pct = np.divide(atr14, close, out=np.zeros(n), where=close > 0) * 100

    obv = np.zeros(n)
    for i in range(1, n):
        if close[i] > close[i - 1]:
            obv[i] = obv[i - 1] + volume[i]
        elif close[i] < close[i - 1]:
            obv[i] = obv[i - 1] - volume[i]
        else:
            obv[i] = obv[i - 1]
    obv_ema = _np_ema(obv, 14)
    obv_trend = np.where(obv > obv_ema, 1.0, -1.0)

    stoch_k = np.full(n, 0.5)
    for i in range(14, n):
        window = rsi_14[max(0, i - 13):i + 1]
        rng = window.max() - window.min()
        stoch_k[i] = (rsi_14[i] - window.min()) / rng if rng > 0 else 0.5
    stoch_d = _np_sma(stoch_k, 3)

    williams = np.full(n, -50.0)
    for i in range(14, n):
        hh = high[max(0, i - 13):i + 1].max()
        ll = low[max(0, i - 13):i + 1].min()
        rng = hh - ll
        williams[i] = ((hh - close[i]) / rng * -100) if rng > 0 else -50.0

    ema9 = _np_ema(close, 9)
    ema21 = _np_ema(close, 21)
    ema25 = _np_ema(close, 25)
    ema50 = _np_ema(close, 50)
    ema_9_21_cross = np.where(ema9 > ema21, 1.0, -1.0)
    ema_25_50_cross = np.where(ema25 > ema50, 1.0, -1.0)

    vol_sma20 = _np_sma(volume, 20)
    volume_ratio = np.divide(volume, vol_sma20, out=np.ones(n), where=vol_sma20 > 0)

    def pct_change(arr, periods):
        shifted = np.roll(arr, periods)
        shifted[:periods] = arr[0]
        return np.divide(arr - shifted, shifted, out=np.zeros(n), where=np.abs(shifted) > 1e-15) * 100

    mom_5 = pct_change(close, 5)
    mom_15 = pct_change(close, 15)
    mom_30 = pct_change(close, 30)
    mom_60 = pct_change(close, 60)

    spread_pct = np.divide(high - low, close, out=np.zeros(n), where=close > 0) * 100

    cum_vol = np.cumsum(volume)
    cum_vwap = np.cumsum(close * volume)
    vwap = np.divide(cum_vwap, cum_vol, out=close.copy(), where=cum_vol > 0)
    vwap_dev = np.divide(close - vwap, vwap, out=np.zeros(n), where=np.abs(vwap) > 1e-15) * 100

    features = np.column_stack([
        rsi_14, rsi_7, macd_hist, macd_sig,
        bb_percent_b, bb_bandwidth, atr_pct, obv_trend,
        stoch_k, stoch_d, williams,
        ema_9_21_cross, ema_25_50_cross, volume_ratio,
        mom_5, mom_15, mom_30, mom_60,
        spread_pct, vwap_dev,
    ])
    return np.nan_to_num(features, nan=0.0, posinf=0.0, neginf=0.0).astype(np.float32)


def _empty_features() -> Dict[str, float]:
    keys = [
        "rsi_14", "rsi_7", "macd_histogram", "macd_signal",
        "bb_percent_b", "bb_bandwidth", "atr_pct", "obv_trend",
        "stoch_rsi_k", "stoch_rsi_d", "williams_r",
        "ema_9_21_cross", "ema_25_50_cross", "volume_ratio",
        "momentum_5m", "momentum_15m", "momentum_30m", "momentum_60m",
        "spread_pct", "vwap_deviation",
    ]
    return {k: 0.0 for k in keys}
