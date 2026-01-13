-- MangoCoco Database Schema
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Market Data
CREATE TABLE IF NOT EXISTS ticks (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    bid DECIMAL(20, 8),
    ask DECIMAL(20, 8),
    volume DECIMAL(20, 8),
    PRIMARY KEY (time, symbol)
);
SELECT create_hypertable('ticks', 'time', if_not_exists => TRUE);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    order_id VARCHAR(100) UNIQUE NOT NULL,
    exchange_order_id VARCHAR(100),
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(4) NOT NULL,
    order_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    price DECIMAL(20, 8),
    amount DECIMAL(20, 8) NOT NULL,
    filled DECIMAL(20, 8) DEFAULT 0,
    cost DECIMAL(20, 8) DEFAULT 0,
    fee DECIMAL(20, 8) DEFAULT 0
);

-- Positions
CREATE TABLE IF NOT EXISTS positions (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(5) NOT NULL,
    entry_price DECIMAL(20, 8) NOT NULL,
    current_price DECIMAL(20, 8),
    amount DECIMAL(20, 8) NOT NULL,
    unrealized_pnl DECIMAL(20, 8) DEFAULT 0,
    realized_pnl DECIMAL(20, 8) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'open'
);

-- Signals
CREATE TABLE IF NOT EXISTS signals (
    time TIMESTAMPTZ NOT NULL,
    signal_id VARCHAR(100) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    action VARCHAR(10) NOT NULL,
    confidence DECIMAL(5, 4) NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    executed BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (time, signal_id)
);
SELECT create_hypertable('signals', 'time', if_not_exists => TRUE);

-- Portfolio
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    time TIMESTAMPTZ NOT NULL PRIMARY KEY,
    total_value DECIMAL(20, 8) NOT NULL,
    cash_balance DECIMAL(20, 8) NOT NULL,
    positions_value DECIMAL(20, 8) NOT NULL,
    daily_pnl DECIMAL(20, 8) NOT NULL
);
SELECT create_hypertable('portfolio_snapshots', 'time', if_not_exists => TRUE);

-- Initial portfolio
INSERT INTO portfolio_snapshots (time, total_value, cash_balance, positions_value, daily_pnl)
VALUES (NOW(), 11.00, 11.00, 0, 0) ON CONFLICT DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_ticks_symbol_time ON ticks(symbol, time DESC);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mangococo;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mangococo;
