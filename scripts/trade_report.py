#!/usr/bin/env python3
"""Detailed report of newly-closed trades + running stats, for the monitor.
Usage: trade_report.py <timestamp_str> <prev_trade_count>
Prints one rich line per new trade plus a running-stats line. Newest first
(trade_history is lpush'd, so index 0 is most recent)."""
import sys, json, os, redis

ts = sys.argv[1] if len(sys.argv) > 1 else ""
prev = int(sys.argv[2]) if len(sys.argv) > 2 else 0

env = {}
for f in ("config/trading.env", "config/.secrets.env"):
    p = os.path.join("/home/coder/Goblin", f)
    if os.path.exists(p):
        for line in open(p):
            s = line.strip()
            if "=" in s and not s.startswith("#"):
                k, _, v = s.partition("="); env.setdefault(k.strip(), v.strip())

r = redis.Redis(host="localhost", port=int(env.get("REDIS_PORT", 6379)),
                password=env.get("REDIS_PASSWORD"), decode_responses=True)
n = r.llen("trade_history")
if n <= prev:
    sys.exit(0)

new = r.lrange("trade_history", 0, n - prev - 1)  # the newly added (newest first)
for line in reversed(new):  # report oldest-of-the-new first for chronological reading
    try:
        t = json.loads(line)
        emoji = "🟢" if t.get("realized_pnl", 0) > 0 else ("🔴" if t.get("realized_pnl", 0) < 0 else "⚪")
        print(f"{ts} {emoji} TRADE {t.get('symbol','?'):12} {t.get('side','?'):5} "
              f"pnl=${t.get('realized_pnl',0):+.4f} ({t.get('pnl_pct',0)*100:+.2f}%)  "
              f"entry={t.get('entry_price')} exit={t.get('exit_price')}  "
              f"{t.get('exit_reason','')} hold={t.get('hold_time_minutes',0):.0f}m")
    except Exception:
        pass

# running aggregate across all recorded trades
allrows = []
for l in r.lrange("trade_history", 0, 99999):
    try:
        allrows.append(json.loads(l))
    except Exception:
        pass
if allrows:
    n_all = len(allrows)
    wins = sum(1 for t in allrows if t.get("realized_pnl", 0) > 0)
    losses = sum(1 for t in allrows if t.get("realized_pnl", 0) < 0)
    tot = sum(t.get("realized_pnl", 0) for t in allrows)
    gross_w = sum(t.get("realized_pnl", 0) for t in allrows if t.get("realized_pnl", 0) > 0)
    gross_l = -sum(t.get("realized_pnl", 0) for t in allrows if t.get("realized_pnl", 0) < 0)
    pf = (gross_w / gross_l) if gross_l > 0 else float("inf")
    pf_s = f"{pf:.2f}" if pf != float("inf") else "inf"
    print(f"{ts} 📊 RUNNING: {n_all} trades | {wins}W/{losses}L ({100*wins/n_all:.0f}%) | "
          f"cum realized ${tot:+.4f} | profit-factor {pf_s}")
