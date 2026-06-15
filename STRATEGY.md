# Goblin Trading Strategy

A long-only spot crypto strategy whose edge is **risk, regime, and cost engineering**,
not price prediction. This document explains how it works, why it works, and its honest
limitations, so the design can be understood and rebuilt later.

Last updated: 2026-06-15.

---

## 1. The core premise (read this first)

The single most important fact about this system:

> **The machine-learning models do NOT have a reliable per-coin directional edge.**

The TCN ensemble and XGBoost models forecast a 15-minute forward direction from public
OHLCV and derived technical features. Measured honestly (prequential / forward hit-rate
on resolved predictions), they score about **45% directional accuracy** which is
coin-flip-or-worse. This is expected: short-horizon direction from public price data on a
liquid, efficient market carries essentially no out-of-sample edge, and no architecture
swap fixes that. Any in-sample "accuracy" of 0.9+ seen in training metadata is leakage and
must not be trusted.

So the strategy is built on a different foundation. Profit, when it occurs, does **not**
come from guessing which coin goes up. It comes from four engineered advantages stacked on
top of a no-edge signal:

1. **Market-regime alignment** - only go long when the broad market (BTC) is rising.
2. **Universe discipline** - only trade liquid coins that can be exited cleanly.
3. **Exit engineering** - bank winners near their peak, cut losers small (asymmetry).
4. **Cost control** - few enough trades, and large enough moves, that fees do not eat the edge.

Everything below is the implementation of those four ideas.

---

## 2. Architecture and trade pipeline

Goblin is a set of FastAPI microservices connected by Redis pub/sub. A trade flows through:

```
market-data  -> writes candles + features to Redis
prediction   -> TCN + XGBoost inference -> publishes predictions:{symbol}
signal       -> generate_signal(): applies ALL entry gates -> raw_signals
risk         -> validate (spacing, exposure, capital) -> validated_signals
portfolio-optimizer -> Kelly-half position sizing -> sized_signals
executor     -> places the live market order on MEXC
position     -> tracks the open position, runs the 6-layer smart-stop, closes it
```

Supporting services: feature-store (serves feature vectors), continuous-learner (CL,
retrains models in the background), sentiment/trend/backtesting, api-gateway, dashboard.

State lives in Redis (AOF) and Postgres, both running as the user so they survive container
rebuilds. The whole stack auto-restarts from a boot hook with full state preservation
(positions, capital, config all reload), which has been validated under a real container
restart with zero data loss.

---

## 3. Entry discipline (the gates)

`signal/generate_signal()` only emits a `buy` if a prediction clears **every** gate, in
order. Each gate removes a category of losing trade.

1. **Confidence threshold** (`CONFIDENCE_THRESHOLD`, currently 0.60).
   The raw model confidence must clear the bar. The model tops out near 0.72, so this is a
   selectivity dial: higher = fewer, higher-conviction entries. It was run as high as 0.72
   during the worst of the bear to nearly stop trading.

2. **Per-symbol regime gate** (`regime.py`).
   Blocks entries in `choppy` regimes for the individual coin.

3. **BTC market-regime gate** (the key edge, `btc_market_risk_off()`).
   Reads BTC's own trend features (`ema_cross_9_21`, `ema_cross_25_50`, `macd_histogram`,
   `momentum_30m`, `momentum_60m`). If **3 or more of these 5 are negative**, the broad
   market is in a downtrend and the gate **blocks all new longs**. A long-only spot bot
   cannot make money buying into a falling market: alts fall harder than BTC in risk-off,
   and you are fighting the Fed, ETF flows, and whale selling. This gate alone removed the
   dominant historical loss source (longs opened into a BTC downtrend that ran straight to
   the stop). Toggle with `MARKET_REGIME_GATE`. Fail-open: if BTC data is missing it does
   not block, so a feature glitch cannot halt all trading.

