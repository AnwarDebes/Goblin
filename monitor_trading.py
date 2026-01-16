#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Real-time Comprehensive Trading Monitor for MangoCoco Bot
Shows positions, signals, price movements, and everything in real-time
"""
import asyncio
import json
import time
from datetime import datetime
from collections import defaultdict
import aiohttp
import redis.asyncio as aioredis
import sys

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Service endpoints
EXECUTOR = "http://localhost:8005"
POSITION = "http://localhost:8006"

# Redis connection
REDIS_HOST = "localhost"
REDIS_PORT = 6379
REDIS_PASSWORD = "REMOVED_SECRET"

# Colors for terminal (Windows compatible)
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    END = '\033[0m'

class TradingMonitor:
    def __init__(self):
        self.redis_client = None
        self.session = None
        self.price_tracker = {}  # {symbol: {entry_price, current_price, change_pct}}
        self.positions = {}
        self.recent_signals = []
        self.recent_trades = []
        self.portfolio_value = 6.40
        self.start_time = datetime.now()

    async def connect(self):
        """Initialize connections"""
        self.redis_client = await aioredis.from_url(
            f"redis://{REDIS_HOST}:{REDIS_PORT}",
            password=REDIS_PASSWORD,
            decode_responses=True
        )
        self.session = aiohttp.ClientSession()

    async def close(self):
        """Clean up connections"""
        if self.redis_client:
            await self.redis_client.close()
        if self.session:
            await self.session.close()

    async def get_positions(self):
        """Fetch current positions"""
        try:
            async with self.session.get(f"{POSITION}/positions", timeout=aiohttp.ClientTimeout(total=2)) as resp:
                if resp.status == 200:
                    return await resp.json()
        except:
            pass
        return {}

    async def get_balance(self):
        """Fetch account balance"""
        try:
            async with self.session.get(f"{EXECUTOR}/balance", timeout=aiohttp.ClientTimeout(total=2)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get('balances', {})
        except:
            pass
        return {}

    def clear_screen(self):
        """Clear terminal screen"""
        print('\033[2J\033[H', end='')

    def print_header(self):
        """Print monitor header"""
        runtime = datetime.now() - self.start_time
        runtime_str = str(runtime).split('.')[0]

        print(f"{Colors.BOLD}{Colors.CYAN}{'='*100}{Colors.END}")
        print(f"{Colors.BOLD}{Colors.CYAN}  🤖 MangoCoco Live Trading Monitor - Real Money Mode{Colors.END}")
        print(f"{Colors.CYAN}{'='*100}{Colors.END}")
        print(f"  Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | Runtime: {runtime_str} | Portfolio: ${self.portfolio_value:.2f}")
        print(f"{Colors.CYAN}{'='*100}{Colors.END}\n")

    def print_positions(self):
        """Print current open positions"""
        print(f"{Colors.BOLD}{Colors.YELLOW}📊 OPEN POSITIONS:{Colors.END}")

        if not self.positions:
            print(f"  {Colors.WHITE}No open positions{Colors.END}\n")
            return

        for symbol, pos in self.positions.items():
            entry = pos.get('entry_price', 0)
            current = pos.get('current_price', 0)
            amount = pos.get('amount', 0)
            pnl = pos.get('unrealized_pnl', 0)

            if entry > 0:
                change_pct = ((current - entry) / entry) * 100

                # Color based on P&L
                if pnl > 0:
                    color = Colors.GREEN
                    emoji = "📈"
                else:
                    color = Colors.RED
                    emoji = "📉"

                # Distance to targets
                to_profit = 1.0 - change_pct  # Distance to +1%
                to_loss = -1.0 - change_pct   # Distance to -1%

                # Check if target reached
                if change_pct >= 1.0:
                    target_status = f"{Colors.BOLD}{Colors.GREEN}🎯 PROFIT TARGET REACHED!{Colors.END}"
                elif change_pct <= -1.0:
                    target_status = f"{Colors.BOLD}{Colors.RED}🛑 STOP LOSS REACHED!{Colors.END}"
                else:
                    target_status = f"🎯 To +1% target: {to_profit:.2f}% | To -1% stop: {to_loss:.2f}%"

                print(f"  {emoji} {Colors.BOLD}{symbol}{Colors.END}")
                print(f"     Entry: ${entry:.6f} → Current: ${current:.6f}")
                print(f"     Change: {color}{change_pct:+.2f}%{Colors.END} | Amount: {amount:.4f}")
                print(f"     P&L: {color}${pnl:+.2f}{Colors.END}")
                print(f"     {target_status}")
                print()

    def print_price_movements(self):
        """Print price movements for tracked coins"""
        print(f"{Colors.BOLD}{Colors.BLUE}📈 PRICE MOVEMENTS (Top 20 movers):{Colors.END}")

        if not self.price_tracker:
            print(f"  {Colors.WHITE}Collecting price data...{Colors.END}\n")
            return

        # Sort by absolute change percentage
        sorted_prices = sorted(
            self.price_tracker.items(),
            key=lambda x: abs(x[1].get('change_pct', 0)),
            reverse=True
        )[:20]

        for symbol, data in sorted_prices:
            change_pct = data.get('change_pct', 0)
            current = data.get('current_price', 0)

            if abs(change_pct) < 0.01:  # Skip if change is too small
                continue

            # Color and emoji based on direction
            if change_pct > 0:
                color = Colors.GREEN
                emoji = "⬆️"
            else:
                color = Colors.RED
                emoji = "⬇️"

            # Highlight based on distance to target
            if abs(change_pct) >= 1.0:
                alert = f" {Colors.BOLD}{Colors.RED}🎯 TARGET REACHED!{Colors.END}"
            elif abs(change_pct) >= 0.8:
                alert = f" {Colors.YELLOW}⚠️ NEAR TARGET!{Colors.END}"
            else:
                alert = ""

            print(f"  {emoji} {symbol:15s} ${current:10.6f} {color}{change_pct:+6.2f}%{Colors.END}{alert}")

        print()

    def print_recent_signals(self):
        """Print recent trading signals"""
        print(f"{Colors.BOLD}{Colors.CYAN}🔔 RECENT SIGNALS:{Colors.END}")

        if not self.recent_signals:
            print(f"  {Colors.WHITE}No recent signals{Colors.END}\n")
            return

        for signal in self.recent_signals[-5:]:  # Last 5 signals
            timestamp = signal.get('timestamp', '')
            symbol = signal.get('symbol', '')
            direction = signal.get('direction', '')
            confidence = signal.get('confidence', 0) * 100
            rsi = signal.get('rsi', 0)

            if direction == 'buy':
                emoji = "🟢"
                color = Colors.GREEN
            elif direction == 'sell':
                emoji = "🔴"
                color = Colors.RED
            else:
                emoji = "⚪"
                color = Colors.WHITE

            print(f"  {emoji} {timestamp[11:19]} | {symbol:15s} | {color}{direction.upper():4s}{Colors.END} | Confidence: {confidence:.0f}% | RSI: {rsi:.1f}")

        print()

    def print_recent_trades(self):
        """Print recent executed trades"""
        print(f"{Colors.BOLD}{Colors.GREEN}💰 RECENT TRADES:{Colors.END}")

        if not self.recent_trades:
            print(f"  {Colors.WHITE}No trades executed yet{Colors.END}\n")
            return

        for trade in self.recent_trades[-5:]:  # Last 5 trades
            timestamp = trade.get('timestamp', '')
            symbol = trade.get('symbol', '')
            side = trade.get('side', '')
            amount = trade.get('amount', 0)
            price = trade.get('price', 0)

            if side == 'buy':
                emoji = "✅"
                color = Colors.GREEN
            else:
                emoji = "🔻"
                color = Colors.RED

            print(f"  {emoji} {timestamp[11:19]} | {symbol:15s} | {color}{side.upper():4s}{Colors.END} | {amount:.4f} @ ${price:.6f}")

        print()

    def print_stats(self):
        """Print trading statistics"""
        print(f"{Colors.BOLD}{Colors.WHITE}📊 STATISTICS:{Colors.END}")
        print(f"  Total Signals: {len(self.recent_signals)}")
        print(f"  Total Trades: {len(self.recent_trades)}")
        print(f"  Coins Tracked: {len(self.price_tracker)}")
        print(f"  Open Positions: {len(self.positions)}")
        print()

    async def update_display(self):
        """Update the display"""
        self.clear_screen()
        self.print_header()
        self.print_positions()
        self.print_price_movements()
        self.print_recent_signals()
        self.print_recent_trades()
        self.print_stats()

        print(f"{Colors.CYAN}{'='*100}{Colors.END}")
        print(f"{Colors.WHITE}Press Ctrl+C to exit{Colors.END}")

    async def track_prices(self):
        """Track price movements from Redis"""
        while True:
            try:
                # Get all latest ticks from Redis
                ticks_data = await self.redis_client.hgetall("latest_ticks")

                for symbol, tick_json in ticks_data.items():
                    tick = json.loads(tick_json)
                    current_price = tick.get('price', 0)

                    if symbol not in self.price_tracker:
                        # First time seeing this symbol
                        self.price_tracker[symbol] = {
                            'entry_price': current_price,
                            'current_price': current_price,
                            'change_pct': 0.0
                        }
                    else:
                        # Update price and calculate change
                        entry = self.price_tracker[symbol]['entry_price']
                        if entry > 0:
                            change_pct = ((current_price - entry) / entry) * 100
                            self.price_tracker[symbol]['current_price'] = current_price
                            self.price_tracker[symbol]['change_pct'] = change_pct

                await asyncio.sleep(2)  # Update every 2 seconds
            except Exception as e:
                await asyncio.sleep(5)

    async def listen_signals(self):
        """Listen to Redis pub/sub for signals and trades"""
        pubsub = self.redis_client.pubsub()
        await pubsub.subscribe(
            "trading_signals",
            "predictions:*",
            "approved_signals",
            "executed_orders",
            "position_opened",
            "position_closed"
        )

        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    channel = message["channel"]
                    data = json.loads(message["data"])

                    if channel.startswith("predictions:"):
                        # Track predictions with buy/sell direction
                        if data.get('direction') in ['buy', 'sell']:
                            data['timestamp'] = datetime.now().isoformat()
                            self.recent_signals.append(data)
                            if len(self.recent_signals) > 50:
                                self.recent_signals = self.recent_signals[-50:]

                    elif channel == "trading_signals":
                        if data.get('direction') in ['buy', 'sell']:
                            data['timestamp'] = datetime.now().isoformat()
                            self.recent_signals.append(data)
                            if len(self.recent_signals) > 50:
                                self.recent_signals = self.recent_signals[-50:]

                    elif channel == "executed_orders":
                        data['timestamp'] = datetime.now().isoformat()
                        self.recent_trades.append(data)
                        if len(self.recent_trades) > 50:
                            self.recent_trades = self.recent_trades[-50:]

                except Exception as e:
                    pass

    async def update_positions(self):
        """Periodically update positions"""
        while True:
            try:
                self.positions = await self.get_positions()
                await asyncio.sleep(1)  # Update every second
            except Exception as e:
                await asyncio.sleep(5)

    async def update_portfolio_value(self):
        """Periodically update portfolio value"""
        while True:
            try:
                balances = await self.get_balance()
                total = 0.0

                # Get USDT
                usdt = balances.get('USDT', {}).get('total', 0)
                total += usdt

                # For other coins, we'd need to fetch prices
                # For now, just use the starting value
                self.portfolio_value = total if total > 0 else 6.40

                await asyncio.sleep(10)  # Update every 10 seconds
            except Exception as e:
                await asyncio.sleep(10)

    async def display_loop(self):
        """Main display update loop"""
        while True:
            await self.update_display()
            await asyncio.sleep(1)  # Refresh display every second

    async def run(self):
        """Main monitoring loop"""
        await self.connect()
        try:
            # Start all async tasks
            await asyncio.gather(
                self.track_prices(),
                self.listen_signals(),
                self.update_positions(),
                self.update_portfolio_value(),
                self.display_loop()
            )
        except KeyboardInterrupt:
            print(f"\n\n{Colors.YELLOW}⏸️  Monitor stopped by user{Colors.END}\n")
        finally:
            await self.close()

async def main():
    monitor = TradingMonitor()
    await monitor.run()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nExiting...")
