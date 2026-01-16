# MangoCoco - Short-Term Momentum Crypto Trading Bot

> **⚠️ PROPRIETARY SOFTWARE - ALL RIGHTS RESERVED**
>
> Copyright © 2026. This is private, proprietary software.
>
> **NO LICENSE IS GRANTED.** Unauthorized use, copying, modification, or distribution is strictly prohibited.
>
> See LICENSE file for full terms.

---

MangoCoco is a **short-term momentum-based cryptocurrency trading bot** that uses RSI indicators, price momentum, and volume analysis to identify profitable trading opportunities on MEXC exchange.

**Strategy**: Buy oversold assets with upward momentum, sell overbought assets with downward momentum. Multiple small trades for consistent profits.

## Features

- **Momentum + RSI Strategy**: Technical analysis based trading signals
- **Real-Time Market Data**: WebSocket streaming from MEXC
- **Conservative Risk Management**: 25% max position size, 10% daily loss limit
- **Microservices Architecture**: 7 specialized services for reliability
- **Live Dashboard**: Enhanced React UI with real-time P&L tracking
- **TimescaleDB**: Time-series data storage for analytics
- **Fast Execution**: 15-second signal generation, 30-second trade intervals

## System Architecture

```
┌─────────────┐
│   Terminal   │ (Web UI - Port 8080)
│  (Signals &  │
│   P&L Live)  │
└──────┬──────┘
       │
┌──────▼──────────┐
│  API Gateway    │ (Port 8080)
│ (Central Hub)   │
└──────┬──────────┘
       │
       ├──► Market Data Service (MEXC WebSocket)
       ├──► Prediction Service (RSI + Momentum)
       ├──► Signal Service (Buy/Sell Signals)
       ├──► Risk Service (Position Limits)
       ├──► Executor Service (Order Execution)
       └──► Position Service (P&L Tracking)
```

## Requirements

### Server Requirements
- **OS**: Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- **CPU**: 2+ cores
- **RAM**: 4GB minimum (8GB recommended)
- **Storage**: 20GB free space
- **Network**: Stable internet connection

### Software Requirements
- Docker 20.10+
- Docker Compose 2.0+
- Git

### Trading Requirements
- MEXC account with API access
- Minimum $5 USDT capital (recommended)
- Server IP whitelisted in MEXC API settings

## Quick Start

### 1. Verify Your Setup

Your configuration is already prepared with:
- ✅ MEXC API credentials configured
- ✅ Optimized settings for short-term trading
- ✅ Conservative risk management (25% max position)

### 2. Test Trading Capability (Important!)

Before going live, test that your bot can actually trade:

```bash
# Run the test script
python3 test_trading.py
```

This will:
- Test Redis connection
- Verify MEXC API access
- Optionally place a tiny test order ($0.10)

### 3. Start Trading

```bash
# Create data directories
mkdir -p shared/redis-data shared/timescale-data logs

# Start all services
docker compose up -d --build
```

This starts 9 containers:
- 7 trading services
- Redis (messaging)
- TimescaleDB (data)
- Dashboard (monitoring)

### 4. Monitor Your Bot

**Terminal**: `http://localhost:8080`
- Real-time portfolio P&L
- Live price charts
- Current AI signals
- Open positions with entry times
- System health status

**API Status**: `http://localhost:8080/status`

### 5. Watch Trading Activity

```bash
# View all service logs
docker compose logs -f

# Monitor specific service
docker compose logs -f executor  # Order execution
docker compose logs -f signal    # Trading signals
docker compose logs -f prediction # AI predictions
```

## Trading Strategy Explained

### Momentum + RSI Strategy

The bot uses a **short-term momentum strategy** with technical indicators:

1. **RSI (Relative Strength Index)**:
   - **BUY** when RSI ≤ 25 (oversold)
   - **SELL** when RSI ≥ 75 (overbought)

2. **Momentum Confirmation**:
   - Buy signals need upward price momentum (>0.1%)
   - Sell signals need downward price momentum (<-0.1%)

3. **Volume Spike Filter**:
   - Only trade when volume is 1.5x recent average
   - Confirms market interest in the move

4. **Position Management**:
   - Hold positions maximum 5 minutes
   - Take profit at 0.8% gain
   - Stop loss at 0.5% loss

### Expected Performance

- **Target**: 0.5-1% profit per trade
- **Frequency**: Multiple trades per hour
- **Risk**: Conservative position sizing
- **Holding**: Short-term (minutes, not hours)

## Configuration (Already Optimized)

Your settings are pre-configured for safe short-term trading:

