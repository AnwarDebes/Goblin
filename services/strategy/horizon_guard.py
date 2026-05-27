"""Horizon guard — gate soft exits until the model's prediction window elapses.

All TCN variants and the XGBoost classifier are trained on `future_return_15m`
(services/prediction/training/data_loader.py:148). The strategy must hold positions
at least that long to give the prediction a chance to materialize. Closing earlier
on contrary signals throws away the model's edge — the model said "up in 15 min",
the bot closes in 4 seconds, the prediction never gets to be right or wrong.

EXCEPTIONS — always allowed regardless of hold time:
- crash: >5% loss in <60 min (services/position/main.py:534-540)
- hard_stop: >2% loss (services/position/main.py:551-559)

Everything else (AI exit pressure, momentum TP, stale exit, signal-driven sell)
must wait HORIZON_MINUTES * 60 seconds before firing.
"""

# Matches `primary = "future_return_15m"` in services/prediction/training/data_loader.py:148.
# If the training target changes, update this constant in lockstep.
HORIZON_MINUTES: int = 15

# Exits that bypass the horizon guard — these are catastrophic/safety triggers
# and must fire as fast as possible regardless of model horizon.
BYPASS_REASONS: frozenset = frozenset({"crash", "hard_stop"})


def should_block_exit_for_horizon(hold_seconds: float, reason: str, pnl_pct: float = 0.0) -> bool:
    """Return True if this exit should be SUPPRESSED because the prediction horizon hasn't elapsed.

    Parameters
    ----------
    hold_seconds : float
        Seconds since position was opened.
    reason : str
        Classifier for the exit trigger. Bypass reasons (crash, hard_stop) always
        return False (do not block). All other reasons block until hold_seconds
        reaches HORIZON_MINUTES * 60.
    pnl_pct : float, optional
        Current PnL fraction (e.g. -0.03 = -3%). Currently unused but accepted
        for future extension (e.g. early-exit allowance when PnL is at +3 sigma).

    Returns
    -------
    bool
        True = block this exit (don't fire). False = allow this exit.
    """
    if reason in BYPASS_REASONS:
        return False
    return hold_seconds < HORIZON_MINUTES * 60
