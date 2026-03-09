-- Aerodrome Finance Substreams SQL Schema
-- PostgreSQL schema with OHLCV candles and delta updates

-- ====================
-- Core Tables
-- ====================

-- Individual swap events
CREATE TABLE IF NOT EXISTS aerodrome_swaps (
    id VARCHAR PRIMARY KEY,
    tx_hash VARCHAR NOT NULL,
    log_index BIGINT NOT NULL,
    block_number BIGINT NOT NULL,
    timestamp BIGINT NOT NULL,
    pool_address VARCHAR NOT NULL,
    sender VARCHAR NOT NULL,
    recipient VARCHAR NOT NULL,
    amount0_in VARCHAR NOT NULL,
    amount1_in VARCHAR NOT NULL,
    amount0_out VARCHAR NOT NULL,
    amount1_out VARCHAR NOT NULL,
    amount_in_total NUMERIC NOT NULL,
    amount_out_total NUMERIC NOT NULL,
    price_ratio NUMERIC NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_swaps_pool ON aerodrome_swaps(pool_address);
CREATE INDEX IF NOT EXISTS idx_swaps_timestamp ON aerodrome_swaps(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_swaps_sender ON aerodrome_swaps(sender);
CREATE INDEX IF NOT EXISTS idx_swaps_block ON aerodrome_swaps(block_number DESC);

-- ====================
-- OHLCV Candles
-- ====================

CREATE TABLE IF NOT EXISTS candles (
    pool_address VARCHAR NOT NULL,
    interval_seconds BIGINT NOT NULL,
    timestamp BIGINT NOT NULL,
    open BIGINT,
    high BIGINT,
    low BIGINT,
    close BIGINT,
    volume_in NUMERIC DEFAULT 0,
    volume_out NUMERIC DEFAULT 0,
    trade_count BIGINT DEFAULT 0,
    PRIMARY KEY (pool_address, interval_seconds, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_candles_pool_interval ON candles(pool_address, interval_seconds);
CREATE INDEX IF NOT EXISTS idx_candles_timestamp ON candles(timestamp DESC);

-- ====================
-- Aggregation Tables
-- ====================

CREATE TABLE IF NOT EXISTS pool_stats (
    pool_address VARCHAR PRIMARY KEY,
    swap_count BIGINT DEFAULT 0,
    total_volume NUMERIC DEFAULT 0,
    last_swap_block BIGINT,
    last_swap_time BIGINT
);

CREATE INDEX IF NOT EXISTS idx_pool_stats_volume ON pool_stats(total_volume DESC);

CREATE TABLE IF NOT EXISTS trader_stats (
    wallet_address VARCHAR PRIMARY KEY,
    total_swaps BIGINT DEFAULT 0,
    total_volume NUMERIC DEFAULT 0,
    last_swap_time BIGINT
);

CREATE INDEX IF NOT EXISTS idx_trader_stats_volume ON trader_stats(total_volume DESC);
CREATE INDEX IF NOT EXISTS idx_trader_stats_swaps ON trader_stats(total_swaps DESC);

CREATE TABLE IF NOT EXISTS daily_stats (
    date VARCHAR PRIMARY KEY,
    swap_count BIGINT DEFAULT 0,
    total_volume NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS hourly_stats (
    hour VARCHAR PRIMARY KEY,
    swap_count BIGINT DEFAULT 0,
    total_volume NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS protocol_metrics (
    protocol VARCHAR PRIMARY KEY,
    total_swaps BIGINT DEFAULT 0,
    total_volume NUMERIC DEFAULT 0
);
