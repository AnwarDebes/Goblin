#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Calculate total portfolio value from MEXC balance
"""
import requests
import sys
import ccxt

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

def get_portfolio_value():
    # Get balance from executor service
    print("Fetching balances...")
    balance_resp = requests.get("http://localhost:8005/balance", timeout=5)
    balances = balance_resp.json()["balances"]

    # Initialize MEXC exchange for price data
    print("Connecting to MEXC for price data...")
    exchange = ccxt.mexc()

    total_usd = 0.0
    holdings = []

    print("\n" + "="*80)
    print("  Portfolio Value Calculator")
    print("="*80 + "\n")

    for coin, data in balances.items():
        amount = data["total"]
        if amount < 0.0001:  # Skip dust
            continue

        if coin == "USDT":
            value_usd = amount
            price = 1.0
        else:
            # Try to get price from MEXC
            symbol = f"{coin}/USDT"
            try:
                ticker = exchange.fetch_ticker(symbol)
                price = ticker['last']
                value_usd = amount * price
            except Exception as e:
                print(f"⚠️  {coin}: Could not fetch price ({e})")
                continue

        total_usd += value_usd
        holdings.append({
            "coin": coin,
            "amount": amount,
            "price": price,
            "value_usd": value_usd
        })

    # Sort by value
    holdings.sort(key=lambda x: x["value_usd"], reverse=True)

    print("Holdings:")
    for h in holdings:
        print(f"  {h['coin']:10s} {h['amount']:12.4f} @ ${h['price']:10.6f} = ${h['value_usd']:8.2f}")

    print("\n" + "-"*80)
    print(f"  💰 Total Portfolio Value: ${total_usd:.2f} USDT")
    print("="*80 + "\n")

    # Check MEXC minimum order size
    print("Checking MEXC minimum order requirements...")
    try:
        markets = exchange.load_markets()
        btc_market = markets.get('BTC/USDT', {})
        limits = btc_market.get('limits', {})
        cost_min = limits.get('cost', {}).get('min', 'N/A')
        print(f"  MEXC Minimum Order Value: ${cost_min} USDT")
    except Exception as e:
        print(f"  Could not fetch market limits: {e}")

    print()
    return total_usd, holdings

if __name__ == "__main__":
    try:
        total, holdings = get_portfolio_value()
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
