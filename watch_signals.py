#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Live Signal & Trade Watcher for MangoCoco Bot
Watch real-time signals, risk decisions, and actual buy/sell executions
"""
import asyncio
import json
from datetime import datetime
import redis.asyncio as aioredis
import sys

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Redis connection
REDIS_HOST = "localhost"
REDIS_PORT = 6379
REDIS_PASSWORD = "REMOVED_SECRET"

# Colors for terminal
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    END = '\033[0m'

class SignalWatcher:
    def __init__(self):
        self.redis_client = None
        self.signal_count = 0
        self.buy_signal_count = 0
        self.sell_signal_count = 0
        self.approved_count = 0
        self.rejected_count = 0
        self.executed_count = 0
        self.start_time = datetime.now()

    async def connect(self):
        """Initialize Redis connection"""
        self.redis_client = await aioredis.from_url(
            f"redis://{REDIS_HOST}:{REDIS_PORT}",
            password=REDIS_PASSWORD,
            decode_responses=True
        )

    async def close(self):
        """Clean up connection"""
        if self.redis_client:
            await self.redis_client.close()

    def print_header(self):
        """Print initial header"""
        runtime = datetime.now() - self.start_time
        runtime_str = str(runtime).split('.')[0]

        print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*100}{Colors.END}")
        print(f"{Colors.BOLD}{Colors.CYAN}  🔴 LIVE Signal & Trade Watcher - Real Money Mode{Colors.END}")
        print(f"{Colors.CYAN}{'='*100}{Colors.END}")
        print(f"  Started: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')} | Runtime: {runtime_str}")
        print(f"{Colors.CYAN}{'='*100}{Colors.END}\n")
        print(f"{Colors.WHITE}Watching for signals and trades...{Colors.END}\n")

    def print_stats(self):
        """Print current statistics"""
        print(f"\n{Colors.BOLD}{Colors.WHITE}📊 SESSION STATS:{Colors.END}")
        print(f"  Signals Generated: {self.signal_count} (🟢 {self.buy_signal_count} BUY | 🔴 {self.sell_signal_count} SELL)")
        print(f"  Risk Decisions: ✅ {self.approved_count} Approved | ❌ {self.rejected_count} Rejected")
        print(f"  Trades Executed: {self.executed_count}")
        print(f"{Colors.WHITE}Press Ctrl+C to exit{Colors.END}\n")

    def format_timestamp(self):
        """Get formatted timestamp"""
        return datetime.now().strftime('%H:%M:%S')

    async def listen(self):
        """Listen to Redis pub/sub for all trading events"""
        pubsub = self.redis_client.pubsub()

        # Subscribe to all relevant channels
        await pubsub.subscribe(
            "predictions:*",       # Prediction signals
            "raw_signals",         # Signal service output
            "approved_signals",    # Risk-approved signals
            "rejected_signals",    # Risk-rejected signals
            "executed_orders",     # Executor output
            "position_opened",     # Position opened
            "position_closed",     # Position closed
            "position_price_update" # Price updates
        )

        self.print_header()

        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    channel = message["channel"]
                    data = json.loads(message["data"])
                    timestamp = self.format_timestamp()

                    # PREDICTION SIGNALS
                    if channel.startswith("predictions:"):
                        symbol = data.get('symbol', 'UNKNOWN')
                        direction = data.get('direction', 'hold')
                        confidence = data.get('confidence', 0) * 100
                        rsi = data.get('rsi', 0)
                        momentum = data.get('momentum', 0) * 100

                        if direction == 'buy':
                            self.signal_count += 1
                            self.buy_signal_count += 1
                            print(f"{Colors.GREEN}🟢 [{timestamp}] BUY SIGNAL{Colors.END}")
                            print(f"   Symbol: {Colors.BOLD}{symbol}{Colors.END}")
                            print(f"   RSI: {rsi:.1f} | Momentum: {momentum:+.2f}% | Confidence: {confidence:.0f}%")
                            print()

                        elif direction == 'sell':
                            self.signal_count += 1
                            self.sell_signal_count += 1
                            print(f"{Colors.RED}🔴 [{timestamp}] SELL SIGNAL{Colors.END}")
                            print(f"   Symbol: {Colors.BOLD}{symbol}{Colors.END}")
                            print(f"   RSI: {rsi:.1f} | Momentum: {momentum:+.2f}% | Confidence: {confidence:.0f}%")
                            print()

                    # RAW SIGNALS FROM SIGNAL SERVICE
                    elif channel == "raw_signals":
                        signal_id = data.get('signal_id', '')
                        symbol = data.get('symbol', '')
                        action = data.get('action', '')
                        amount = data.get('amount', 0)
                        price = data.get('price', 0)

                        color = Colors.GREEN if action == 'buy' else Colors.RED
                        emoji = "🟢" if action == 'buy' else "🔴"

                        print(f"{color}{emoji} [{timestamp}] SIGNAL TO RISK MANAGER{Colors.END}")
                        print(f"   Symbol: {Colors.BOLD}{symbol}{Colors.END} | Action: {action.upper()}")
                        print(f"   Amount: {amount:.4f} | Price: ${price:.6f} | Value: ${amount*price:.2f}")
                        print()

                    # APPROVED BY RISK MANAGER
                    elif channel == "approved_signals":
                        self.approved_count += 1
                        symbol = data.get('symbol', '')
                        action = data.get('action', '')
                        amount = data.get('amount', 0)
                        price = data.get('price', 0)

                        color = Colors.GREEN if action == 'buy' else Colors.RED

                        print(f"{Colors.BOLD}{Colors.GREEN}✅ [{timestamp}] APPROVED BY RISK MANAGER{Colors.END}")
                        print(f"   Symbol: {Colors.BOLD}{symbol}{Colors.END} | Action: {color}{action.upper()}{Colors.END}")
                        print(f"   Amount: {amount:.4f} | Price: ${price:.6f}")
                        print(f"   {Colors.YELLOW}→ Sending to Executor...{Colors.END}")
                        print()

                    # REJECTED BY RISK MANAGER
                    elif channel == "rejected_signals":
                        self.rejected_count += 1
                        symbol = data.get('symbol', '')
                        reason = data.get('reason', 'unknown')

                        print(f"{Colors.RED}❌ [{timestamp}] REJECTED BY RISK MANAGER{Colors.END}")
                        print(f"   Symbol: {symbol} | Reason: {reason}")
                        print()

                    # ORDER EXECUTED ON EXCHANGE
                    elif channel == "executed_orders":
                        self.executed_count += 1
                        symbol = data.get('symbol', '')
                        side = data.get('side', '')
                        amount = data.get('amount', 0)
                        price = data.get('price', 0)
                        order_id = data.get('order_id', '')
                        status = data.get('status', '')

                        if side == 'buy':
                            emoji = "💰"
                            color = Colors.GREEN
                        else:
                            emoji = "💸"
                            color = Colors.RED

                        print(f"{Colors.BOLD}{color}{emoji} [{timestamp}] TRADE EXECUTED ON MEXC!{Colors.END}")
                        print(f"   Symbol: {Colors.BOLD}{symbol}{Colors.END}")
                        print(f"   Side: {color}{side.upper()}{Colors.END} | Amount: {amount:.4f}")
                        print(f"   Price: ${price:.6f} | Total: ${amount*price:.2f}")
                        print(f"   Order ID: {order_id}")
                        print(f"   Status: {status}")
                        print()

                    # POSITION OPENED
                    elif channel == "position_opened":
                        symbol = data.get('symbol', '')
                        side = data.get('side', '')
                        entry_price = data.get('entry_price', 0)
                        amount = data.get('amount', 0)

                        print(f"{Colors.BOLD}{Colors.CYAN}📊 [{timestamp}] POSITION OPENED{Colors.END}")
                        print(f"   Symbol: {Colors.BOLD}{symbol}{Colors.END} | Side: {side.upper()}")
                        print(f"   Entry: ${entry_price:.6f} | Amount: {amount:.4f}")
                        print(f"   🎯 Target: +1% profit | Stop: -1% loss")
                        print()

                    # POSITION CLOSED
                    elif channel == "position_closed":
                        symbol = data.get('symbol', '')
                        pnl = data.get('pnl', 0)
                        total_pnl = data.get('total_pnl', 0)

                        if pnl > 0:
                            emoji = "🎉"
                            color = Colors.GREEN
                            result = "PROFIT"
                        else:
                            emoji = "😔"
                            color = Colors.RED
                            result = "LOSS"

                        print(f"{Colors.BOLD}{emoji} [{timestamp}] POSITION CLOSED - {result}{Colors.END}")
                        print(f"   Symbol: {symbol}")
                        print(f"   P&L: {color}${pnl:+.2f}{Colors.END} | Total P&L: ${total_pnl:+.2f}")
                        print()

                    # POSITION PRICE UPDATE (only show every 10th update to avoid spam)
                    elif channel == "position_price_update":
                        # Skip most updates to reduce noise
                        pass

                except Exception as e:
                    print(f"{Colors.RED}Error processing message: {e}{Colors.END}")

    async def run(self):
        """Main run loop"""
        await self.connect()
        try:
            await self.listen()
        except KeyboardInterrupt:
            self.print_stats()
            print(f"\n{Colors.YELLOW}⏸️  Watcher stopped by user{Colors.END}\n")
        finally:
            await self.close()

async def main():
    watcher = SignalWatcher()
    await watcher.run()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nExiting...")