4. **Liquidity gate** (the second key edge, `LIQUID_ONLY` + `LIQUID_SYMBOLS`).
   Only open longs in a curated allowlist of ~27 liquid majors and large alts (BTC, ETH,
   SOL, BNB, AVAX, SUI, XRP, DOGE, TRX, ADA, TON, LINK, LTC, DOT, XLM, BCH, ATOM, NEAR, APT,
   FIL, ICP, ONDO, ENA, PYTH, INJ, TIA, FET). The reason is concrete: a microcap (e.g.
   BLUAI) dropped 5% in a single price-refresh between monitoring ticks and blew through the
   stop, costing more in one trade than several wins recovered. Liquid coins lose small and
   clean (e.g. a major lost 0.8% on a controlled exit in the same conditions). The system
   still monitors all pairs; it just refuses to enter the unexitable ones.

5. **Fear and Greed band, trade spacing, loss cooldown.**
   F&G adjusts the required confidence in extreme zones. `MIN_TIME_BETWEEN_TRADES` caps
   churn (300s active, raised to 1800s when defending capital). A symbol that just lost must
   clear a much higher confidence to be re-entered (effectively never, short term).

The combined effect: in a risk-off market the system sits in **cash**; in a risk-on market
it deploys into **liquid leaders only**. That is the whole entry thesis.

---

## 4. The exit engine (where profit is actually made)

Because entries have no edge, the exits do the real work. They are tuned so that the
**average win is captured near its peak** while the **average loss is cut small** - an
asymmetry that turns a coin-flip entry into a positive drift during favorable windows.
All exit logic lives in `position/main.py` and `strategy/smart_stop.py`.

- **Recalibrated profit-lock.** The original lock was tuned for ~3% moves, but real moves
  at this horizon are ~1%, so winners were giving the entire gain back to a breakeven lock.
  The lock was recalibrated to the actual amplitude: it engages at a 0.5% peak and captures
  roughly 55-65% of peaks in the 0.5-2% band. The lowest lock floor is set **above the
  round-trip fee**, because a literal 0% "breakeven" lock still books a fee loss.

- **Momentum take-profit.** Once a position is up past the horizon and momentum decelerates,
  it banks the gain. This is what captures the larger winners (e.g. a +1.68% close on a coin
  that peaked higher).

- **Adaptive trailing stop** (6-layer smart-stop): ATR-based Chandelier-style distance,
  scaled by regime, momentum, volume, trend health, and AI pressure. Lets winners run in
  trends, tightens in chop.

- **Hard floor and crash protection.** A per-trade hard floor (currently -2%, widened from
  -1% to give the 15-min thesis room) and a -5% emergency crash stop. These are the
  per-trade circuit breakers.

- **Stale and patience exits.** A position flat after ~90 minutes (6x horizon) is closed to
  free capital; a position losing more than ~0.8% after 15 minutes is cut. Losers do not get
  to linger.

- **AI exit, made coherent with `INVERT_SIGNALS`.** The position manager can exit on
  accumulated model sell-pressure. Critically, this is kept consistent with the entry-side
  inversion setting: if entries invert the (anti-predictive) model, the exit inverts it too,
  so the system never closes a long on a raw sell that the thesis reads as bullish.

---

## 5. Risk management (the circuit breakers)

These bound the downside no matter what the signal does. They are never removed, even when
trading aggressively, because they are what keep the account alive to take the next trade.

- **Per-trade hard floor**: -2% (with a -5% emergency backstop).
- **Daily drawdown kill** (`DAILY_DRAWDOWN_KILL_PCT`, 0.25): halts trading for the day at
  -25%.
- **Capital balance floor** (`BALANCE_FLOOR_USD`): no new entries when free capital falls
  below this level, so the account cannot grind to zero.
- **Position sizing**: Kelly-half with a cash reserve. Position size does not change the fee
  *percentage* (fees are a fixed 0.1% of notional), so sizing is a risk dial, not a
  fee-savings dial. Smaller size = less risked per no-edge trade.

---

## 6. Why it works (honest mechanism)

In a **risk-on window**: BTC rising -> gate opens -> buy a liquid leader -> the rising tide
lifts it -> the exit banks 0.5-2% near the peak. Losers are cut at -2% and stay small and
clean because the universe is liquid. Over a sequence of such trades the wins (more, and
captured well) outweigh the small losses, and the account drifts up. This is the entire
profit mechanism: **be long quality when the market rises, in cash when it falls, never
tailed by illiquidity.**

