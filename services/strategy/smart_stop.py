"""
Smart Adaptive Stop-Loss System (v1.0)

Multi-factor dynamic stop that adapts to market conditions in real-time.
Combines research from quantitative finance and crypto-specific studies.

Architecture (6 layers):
  1. Regime Detection    — master switch for all parameters
  2. ATR-Based Stop      — Chandelier Exit style, anchored to peak price
  3. Momentum Check      — RSI + multi-timeframe momentum assess dip quality
  4. Volume Confirmation — volume surge on dip = real selling, low volume = noise
  5. Trend Health        — EMA crosses + MACD confirm if trend is intact
  6. AI Integration      — prediction pressure modulates stop aggressiveness

The system outputs a single stop_distance_pct per position per tick.
Position manager compares (peak_price - current_price) / peak_price against this.
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SmartStopResult:
    """Output of the smart stop calculation."""
    stop_distance_pct: float       # Final adaptive stop distance (0.01 = 1%)
    should_exit: bool              # Whether current price breaches the stop
    base_atr_stop: float           # Raw ATR-based stop distance
    regime_mult: float             # Regime multiplier applied
    momentum_mult: float           # Momentum adjustment
    volume_mult: float             # Volume adjustment
    trend_mult: float              # Trend health adjustment
    ai_mult: float                 # AI prediction adjustment
    reason: str                    # Human-readable explanation
    hard_floor_pct: float          # Absolute maximum loss allowed


# ── Configuration ─────────────────────────────────────────────────────

# Chandelier Exit: stop = peak_price - (ATR_MULT * ATR)
# We express this as a percentage of entry price for simplicity
ATR_STOP_MULT = 2.5              # Base: 2.5x ATR from peak

# Regime multipliers (scales the ATR stop distance)
REGIME_STOP_MULTS = {
    "trending_up":  1.3,          # Trending: give room to run
    "trending_down": 0.7,         # Counter-trend longs: tight stop
    "choppy":       0.6,          # Choppy: get out fast
    "high_vol":     1.5,          # High vol: need room for swings
    "unknown":      1.0,
}

# Hard floor: absolute maximum loss regardless of other factors
# This is the "never lose more than X%" safety net
HARD_FLOOR_LOSS_PCT = 0.07       # -7% absolute max loss

# Minimum stop distance (don't stop too tight or every tick triggers)
MIN_STOP_PCT = 0.008             # 0.8% minimum stop distance

# Time-based adjustment: new positions get tighter stops
# Positions older than this get the full calculated stop
POSITION_AGE_FULL_STOP_MINUTES = 5.0
# Young positions (< age threshold) use this fraction of calculated stop
YOUNG_POSITION_STOP_FRACTION = 0.6


def compute_smart_stop(
    pnl_pct: float,
    peak_pnl_pct: float,
    atr_pct: float,
    rsi_14: float,
    volume_ratio: float,
    momentum_5m: float,
    momentum_15m: float,
    momentum_30m: float,
    macd_histogram: float,
    ema_cross_9_21: float,
    ema_cross_25_50: float,
    regime: str,
    ai_pressure: float,
    ai_threshold: float,
    hold_time_minutes: float,
    bollinger_b: float = 0.5,
    side: str = "long",
) -> SmartStopResult:
    """
    Compute the adaptive stop-loss distance for a position.

    Returns a SmartStopResult with the final stop distance and whether
    the position should be exited.
    """

    # ══════════════════════════════════════════════════════════════════
    # LAYER 1: Base ATR Stop (Chandelier Exit style)
    # ══════════════════════════════════════════════════════════════════
    # atr_pct is already expressed as % of price (e.g., 0.5 = 0.5%)
    # Convert to decimal: 0.5% → 0.005
    atr_decimal = max(atr_pct / 100, 0.001)  # floor at 0.1%
    base_atr_stop = ATR_STOP_MULT * atr_decimal

    # ══════════════════════════════════════════════════════════════════
    # LAYER 2: Regime Multiplier
    # ══════════════════════════════════════════════════════════════════
    regime_mult = REGIME_STOP_MULTS.get(regime, 1.0)

    # ══════════════════════════════════════════════════════════════════
    # LAYER 3: Momentum Assessment
    # ══════════════════════════════════════════════════════════════════
    # If momentum is still positive despite price dipping, the dip is
    # likely temporary → widen stop. If momentum is negative, the dip
    # is likely real → tighten stop.
    momentum_mult = 1.0

    if side == "long":
        # Count how many momentum timeframes are positive
        mom_signals = [momentum_5m, momentum_15m, momentum_30m]
        positive_count = sum(1 for m in mom_signals if m > 0)

        if positive_count >= 2:
            # Majority of timeframes positive → dip is noise, widen stop
            momentum_mult = 1.2
        elif positive_count == 0:
            # All negative → real selling, tighten
            momentum_mult = 0.7

        # RSI modifier: oversold during dip = likely bounce
        if rsi_14 < 30:
            momentum_mult *= 1.15  # Oversold: give room for bounce
        elif rsi_14 > 70:
            momentum_mult *= 0.8   # Overbought: tighten, likely to reverse

    else:  # short
        mom_signals = [momentum_5m, momentum_15m, momentum_30m]
        negative_count = sum(1 for m in mom_signals if m < 0)

        if negative_count >= 2:
            momentum_mult = 1.2
        elif negative_count == 0:
            momentum_mult = 0.7

        if rsi_14 > 70:
            momentum_mult *= 1.15
        elif rsi_14 < 30:
            momentum_mult *= 0.8

    # ══════════════════════════════════════════════════════════════════
    # LAYER 4: Volume Confirmation
    # ══════════════════════════════════════════════════════════════════
    # High volume during a price drop = institutional selling, real move
    # Low volume during a price drop = retail noise, likely to reverse
    volume_mult = 1.0

    if pnl_pct < 0:  # Position is currently losing
        if volume_ratio > 2.0:
            # Volume 2x+ above average during loss → real selling, tighten
            volume_mult = 0.7
        elif volume_ratio > 1.5:
            volume_mult = 0.85
        elif volume_ratio < 0.5:
            # Very low volume → probably noise, give room
            volume_mult = 1.2
    elif pnl_pct > 0 and volume_ratio > 1.5:
        # Profitable + high volume = strong move, let it run
        volume_mult = 1.15

    # ══════════════════════════════════════════════════════════════════
    # LAYER 5: Trend Health (EMA + MACD)
    # ══════════════════════════════════════════════════════════════════
    # If EMAs are still bullish and MACD supports, trend is intact
    trend_mult = 1.0

    if side == "long":
        trend_score = 0
        if ema_cross_9_21 > 0:  # Short-term bullish
            trend_score += 1
        if ema_cross_25_50 > 0:  # Medium-term bullish
            trend_score += 1
        if macd_histogram > 0:   # MACD bullish
            trend_score += 1

        if trend_score == 3:
            # All trend signals bullish → strong trend, widen stop
            trend_mult = 1.25
        elif trend_score == 0:
            # All bearish → trend broken, tighten hard
            trend_mult = 0.6
        elif trend_score == 1:
            trend_mult = 0.85
    else:
        trend_score = 0
        if ema_cross_9_21 < 0:
            trend_score += 1
        if ema_cross_25_50 < 0:
            trend_score += 1
        if macd_histogram < 0:
            trend_score += 1

        if trend_score == 3:
            trend_mult = 1.25
        elif trend_score == 0:
            trend_mult = 0.6
        elif trend_score == 1:
            trend_mult = 0.85

    # ══════════════════════════════════════════════════════════════════
    # LAYER 6: AI Prediction Integration
    # ══════════════════════════════════════════════════════════════════
    # If AI exit pressure is building (AI says sell), tighten stop
    # If AI pressure is low (AI says hold), widen stop
    ai_mult = 1.0

    if ai_threshold > 0:
        pressure_ratio = ai_pressure / ai_threshold
        if pressure_ratio > 0.7:
            # AI is close to triggering exit → tighten stop
            ai_mult = 0.7
        elif pressure_ratio > 0.4:
            ai_mult = 0.85
        elif pressure_ratio < 0.15:
            # AI very calm → widen stop, let position breathe
            ai_mult = 1.2

    # ══════════════════════════════════════════════════════════════════
    # COMBINE: Final stop distance
    # ══════════════════════════════════════════════════════════════════
    raw_stop = base_atr_stop * regime_mult * momentum_mult * volume_mult * trend_mult * ai_mult

    # Time-based adjustment: new positions get tighter stops
    if hold_time_minutes < POSITION_AGE_FULL_STOP_MINUTES:
        age_factor = YOUNG_POSITION_STOP_FRACTION + (
            (1.0 - YOUNG_POSITION_STOP_FRACTION) *
            (hold_time_minutes / POSITION_AGE_FULL_STOP_MINUTES)
        )
        raw_stop *= age_factor

    # Apply floors and ceilings
    stop_distance = max(raw_stop, MIN_STOP_PCT)
    stop_distance = min(stop_distance, HARD_FLOOR_LOSS_PCT)

    # Determine if we should exit
    # For longs: exit if price dropped from peak by more than stop_distance
    # For shorts: exit if price rose from peak by more than stop_distance
    drop_from_peak = peak_pnl_pct - pnl_pct if peak_pnl_pct > 0 else 0
    hard_floor_breached = pnl_pct <= -HARD_FLOOR_LOSS_PCT
    trailing_breached = (peak_pnl_pct >= 0.01) and (drop_from_peak >= stop_distance)

    should_exit = hard_floor_breached or trailing_breached

    # Build reason string
    if hard_floor_breached:
        reason = f"hard_floor_{HARD_FLOOR_LOSS_PCT:.0%}_breached"
    elif trailing_breached:
        reason = f"adaptive_trail_{stop_distance:.2%}_from_peak"
    else:
        reason = "holding"

    return SmartStopResult(
        stop_distance_pct=stop_distance,
        should_exit=should_exit,
        base_atr_stop=base_atr_stop,
        regime_mult=regime_mult,
        momentum_mult=round(momentum_mult, 3),
        volume_mult=round(volume_mult, 3),
        trend_mult=round(trend_mult, 3),
        ai_mult=round(ai_mult, 3),
        reason=reason,
        hard_floor_pct=HARD_FLOOR_LOSS_PCT,
    )