```env
# Conservative position sizing
MAX_POSITION_PCT=0.25          # Max 25% per trade
MIN_POSITION_USD=0.20          # Min $0.20 trades
MAX_DAILY_LOSS_PCT=0.10        # Stop at 10% daily loss
MAX_OPEN_POSITIONS=1           # Only 1 position at a time

# Fast signal generation
MIN_TIME_BETWEEN_TRADES=30     # 30 seconds between trades

# Strategy parameters
RSI_OVERSOLD=25                # Buy when RSI <= 25
RSI_OVERBOUGHT=75              # Sell when RSI >= 75
PROFIT_TARGET_PCT=0.8          # Take profit at 0.8%
STOP_LOSS_PCT=0.5              # Stop loss at 0.5%
```

## GPU Support (Optional)

For faster ML predictions, enable GPU support:

1. Install NVIDIA Docker runtime:
```bash
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update
sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker
```

2. Uncomment GPU section in `docker-compose.yml`:
```yaml
prediction:
  # ...
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

3. Set in `.env`:
```env
USE_GPU=true
```

## Monitoring & Performance Tracking

### Live Terminal (`http://localhost:8080`)

The enhanced terminal shows:

1. **Portfolio Overview**:
   - Total capital and available balance
   - Daily P&L with color coding
   - Number of open positions

2. **Current Signals**:
   - Latest buy/sell signals from AI
   - Confidence levels and prices
   - Real-time signal generation

3. **AI Predictions**:
   - Current market predictions
   - RSI values and momentum indicators
   - Signal strength confidence

4. **Open Positions**:
   - Entry price and current price
   - Unrealized P&L with percentages
   - Position duration (minutes held)
   - Amount and value tracking

5. **Price Charts**:
   - Live BTC/USDT price movement
   - 30-point rolling chart

### System Health Monitoring

```bash
# Check all services
curl http://localhost:8080/status

# Monitor trading activity
docker compose logs -f executor

# View signal generation
docker compose logs -f prediction
```

### Performance Tracking

**Daily Goals**:
- Target: 2-5% daily profit
- Risk: Maximum 10% daily loss
- Trades: 10-20 trades per day

**Weekly Review**:
- Check total P&L
- Review win/loss ratio
- Adjust position sizes if needed

**Monthly Assessment**:
- Calculate total return
- Review strategy effectiveness
- Consider strategy refinements

### Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f market-data
docker compose logs -f executor

# Follow new logs only
docker compose logs -f --tail=100
```

## API Endpoints

Base URL: `http://localhost:8080`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/status` | GET | System health check |
| `/api/balance` | GET | Account balance |
| `/api/tickers` | GET | Current prices |
| `/api/positions` | GET | Open positions |
| `/api/signals` | GET | Recent signals |
| `/api/predictions` | GET | Latest predictions |
| `/api/trades` | GET | Trade history |

## Troubleshooting & Maintenance

### Bot Not Trading

1. **Check Terminal**: Visit `http://localhost:8080`
   - Look for "Current Signals" section
   - Check if signals are being generated

2. **Verify Market Data**:
```bash
# Check if prices are streaming
curl http://localhost:8080/api/tickers
```

3. **Check Service Health**:
```bash
# All services should be healthy
curl http://localhost:8080/status
```

4. **Review Logs**:
```bash
# Check for errors
docker compose logs -f prediction
docker compose logs -f signal
```

### No Signals Being Generated

- **RSI Conditions**: Market may not be oversold/overbought
- **Volume Filter**: Trading volume may be too low
- **Momentum**: Price may not have sufficient momentum
- **Wait**: Strategy needs time to collect market data

### Orders Failing

```bash
# Check MEXC API connection
curl http://localhost:8080/api/balance

# Verify API keys (don't log the actual keys)
docker compose logs executor
```

### Dashboard Not Loading

```bash
# Check API gateway (terminal)
docker compose logs api-gateway

# Restart API gateway
docker compose restart api-gateway
```

### Performance Issues

If the bot is too slow:

```bash
# Check system resources
docker stats

# Restart services
docker compose restart
```

### Emergency Stop

To stop all trading immediately:

```bash
# Stop all services
docker compose down

# Or just stop trading services
docker compose stop prediction signal executor
```

### Reset Everything

**⚠️ WARNING: This deletes all data**

```bash
# Stop and remove all data
docker compose down -v
rm -rf shared/redis-data shared/timescale-data logs

# Restart fresh
docker compose up -d --build
```

## Maintenance

### Backup

```bash
# Backup database
docker exec mc-timescaledb pg_dump -U mangococo mangococo > backup_$(date +%Y%m%d).sql

# Backup configuration
cp config/.env config/.env.backup
```

### Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose down
docker compose up -d --build
```

### Clean Up

```bash
# Remove stopped containers
docker compose down

# Remove all data (start fresh)
docker compose down -v
rm -rf shared/redis-data shared/timescale-data
```

## Performance Tuning

### For Low Capital ($5-$50)
```env
MIN_POSITION_USD=5.00
MAX_OPEN_POSITIONS=2
CONFIDENCE_THRESHOLD=0.70      # Higher confidence
```

### For Medium Capital ($50-$500)
```env
MIN_POSITION_USD=10.00
MAX_OPEN_POSITIONS=3
CONFIDENCE_THRESHOLD=0.65
```

### For Higher Capital ($500+)
```env
MIN_POSITION_USD=25.00
MAX_OPEN_POSITIONS=5
CONFIDENCE_THRESHOLD=0.60
TRADING_PAIRS=BTC/USDT,ETH/USDT,SOL/USDT,BNB/USDT,MATIC/USDT
```

## Security Best Practices

1. **Never commit `.env` file**
   - Already in `.gitignore`
   - Double-check before pushing

2. **Restrict API permissions**
   - Only enable "Spot Trading"
   - Disable "Withdraw" permission

3. **Use IP whitelist**
   - Add only your server IP in MEXC

4. **Rotate API keys regularly**
   - Change keys every 30-90 days

5. **Monitor unusual activity**
   - Check logs daily
   - Set up alerts

6. **Secure your server**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Enable firewall
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 8080/tcp  # API
sudo ufw allow 8080/tcp  # Terminal
sudo ufw enable

# Disable password auth (use SSH keys)
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
sudo systemctl restart sshd
```

## Strategy Performance Expectations

### Realistic Goals

**Daily Performance**:
- **Conservative**: 1-2% daily profit
- **Optimistic**: 3-5% daily profit
- **Risk**: Maximum 10% daily loss limit

**Monthly Returns**:
- **Target**: 30-50% monthly return
- **Expected**: 15-25% monthly return
- **Worst Case**: Break even or small loss

### Risk Management

- **Position Size**: Maximum 25% of capital per trade
- **Daily Loss Limit**: 10% stop-loss
- **Trade Frequency**: 10-20 trades per day
- **Holding Time**: 5 minutes maximum per position

### Monitoring Checklist

**Daily**:
- [ ] Check dashboard for P&L
- [ ] Review executed trades
- [ ] Monitor system health
- [ ] Verify API connection

**Weekly**:
- [ ] Calculate weekly performance
- [ ] Review win/loss ratio
- [ ] Check for pattern in losing trades
- [ ] Assess overall strategy effectiveness

**Monthly**:
- [ ] Review total P&L
- [ ] Consider position size adjustments
- [ ] Evaluate strategy modifications

## Project Structure
```
mangococo/
├── config/
│   ├── .env              # Your trading configuration
│   └── init-db.sql       # Database schema
├── services/
│   ├── market-data/      # MEXC WebSocket streaming
│   ├── prediction/       # RSI + Momentum signals
│   ├── signal/          # Buy/sell signal generation
│   ├── risk/            # Position & capital limits
│   ├── executor/        # Order execution on MEXC
│   ├── position/        # P&L tracking
│   ├── api-gateway/     # REST API hub
│   └── dashboard/       # Live monitoring UI
├── shared/              # Persistent data storage
├── docker-compose.yml   # Container orchestration
├── test_trading.py      # Trading capability test
└── README.md           # This guide
```

### Adding New Trading Pairs

1. Update `config/.env`:
```env
TRADING_PAIRS=BTC/USDT,ETH/USDT,NEW/USDT
```

2. Restart services:
```bash
docker compose restart market-data prediction signal
```

### Customizing ML Model

Edit `services/prediction/main.py`:
```python
# Adjust model architecture
model.add(LSTM(128, return_sequences=True))  # More layers
model.add(Dropout(0.3))                      # More dropout
```

Rebuild:
```bash
docker compose up -d --build prediction
```

## Support & Community

- **Issues**: [GitHub Issues](https://github.com/YOUR_USERNAME/mangococo/issues)
- **Documentation**: This README
- **Trading Discussion**: Use at your own risk!

## Disclaimer

**IMPORTANT**: This is educational software.

- Cryptocurrency trading carries significant risk
- You can lose your entire investment
- Past performance doesn't guarantee future results
- The bot makes autonomous decisions based on algorithms
- No trading strategy is risk-free
- Only invest what you can afford to lose

**By using this software, you acknowledge:**
- You understand the risks of automated trading
- You are solely responsible for your trading decisions
- The developers are not liable for any financial losses
- This is not financial advice

---
