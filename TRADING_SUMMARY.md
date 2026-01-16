# MangoCoco Trading Bot - Live Configuration Summary

**Last Updated:** 2026-01-15

## ✅ System Status: LIVE & READY

All services are running with real money trading enabled on MEXC.

---

## 💰 Portfolio Configuration

**Total Portfolio Value:** $6.40 USDT

**Holdings:**
- DOT: 0.48 = $1.06
- ALGO: 7.89 = $1.06
- DOGE: 7.34 = $1.06
- LUM: 1.54 = $1.04
- UNI: 0.19 = $1.04
- PYTH: 8.84 = $0.60
- USDT: 0.54 = $0.54

---

## ⚙️ Trading Parameters

### Position Sizing:
- **Starting Capital:** $6.40
- **Trade Size:** ~$6.08 per trade (95% of portfolio)
- **Minimum Order:** $1.00 (MEXC requirement)
- **Max Open Positions:** 2 at a time
- **Time Between Trades:** 60 seconds minimum

### Profit/Loss Targets:
- **Profit Target:** 1% (+0.90% net after 0.1% fees)
- **Stop Loss:** 1% (-1.10% net after 0.1% fees)
- **Max Hold Time:** 60 minutes
- **Max Daily Loss:** 50% of portfolio

### Risk Note:
With 1%/1% targets, you lose slightly more (-1.10%) than you win (+0.90%) per trade.
This is for TESTING automation speed. For profitable long-term trading, consider 2% profit / 1% loss.

---

## 📊 AI Trading Strategy

**Strategy Type:** RSI + Momentum

**Buy Signal Requirements (ALL must be true):**
1. RSI ≤ 35 (oversold - price dropping recently)
2. Momentum > 2% (upward price movement)
3. Volume Spike > 5% (increased trading activity)

**Sell Signal Requirements (ALL must be true):**
1. RSI ≥ 65 (overbought - price rising recently)
2. Momentum < -2% (downward price movement)
3. Volume Spike > 5% (increased trading activity)

**Trading Pairs:** 170+ coins including BTC, ETH, SOL, DOGE, ALGO, DOT, UNI, and many more

**Scan Frequency:** Every ~16 seconds across all pairs

---

## 🎯 What RSI Means

**RSI (Relative Strength Index)** is a 0-100 indicator:

- **RSI ≤ 35:** Coin is OVERSOLD (dropping fast) → Likely to bounce UP → BUY signal
- **RSI ≥ 65:** Coin is OVERBOUGHT (rising fast) → Likely to drop DOWN → SELL signal
- **RSI 40-60:** Neutral zone → No action

---

## 🚀 How Automation Works

1. **Market Data Service** fetches prices for 170+ coins every ~16 seconds
2. **Prediction Service** calculates RSI + momentum for each coin
3. **Signal Service** generates buy/sell signals when conditions are met
4. **Risk Service** validates signals (checks capital, position limits, timing)
5. **Executor Service** places orders on MEXC exchange
6. **Position Service** tracks trades and closes at 1% profit or 1% loss

**Everything is automatic** - no manual intervention needed!

---

## 📱 Monitoring Commands

### Quick Status Check:
```bash
python check_status.py
```

### Real-time Signal Monitor:
```bash
python watch_signals.py
```

### Portfolio Value Check:
```bash
python calculate_portfolio.py
```

### Comprehensive Trading Monitor:
```bash
python monitor_trading.py
```

### Check Service Logs:
```bash
docker logs mc-prediction --tail 50    # See prediction signals
docker logs mc-executor --tail 50      # See order executions
docker logs mc-position --tail 50      # See position tracking
```

---

## 🎰 Expected Trading Behavior

**With 1% targets, you should see:**
- Trades every **5-30 minutes** (depending on market volatility)
- Quick in-and-out (most trades close within 1-60 minutes)
- Frequent activity = good for testing automation

**The bot will automatically:**
- ✅ Buy coins when RSI ≤ 35 + momentum + volume align
- ✅ Sell your existing holdings (DOT, ALGO, DOGE, etc.) when RSI ≥ 65
- ✅ Close positions at 1% profit or 1% loss
- ✅ Stop trading if daily loss exceeds 50% ($3.20)
- ✅ Respect 60-second cooldown between trades

---

## 📈 Sample Trade Example

**Scenario:** ALGO shows buy signal

1. **Signal Detection:**
   - ALGO RSI drops to 28 (oversold)
   - Momentum turns positive (+3%)
   - Volume spikes 7%

2. **Bot Action:**
   - Sells current $1.06 of ALGO holdings
   - Buys $6.08 worth of new coin showing signal

3. **Position Management:**
   - Monitors price every 100ms
   - Closes at 1% gain ($6.14) or 1% loss ($6.02)
   - Or closes after 60 minutes max hold time

4. **Result:**
   - Net gain: ~$0.05 (after 0.1% MEXC fees)
   - Or net loss: ~$0.07 (after fees)

---

## ⚠️ Important Notes

1. **Real Money:** All trades use your actual MEXC account balance
2. **Commission:** MEXC charges 0.05% per trade side (0.1% total)
3. **Minimum Order:** $1.00 USDT per trade (MEXC requirement)
4. **Testing Mode:** 1% targets = fast trades but slight loss bias
5. **Risk:** You can lose up to 50% ($3.20) per day before bot stops

---

## 🔧 Service Health

Check all services are running:
```bash
docker-compose ps
```

All services should show "healthy" status.

---

## 📞 Support

For issues or questions:
- GitHub: https://github.com/anthropics/claude-code/issues

---

**Bot Status:** 🟢 LIVE - Scanning 170+ coins for trading opportunities

**Next Step:** Run `python watch_signals.py` to see real-time trading activity!
