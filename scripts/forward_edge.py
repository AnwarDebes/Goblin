#!/usr/bin/env python3
"""Forward-edge report: per-pair 10-minute prequential hit-rate.

This is the honest scoreboard. For every prediction the continuous learner
records, the actual price 10 minutes later is checked; correct/wrong are
accumulated per pair (pq:correct / pq:wrong / pq:resolved in Redis). Unlike
the model's train/test "accuracy" (which is leakage), this measures real
forward predictive skill on data the model never trained on.

hit_rate = correct / (correct + wrong);  0.50 = coin-flip.
Verdict needs a real sample (n >= 100) before it means anything.
"""
import os
import sys
import redis

env = {}
for f in ("config/trading.env", "config/.secrets.env"):
    p = os.path.join("/home/coder/Goblin", f)
    if os.path.exists(p):
        for line in open(p):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env.setdefault(k.strip(), v.strip())

r = redis.Redis(host="localhost", port=int(env.get("REDIS_PORT", 6379)),
                password=env.get("REDIS_PASSWORD"), decode_responses=True)

correct = r.hgetall("pq:correct") or {}
wrong = r.hgetall("pq:wrong") or {}
resolved = r.hgetall("pq:resolved") or {}
syms = sorted(set(correct) | set(wrong) | set(resolved))

if not syms:
    print("No prequential data yet — accumulates as predictions resolve (10-min horizon).")
    print("Give it a few hours of live running for a trustworthy sample.")
    sys.exit(0)

print(f"{'pair':12} {'n_dir':>6} {'hit%':>6} {'edge':>7}  verdict")
print("-" * 52)
rows = []
tot_c = tot_w = 0
for s in syms:
    c = float(correct.get(s, 0)); w = float(wrong.get(s, 0))
    n = c + w
    tot_c += c; tot_w += w
    hr = c / n if n else 0.0
    edge = hr - 0.5
    if n < 100:
        verdict = f"insufficient (n={int(n)})"
    elif edge >= 0.03:
        verdict = "EDGE — favor"
    elif edge <= -0.03:
        verdict = "ANTI — cut/flip"
    else:
        verdict = "coin-flip"
    rows.append((edge if n >= 100 else -99, s, int(n), hr, edge, verdict))

for _, s, n, hr, edge, verdict in sorted(rows, reverse=True):
    print(f"{s:12} {n:6d} {hr*100:5.1f}% {edge*100:+6.1f}%  {verdict}")

tn = tot_c + tot_w
print("-" * 52)
if tn:
    print(f"{'OVERALL':12} {int(tn):6d} {tot_c/tn*100:5.1f}% {(tot_c/tn-0.5)*100:+6.1f}%  "
          f"{'system has forward edge' if tot_c/tn > 0.52 else 'no edge (coin-flip or worse)'}")
