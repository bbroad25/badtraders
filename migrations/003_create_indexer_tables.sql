-- Migration: Create tables for PnL indexer
-- Run this in your Supabase database (via SQL Editor or psql)

-- Wallets table: Track registered wallets and sync state
CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  last_synced_block BIGINT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for wallet queries
CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallets_last_synced_block ON wallets(last_synced_block);

-- Tracked tokens table: Configurable list of tokens to track
CREATE TABLE IF NOT EXISTS tracked_tokens (
  token_address VARCHAR(42) PRIMARY KEY,
  symbol VARCHAR(50) NOT NULL,
  decimals INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for token lookups
CREATE INDEX IF NOT EXISTS idx_tracked_tokens_symbol ON tracked_tokens(symbol);

-- Trades table: Individual swap transactions
CREATE TABLE IF NOT EXISTS trades (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL,
  token_address VARCHAR(42) NOT NULL,
  tx_hash VARCHAR(66) NOT NULL,
  block_number BIGINT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  side VARCHAR(4) NOT NULL CHECK (side IN ('BUY', 'SELL')),
  token_amount DECIMAL(78, 0) NOT NULL,
  price_usd DECIMAL(20, 8) NOT NULL,
  usd_value DECIMAL(20, 8) NOT NULL,
  parsed_source VARCHAR(20) NOT NULL CHECK (parsed_source IN ('alchemy', 'covalent')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(wallet_address, tx_hash, token_address, side)
);

-- Indexes for trade queries
CREATE INDEX IF NOT EXISTS idx_trades_wallet_address ON trades(wallet_address);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);
CREATE INDEX IF NOT EXISTS idx_trades_wallet_timestamp ON trades(wallet_address, timestamp);
CREATE INDEX IF NOT EXISTS idx_trades_tx_hash ON trades(tx_hash);
CREATE INDEX IF NOT EXISTS idx_trades_token_address ON trades(token_address);

-- Positions table: FIFO cost basis tracking per wallet/token
CREATE TABLE IF NOT EXISTS positions (
  wallet_address VARCHAR(42) NOT NULL,
  token_address VARCHAR(42) NOT NULL,
  remaining_amount DECIMAL(78, 0) NOT NULL DEFAULT 0,
  cost_basis_usd DECIMAL(20, 8) NOT NULL DEFAULT 0,
  realized_pnl_usd DECIMAL(20, 8) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (wallet_address, token_address)
);

-- Indexes for position queries
CREATE INDEX IF NOT EXISTS idx_positions_wallet_address ON positions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_positions_token_address ON positions(token_address);

-- Seed BadTraders token into tracked_tokens
INSERT INTO tracked_tokens (token_address, symbol, decimals)
VALUES ('0x0774409cda69a47f272907fd5d0d80173167bb07', 'BadTraders', 18)
ON CONFLICT (token_address) DO NOTHING;

