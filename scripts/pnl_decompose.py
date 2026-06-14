#!/usr/bin/env python3
"""Decompose trade_history PnL to locate the dominant profit drain.
Gross (price-move) vs net-of-fees, exit-reason mix, stop slippage, by tier."""
import json, os, redis

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

rows = []
for l in r.lrange("trade_history", 0, -1):
    try: rows.append(json.loads(l))
    except Exception: pass
rows = list(reversed(rows))  # chronological

MAJORS = {"BTC","ETH","SOL","BNB","XRP","DOGE","ADA","TRX","TON","LINK","LTC",
          "DOT","AVAX","SUI","XLM","BCH","ATOM","NEAR","APT","FIL","ICP"}
def tier(sym): return "major" if sym.split("/")[0] in MAJORS else "alt"

print(f"{'symbol':12} {'tier':5} {'pnl%':>7} {'gross$':>9} {'reason':32} {'hold_m':>7}")
print("-"*82)
for t in rows:
    print(f"{t.get('symbol','?'):12} {tier(t.get('symbol','/')):5} "
          f"{t.get('pnl_pct',0)*100:>6.2f}% {t.get('realized_pnl',0):>+9.4f} "
          f"{t.get('exit_reason','')[:32]:32} {t.get('hold_time_minutes',0):>7.1f}")

def stats(label, subset, fee_each_way):
    if not subset: return
    n=len(subset)
    gross=sum(t['realized_pnl'] for t in subset)
    # fee = rate applied to both legs' notional
    fees=sum((t.get('entry_cost_usd',0)+t.get('exit_cost_usd',0))*fee_each_way for t in subset)
    net=gross-fees
    gw=sum(t['realized_pnl'] for t in subset if t['realized_pnl']>0)
    gl=-sum(t['realized_pnl'] for t in subset if t['realized_pnl']<0)
    w=sum(1 for t in subset if t['realized_pnl']>0)
    # net wins/losses
    netvals=[t['realized_pnl']-(t.get('entry_cost_usd',0)+t.get('exit_cost_usd',0))*fee_each_way for t in subset]
    nw=sum(1 for v in netvals if v>0)
    aw=(gw/w) if w else 0
    al=(gl/(n-w)) if (n-w) else 0
    pf_g=(gw/gl) if gl>0 else float('inf')
    print(f"  {label:22} n={n:2} | GROSS ${gross:+.4f} ({w}/{n} win) PF {pf_g:.2f} | "
          f"fees ${fees:.4f} | NET ${net:+.4f} ({nw}/{n} win) | avgW ${aw:+.4f} avgL ${-al:.4f}")

for rate in (0.0005, 0.001):
    print(f"\n===== fee assumption: {rate*100:.2f}% per leg ({rate*200:.2f}% round-trip) =====")
    stats("ALL", rows, rate)
    stats("majors", [t for t in rows if tier(t['symbol'])=='major'], rate)
    stats("alts", [t for t in rows if tier(t['symbol'])=='alt'], rate)

print("\n===== exit-reason breakdown =====")
from collections import Counter, defaultdict
rc=Counter(t.get('exit_reason','?') for t in rows)
rp=defaultdict(float)
for t in rows: rp[t.get('exit_reason','?')]+=t['realized_pnl']
for reason,cnt in rc.most_common():
    print(f"  {reason:34} {cnt:2}x  gross ${rp[reason]:+.4f}")

print("\n===== stop slippage (hard-floor stops: actual loss% vs -1.0% floor) =====")
for t in rows:
    if 'hard_floor' in t.get('exit_reason',''):
        slip=t.get('pnl_pct',0)*100 - (-1.0)
        print(f"  {t['symbol']:12} actual {t['pnl_pct']*100:+.2f}%  slippage {slip:+.2f}pp  hold {t.get('hold_time_minutes',0):.1f}m")

print("\n===== hold-time buckets =====")
buckets={'<5m':0,'5-15m':0,'15-60m':0,'>60m':0}
for t in rows:
    h=t.get('hold_time_minutes',0)
    k='<5m' if h<5 else '5-15m' if h<15 else '15-60m' if h<60 else '>60m'
    buckets[k]+=1
print(" ",buckets)

print("\n===== portfolio_state (open positions / cash) =====")
ps=r.get("portfolio_state")
if ps:
    try:
        d=json.loads(ps)
        print("  keys:", list(d.keys()))
        for k in ('cash','cash_usd','usdt','total_value','equity','positions','open_positions'):
            if k in d:
                v=d[k]
                print(f"  {k}: {json.dumps(v)[:300] if not isinstance(v,(int,float)) else v}")
    except Exception as e:
        print("  raw:", ps[:400])
