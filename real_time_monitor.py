#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Real-Time Trading Monitor - Live Position Tracking
Shows current positions, PnL, recent signals, trades, and price movements
"""

import ccxt
import redis
import json
import time
import os
import sys
from datetime import datetime
from colorama import init, Fore, Back, Style
from tabulate import tabulate
from collections import deque

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Initialize colorama for colored output
init(autoreset=True)

# Load environment variables
def load_env():
    """Load environment variables from config/trading.env"""
    env_file = os.path.join(os.path.dirname(__file__), 'config', 'trading.env')
    env_vars = {}

    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key.strip()] = value.strip().split('#')[0].strip().strip('"\'')
    return env_vars

# Initialize connections
env_vars = load_env()
REDIS_PASSWORD = env_vars.get('REDIS_PASSWORD', 'REMOVED_SECRET')
API_KEY = env_vars.get('MEXC_API_KEY', 'mx0vgl6agtYMo9O7Uh')
API_SECRET = env_vars.get('MEXC_SECRET_KEY', 'e81b190d61674de98f997c29c08acc2b')  # Fixed: was MEXC_API_SECRET

# Global tracking
recent_signals = deque(maxlen=10)
recent_trades = deque(maxlen=10)
holdings_tracker = {}  # Track entry prices for holdings

redis_client = redis.Redis(host='localhost', port=6379, password=REDIS_PASSWORD, decode_responses=True)
exchange = ccxt.mexc({
    'apiKey': API_KEY,
    'secret': API_SECRET,
    'enableRateLimit': True
})

def get_positions():
    """Get all positions from Redis with error handling"""
    try:
        positions_data = redis_client.hgetall("positions")
        positions = {}

        for symbol, data in positions_data.items():
            try:
                pos = json.loads(data)
                if pos.get('status') == 'open':
                    positions[symbol] = pos
            except json.JSONDecodeError:
                continue

        return positions
    except Exception as e:
        print(f"{Fore.RED}Error getting positions from Redis: {e}")
        return {}

def get_live_prices(symbols):
    """Get live prices for all symbols"""
    prices = {}
    for symbol in symbols:
        try:
            ticker = exchange.fetch_ticker(symbol)
            prices[symbol] = ticker['last']
        except Exception as e:
            prices[symbol] = None
    return prices

def get_account_balance():
    """Get account balance from executor service with live MEXC prices"""
    global holdings_tracker

    try:
        import requests
        resp = requests.get("http://localhost:8005/balance", timeout=3)
        if resp.status_code == 200:
            data = resp.json()
            balances = data.get('balances', {})
            usdt = balances.get('USDT', {}).get('total', 0)

            # Calculate total value
            total_value = usdt
            holdings = []

            for coin, info in balances.items():
                amount = info.get('total', 0)
                if amount > 0.0001 and coin != 'USDT':
                    try:
                        ticker = exchange.fetch_ticker(f"{coin}/USDT")
                        current_price = ticker['last']
                        value = amount * current_price
                        total_value += value

                        # Track entry price (first time we see this coin)
                        if coin not in holdings_tracker:
                            holdings_tracker[coin] = {
                                'entry_price': current_price,
                                'entry_value': value,
                                'amount': amount
                            }

                        # Calculate profit/loss
                        entry_price = holdings_tracker[coin]['entry_price']
                        entry_value = holdings_tracker[coin]['entry_value']
                        price_change_pct = ((current_price - entry_price) / entry_price) * 100
                        value_change = value - entry_value

                        holdings.append({
                            'coin': coin,
                            'amount': amount,
                            'entry_price': entry_price,
                            'current_price': current_price,
                            'entry_value': entry_value,
                            'current_value': value,
                            'price_change_pct': price_change_pct,
                            'value_change': value_change
                        })
                    except Exception as e:
                        pass

            return total_value, usdt, holdings
    except:
        pass
    return None, None, []

def get_recent_signals():
    """Get recent signals from Redis"""
    try:
        # Try to get from a list if signals are stored there
        signals = redis_client.lrange("recent_signals", 0, 9)
        return [json.loads(s) for s in signals]
    except:
        return list(recent_signals)

def get_recent_trades():
    """Get recent trades from Redis"""
    try:
        trades = redis_client.lrange("recent_trades", 0, 9)
        return [json.loads(t) for t in trades]
    except:
        return list(recent_trades)

def calculate_pnl(entry_price, current_price, side='long'):
    """Calculate percentage profit/loss"""
    if side == 'long':
        return ((current_price - entry_price) / entry_price) * 100
    else:
        return ((entry_price - current_price) / entry_price) * 100

def get_color_for_pnl(pnl):
    """Get color based on PnL"""
    if pnl >= 0:
        return Fore.GREEN
    else:
        return Fore.RED

def get_color_for_distance(distance):
    """Get color based on distance to target"""
    if distance <= 0.5:
        return Fore.YELLOW + Style.BRIGHT
    elif distance <= 1.0:
        return Fore.BLUE + Style.BRIGHT
    else:
        return Fore.WHITE

def print_header(total_value=None):
    """Print the header"""
    print("\n" + "="*120)
    print("🤑 MANGO COCO - REAL TIME TRADING MONITOR 🤑")
    print("="*120)
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", end="")
    if total_value:
        print(f" | Portfolio: ${total_value:.2f} USDT", end="")
    print()

    # Check Redis connection
    try:
        redis_status = "🟢 Redis" if redis_client.ping() else "🔴 Redis"
    except:
        redis_status = "🔴 Redis (disconnected)"

    # Check MEXC API
    try:
        exchange.fetch_ticker("BTC/USDT")
        mexc_status = "🟢 MEXC API"
    except:
        mexc_status = "🔴 MEXC API (error)"

    print(f"Status: {redis_status} | {mexc_status}")
    print("-"*120)

def print_positions_table(positions, prices):
    """Print positions in a nice table"""
    if not positions:
        print("📭 No open positions")
        return

    table_data = []
    alerts = []

    for symbol, pos in positions.items():
        current_price = prices.get(symbol)
        if current_price is None:
            continue

        entry_price = pos['entry_price']
        take_profit = pos['take_profit_price']
        stop_loss = pos['stop_loss_price']
        amount = pos['amount']

        pnl_pct = calculate_pnl(entry_price, current_price)
        dist_to_tp = ((take_profit - current_price) / current_price) * 100
        dist_to_sl = ((current_price - stop_loss) / current_price) * 100

        # Determine action needed
        action = ""
        action_color = Fore.WHITE

        if dist_to_tp <= 0:
            action = "🚨 TAKE-PROFIT TRIGGERED!"
            action_color = Back.GREEN + Fore.BLACK + Style.BRIGHT
            alerts.append(f"SELL {symbol} - Take-profit reached!")
        elif dist_to_sl <= 0:
            action = "🚨 STOP-LOSS TRIGGERED!"
            action_color = Back.RED + Fore.WHITE + Style.BRIGHT
            alerts.append(f"SELL {symbol} - Stop-loss reached!")
        elif dist_to_tp <= 0.5:
            action = "⚠️  NEAR TAKE-PROFIT"
            action_color = Fore.YELLOW + Style.BRIGHT
        elif dist_to_sl <= 0.5:
            action = "⚠️  NEAR STOP-LOSS"
            action_color = Fore.MAGENTA + Style.BRIGHT

        table_data.append([
            symbol,
            f"{entry_price:.6f}",
            f"{current_price:.6f}",
            f"{get_color_for_pnl(pnl_pct)}{pnl_pct:+.2f}%",
            f"{take_profit:.6f}",
            f"{get_color_for_distance(dist_to_tp)}{dist_to_tp:.2f}%",
            f"{stop_loss:.6f}",
            f"{get_color_for_distance(dist_to_sl)}{dist_to_sl:.2f}%",
            f"{amount:.4f}",
            f"{action_color}{action}"
        ])

    headers = [
        "Symbol", "Entry Price", "Current", "PnL",
        "Take-Profit", "To TP", "Stop-Loss", "To SL", "Amount", "Action"
    ]

    print(tabulate(table_data, headers=headers, tablefmt="grid"))

    # Show alerts
    if alerts:
        print("\n🚨 ALERTS:")
        for alert in alerts:
            print(f"  {Fore.RED + Style.BRIGHT}{alert}")

def print_portfolio_summary(positions, prices):
    """Print portfolio summary"""
    if not positions:
        return

    total_value = 0
    total_cost = 0

    for symbol, pos in positions.items():
        current_price = prices.get(symbol)
        if current_price is None:
            continue

        amount = pos['amount']
        entry_price = pos['entry_price']

        total_value += current_price * amount
        total_cost += entry_price * amount

    if total_cost > 0:
        total_pnl = ((total_value - total_cost) / total_cost) * 100
        print(f"\n💰 Open Positions Value: ${total_value:.4f} | Unrealized PnL: {get_color_for_pnl(total_pnl)}{total_pnl:+.2f}%")

def print_recent_signals(signals):
    """Print recent trading signals"""
    print(f"\n{Fore.CYAN}{Style.BRIGHT}🔔 RECENT SIGNALS (Last 5):")
    if not signals:
        print(f"{Fore.WHITE}  No recent signals")
        return

    for sig in signals[:5]:
        timestamp = sig.get('timestamp', datetime.now().isoformat())
        time_str = timestamp[11:19] if len(timestamp) > 19 else timestamp
        symbol = sig.get('symbol', 'UNKNOWN')
        direction = sig.get('direction', 'hold')
        confidence = sig.get('confidence', 0) * 100

        if direction == 'buy':
            color = Fore.GREEN
            emoji = "🟢"
        elif direction == 'sell':
            color = Fore.RED
            emoji = "🔴"
        else:
            continue

        print(f"  {emoji} {time_str} | {symbol:15s} | {color}{direction.upper():4s}{Fore.WHITE} | Confidence: {confidence:.0f}%")

def print_recent_trades(trades):
    """Print recent executed trades"""
    print(f"\n{Fore.GREEN}{Style.BRIGHT}💰 RECENT TRADES (Last 5):")
    if not trades:
        print(f"{Fore.WHITE}  No trades executed yet")
        return

    for trade in trades[:5]:
        timestamp = trade.get('timestamp', datetime.now().isoformat())
        time_str = timestamp[11:19] if len(timestamp) > 19 else timestamp
        symbol = trade.get('symbol', 'UNKNOWN')
        side = trade.get('side', 'unknown')
        amount = trade.get('amount', 0)
        price = trade.get('price', 0)

        if side == 'buy':
            color = Fore.GREEN
            emoji = "✅"
        else:
            color = Fore.RED
            emoji = "🔻"

        print(f"  {emoji} {time_str} | {symbol:15s} | {color}{side.upper():4s}{Fore.WHITE} | {amount:.4f} @ ${price:.6f}")

def print_balance_info(total_value, usdt, holdings):
    """Print account balance information"""
    if total_value is None:
        return

    print(f"\n{Fore.YELLOW}{Style.BRIGHT}💵 ACCOUNT BALANCE:")
    print(f"  USDT: ${usdt:.2f}")
    print(f"  {Fore.CYAN}{Style.BRIGHT}Total Portfolio Value: ${total_value:.2f} USDT")

def print_holdings_monitor(holdings):
    """Print live holdings monitor with profit/loss and targets"""
    if not holdings:
        return

    print(f"\n{Fore.CYAN}{Style.BRIGHT}📊 HOLDINGS MONITOR (Live Price Tracking):")
    print(f"{Fore.WHITE}Tracking price movements for your holdings - Shows distance to 1% profit/loss targets\n")

    table_data = []
    alerts = []

    for holding in holdings:
        coin = holding['coin']
        amount = holding['amount']
        entry_price = holding['entry_price']
        current_price = holding['current_price']
        price_change_pct = holding['price_change_pct']
        current_value = holding['current_value']
        value_change = holding['value_change']

        # Calculate distance to targets
        to_profit = 1.0 - price_change_pct  # Distance to +1%
        to_loss = -1.0 - price_change_pct   # Distance to -1%

        # Determine status and color
        if price_change_pct >= 1.0:
            status = f"{Back.GREEN}{Fore.BLACK} 🎯 SELL TARGET HIT! {Style.RESET_ALL}"
            alerts.append(f"🟢 {coin} reached +1% - BOT SHOULD SELL!")
            change_color = Fore.GREEN + Style.BRIGHT
        elif price_change_pct <= -1.0:
            status = f"{Back.RED}{Fore.WHITE} 🛑 LOSS TARGET HIT! {Style.RESET_ALL}"
            alerts.append(f"🔴 {coin} dropped -1% - BOT MIGHT BUY BACK!")
            change_color = Fore.RED + Style.BRIGHT
        elif price_change_pct >= 0.8:
            status = f"{Fore.YELLOW}⚠️  Near +1% sell target"
            change_color = Fore.YELLOW
        elif price_change_pct <= -0.8:
            status = f"{Fore.MAGENTA}⚠️  Near -1% loss target"
            change_color = Fore.MAGENTA
        elif price_change_pct > 0:
            status = f"{Fore.GREEN}📈 Profit"
            change_color = Fore.GREEN
        else:
            status = f"{Fore.RED}📉 Loss"
            change_color = Fore.RED

        table_data.append([
            coin,
            f"{amount:.4f}",
            f"${entry_price:.6f}",
            f"${current_price:.6f}",
            f"{change_color}{price_change_pct:+.2f}%{Style.RESET_ALL}",
            f"${current_value:.2f}",
            f"{change_color}${value_change:+.2f}{Style.RESET_ALL}",
            f"{to_profit:+.2f}%",
            f"{to_loss:+.2f}%",
            status
        ])

    headers = [
        "Coin", "Amount", "Entry Price", "Current Price", "Change %",
        "Value", "P/L $", "To +1%", "To -1%", "Status"
    ]

    print(tabulate(table_data, headers=headers, tablefmt="grid"))

    # Show alerts
    if alerts:
        print(f"\n{Back.YELLOW}{Fore.BLACK}{Style.BRIGHT} ⚠️  TRADING ALERTS: {Style.RESET_ALL}")
        for alert in alerts:
            print(f"  {alert}")

def main():
    """Main monitoring loop"""
    print("Starting enhanced real-time trading monitor...")
    print("📊 Holdings tracker: Entry prices locked when monitor starts")
    print("💰 Shows real-time P/L and distance to 1% targets from MEXC")
    print("Press Ctrl+C to exit\n")

    try:
        while True:
            # Clear screen (Windows compatible)
            os.system('cls' if os.name == 'nt' else 'clear')

            # Get all data
            total_value, usdt, holdings = get_account_balance()
            positions = get_positions()
            symbols = list(positions.keys())
            prices = get_live_prices(symbols) if symbols else {}
            signals = get_recent_signals()
            trades = get_recent_trades()

            # Display everything
            print_header(total_value)
            print_balance_info(total_value, usdt, holdings)
            print_holdings_monitor(holdings)
            print_positions_table(positions, prices)
            print_portfolio_summary(positions, prices)
            print_recent_signals(signals)
            print_recent_trades(trades)

            print(f"\n{Fore.CYAN}🔄 Refreshing in 5 seconds... (Ctrl+C to exit)")
            time.sleep(5)

    except KeyboardInterrupt:
        print(f"\n\n{Fore.YELLOW}👋 Monitor stopped by user")
    except Exception as e:
        print(f"\n{Fore.RED}❌ Error: {e}")
        print(f"{Fore.YELLOW}Check Redis connection and MEXC API keys")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()