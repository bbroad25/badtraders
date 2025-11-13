-- Migration: Add user-generated indexing tables for weekly contests
-- This allows users to opt-in to indexing by signing a message when entering contests
-- Runs alongside existing BitQuery indexer (does not replace it)

BEGIN;

-- 1. weekly_contests table
-- Stores information about weekly trading contests
CREATE TABLE IF NOT EXISTS weekly_contests (
  id SERIAL PRIMARY KEY,
  token_address TEXT NOT NULL,
  token_symbol TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_contests_status
  ON weekly_contests(status);

CREATE INDEX IF NOT EXISTS idx_weekly_contests_dates
  ON weekly_contests(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_weekly_contests_token
  ON weekly_contests(token_address);

-- 2. contest_registrations table
-- Stores user registrations for contests with signed messages
CREATE TABLE IF NOT EXISTS contest_registrations (
  id SERIAL PRIMARY KEY,
  contest_id INTEGER NOT NULL REFERENCES weekly_contests(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  fid INTEGER, -- Farcaster ID if available
  signed_message TEXT NOT NULL, -- EIP-191 signed message
  message_hash TEXT NOT NULL, -- Hash of the message for verification
  indexed_at TIMESTAMPTZ, -- When indexing completed
  pnl_calculated_at TIMESTAMPTZ, -- When PnL was calculated
  current_pnl NUMERIC(38, 12), -- Current PnL for this contest
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contest_id, wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_contest_registrations_contest
  ON contest_registrations(contest_id);

CREATE INDEX IF NOT EXISTS idx_contest_registrations_wallet
  ON contest_registrations(wallet_address);

CREATE INDEX IF NOT EXISTS idx_contest_registrations_fid
  ON contest_registrations(fid) WHERE fid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contest_registrations_pnl
  ON contest_registrations(contest_id, current_pnl) WHERE current_pnl IS NOT NULL;

-- 3. user_trades table
-- Stores trades indexed on-demand for contest participants
-- Separate from main 'trades' table which uses BitQuery data
CREATE TABLE IF NOT EXISTS user_trades (
  id BIGSERIAL PRIMARY KEY,
  registration_id INTEGER NOT NULL REFERENCES contest_registrations(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  token_address TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
  amount_in NUMERIC(78, 0) NOT NULL, -- Raw amount (with decimals)
  amount_out NUMERIC(78, 0) NOT NULL, -- Raw amount (with decimals)
  token_in_address TEXT,
  token_out_address TEXT,
  price_usd NUMERIC(38, 12),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tx_hash, wallet_address, token_address)
);

CREATE INDEX IF NOT EXISTS idx_user_trades_registration
  ON user_trades(registration_id);

CREATE INDEX IF NOT EXISTS idx_user_trades_wallet_token
  ON user_trades(wallet_address, token_address);

CREATE INDEX IF NOT EXISTS idx_user_trades_timestamp
  ON user_trades(timestamp);

CREATE INDEX IF NOT EXISTS idx_user_trades_tx_hash
  ON user_trades(tx_hash);

CREATE INDEX IF NOT EXISTS idx_user_trades_block
  ON user_trades(block_number);

COMMIT;