In a **risk-off window**: the BTC gate blocks all longs and the system sits in cash,
avoiding the losses that a long-only bot would otherwise take fighting the downtrend.

The edge is therefore **conditional and structural**, not predictive. It is closer to a
disciplined trend-following / relative-strength overlay than to an alpha model.

---

## 7. Honest performance and limitations

This section exists so the document is not misleading later.

- **What has been observed (2026-06-14 to 15):** after the regime gate + liquid-only +
  recalibrated exits were deployed, the strategy stopped a fast bleed and recovered:
  cumulative realized went from about -$0.51 (its low) toward -$0.37, win rate rose from
  ~32% to ~41%, and a run of clean liquid wins (NEAR, ADA, ICP, INJ) clawed capital back
  from ~$3.68 toward ~$3.79. Every recovery trade was a liquid coin, with no microcap tail.

- **What is NOT yet true:** the account is still net-down on the session (started ~$4.42).
  Cumulative realized PnL is still negative. The recovery happened during a **BTC bounce**
  (a risk-on window inside a deeper bear). The strategy has **not** been proven across a
  full market cycle, and it has not been forward-tested through a major macro event (the
  Fed meeting on 2026-06-16/17 is the next real test).

- **The honest claim:** the strategy reliably **avoids the big losing patterns**
  (fighting the tape, microcap flash-tails, giving back winners, fee churn) and
  **captures favorable windows** cleanly. That is a real, repeatable improvement. It is
  **not** a proven money-printer, and it cannot manufacture edge that the data does not
  contain. In an extended bear with no risk-on windows, the best case is mostly-cash capital
  preservation, not profit.

- **Trust the right metric:** judge this by **realized trade outcomes** (win rate, profit
  factor, cumulative PnL by regime), never by model "accuracy", which is leaky and
  meaningless here.

---

## 8. Configuration reference

Key environment variables (in `config/trading.env`, which is gitignored because it holds
secrets):

| Variable | Role | Notes |
|---|---|---|
| `CONFIDENCE_THRESHOLD` | entry selectivity | ~0.60 active; raise toward 0.72 to defend |
| `MARKET_REGIME_GATE` | BTC trend gate on/off | the primary edge |
| `LIQUID_ONLY` / `LIQUID_SYMBOLS` | liquidity allowlist | removes microcap flash-tails |
| `MIN_TIME_BETWEEN_TRADES` | churn cap | 300s active, 1800s defensive |
| `MAX_TRADE_LOSS_PCT` | emergency per-trade cap | 0.05 |
| `DAILY_DRAWDOWN_KILL_PCT` | daily kill switch | 0.25 |
| `BALANCE_FLOOR_USD` | capital preservation floor | halts new entries below it |
| `KELLY_MODE` | sizing | `half` |
| `INVERT_SIGNALS` | use model inverted | `false` (the inversion experiment failed its test) |
| `MAX_HOLD_TIME_MINUTES` | max hold | 360 |

Smart-stop constants live in `strategy/smart_stop.py` (profit-lock tiers, hard floor,
trailing, patience). The BTC gate and liquidity gate live in `signal/main.py`.

---

## 9. Operational notes

- **Restart resilience:** the stack self-heals from a container restart via a boot hook ->
  `goblin_start.sh --resume`. Positions, capital, and all config reload from Redis/disk.
  After a restart, the event-monitor task must be re-created (its child process dies with the
  old container).
- **Single-service restart:** kill the target uvicorn by numeric PID (never `pkill -f` a
  pattern that matches your own shell), then relaunch detached with `setsid ... </dev/null`.
  Restart `signal` after changing entry gates/threshold, `risk` after spacing/hold changes,
  `position` after exit-logic changes, the relevant service after any env it reads.
- **Monitoring:** `scripts/heavy_monitor.sh` emits per-trade reports, an all-systems
  heartbeat, and a forward-edge snapshot. The drawdown warning is keyed to 80% of the real
  daily-kill so it does not cry wolf.

---

## 10. One-line summary

Treat the model as having no edge; make money by being long liquid leaders only when the
broad market is rising, banking winners near their peak and cutting losers small, with hard
circuit breakers - and stay in cash the rest of the time.
