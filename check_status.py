#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Quick Status Check for MangoCoco Trading Bot
"""
import requests
import json
import sys

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

def print_header(title):
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}")

def check_service(name, url):
    try:
        resp = requests.get(f"{url}/health", timeout=2)
        status = "✅ Online" if resp.status_code == 200 else f"⚠️  Status {resp.status_code}"
    except:
        status = "❌ Offline"
    print(f"  {name:20s} {status}")

def get_positions():
    try:
        resp = requests.get("http://localhost:8006/positions", timeout=2)
        if resp.status_code == 200:
            return resp.json()
    except:
        pass
    return {}

def main():
    print_header("🤖 MangoCoco Trading Bot - Status Check")

    print("\n📡 Service Health:")
    check_service("API Gateway", "http://localhost:8080")
    check_service("Market Data", "http://localhost:8001")
    check_service("Prediction", "http://localhost:8002")
    check_service("Signal", "http://localhost:8003")
    check_service("Risk Manager", "http://localhost:8004")
    check_service("Executor", "http://localhost:8005")
    check_service("Position Manager", "http://localhost:8006")

    print("\n📊 Current Positions:")
    positions = get_positions()

    if not positions:
        print("  No open positions")
    else:
        for symbol, pos in positions.items():
            entry = pos.get('entry_price', 0)
            current = pos.get('current_price', 0)
            amount = pos.get('amount', 0)
            pnl = pos.get('unrealized_pnl', 0)
            pnl_pct = ((current - entry) / entry * 100) if entry > 0 else 0

            status_icon = "📈" if pnl > 0 else "📉" if pnl < 0 else "➡️"
            print(f"\n  {status_icon} {symbol}")
            print(f"     Side: {pos.get('side', 'N/A').upper()}")
            print(f"     Amount: {amount:.4f}")
            print(f"     Entry: ${entry:.6f}")
            print(f"     Current: ${current:.6f}")
            print(f"     PnL: ${pnl:.2f} ({pnl_pct:+.2f}%)")
            print(f"     Status: {pos.get('status', 'N/A')}")

    print("\n" + "="*80)

if __name__ == "__main__":
    main()
