"""Tests for horizon_guard.

Invariants:
- Crash and hard_stop exits ALWAYS fire (regardless of hold time).
- Soft exits (ai_pressure, momentum_tp, stale, signal_sell) are blocked
  until hold_seconds >= horizon_minutes * 60.
- Once horizon elapses, all reasons fire freely.
"""
from services.strategy.horizon_guard import (
    HORIZON_MINUTES,
    should_block_exit_for_horizon,
    BYPASS_REASONS,
)


def test_horizon_minutes_matches_training_target():
    """Regression canary: HORIZON_MINUTES must match the offline training target
    `future_return_15m` in services/prediction/training/data_loader.py:148.

    If the training target changes (e.g. to future_return_30m), this test
    must fail until HORIZON_MINUTES is updated in lockstep. Do NOT just
    change the asserted value to silence the test — verify the training
    target was actually changed first.
    """
    assert HORIZON_MINUTES == 15


def test_crash_always_fires_even_at_one_second():
    assert should_block_exit_for_horizon(hold_seconds=1, reason="crash") is False


def test_hard_stop_always_fires_even_at_one_second():
    assert should_block_exit_for_horizon(hold_seconds=1, reason="hard_stop") is False


def test_crash_allowed_after_horizon_too():
    """Bypass invariant: crash exits fire regardless of hold time, not just early."""
    assert should_block_exit_for_horizon(hold_seconds=15 * 60 + 1, reason="crash") is False


def test_hard_stop_allowed_after_horizon_too():
    """Bypass invariant: hard_stop exits fire regardless of hold time."""
    assert should_block_exit_for_horizon(hold_seconds=15 * 60 + 1, reason="hard_stop") is False


def test_bypass_reasons_constant_matches_behavior():
    for reason in BYPASS_REASONS:
        assert should_block_exit_for_horizon(hold_seconds=1, reason=reason) is False


def test_ai_pressure_blocked_in_early_window():
    # 4 seconds into a position, ai_pressure should be blocked
    assert should_block_exit_for_horizon(hold_seconds=4, reason="ai_pressure") is True


def test_ai_pressure_allowed_after_horizon():
    # 15 min + 1 sec
    assert should_block_exit_for_horizon(hold_seconds=15 * 60 + 1, reason="ai_pressure") is False


def test_momentum_tp_blocked_in_early_window():
    assert should_block_exit_for_horizon(hold_seconds=60, reason="momentum_tp") is True


def test_momentum_tp_allowed_after_horizon():
    assert should_block_exit_for_horizon(hold_seconds=15 * 60, reason="momentum_tp") is False


def test_stale_exit_blocked_in_early_window():
    assert should_block_exit_for_horizon(hold_seconds=60, reason="stale") is True


def test_signal_sell_blocked_in_early_window():
    assert should_block_exit_for_horizon(hold_seconds=120, reason="signal_sell") is True


def test_stale_exit_allowed_after_horizon():
    """Symmetric with test_stale_exit_blocked_in_early_window."""
    assert should_block_exit_for_horizon(hold_seconds=15 * 60, reason="stale") is False


def test_signal_sell_allowed_after_horizon():
    """Symmetric with test_signal_sell_blocked_in_early_window."""
    assert should_block_exit_for_horizon(hold_seconds=15 * 60, reason="signal_sell") is False


def test_unknown_reason_treated_as_soft_exit():
    # Defensive: any unknown reason should be blocked early (fail safe)
    assert should_block_exit_for_horizon(hold_seconds=10, reason="some_new_reason") is True


def test_boundary_exact_horizon_seconds_allows_soft_exit():
    # At exactly horizon_minutes * 60, soft exits should be allowed
    assert should_block_exit_for_horizon(hold_seconds=15 * 60, reason="ai_pressure") is False
