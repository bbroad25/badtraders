-- Migration: Introduce swap transaction + trade leg storage and run logging
-- Run this against Supabase Postgres before enabling the refactored indexer

BEGIN;

-- 1. swap_transactions table (transaction-level aggregates)
CREATE TABLE IF NOT EXISTS swap_transactions (
  id BIGSERIAL PRIMARY KEY,
  tx_hash VARCHAR(66) NOT NULL UNIQUE,
  block_number BIGINT NOT NULL,
  block_time TIMESTAMPTZ NOT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'bitquery',
  protocol_name VARCHAR(120),
  wallet_initiator VARCHAR(42),
  net_token_in JSONB DEFAULT '{}'::jsonb,
  net_token_out JSONB DEFAULT '{}'::jsonb,
  net_usd_value NUMERIC(38, 12),
  legs_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_swap_transactions_block
  ON swap_transactions(block_number);

CREATE INDEX IF NOT EXISTS idx_swap_transactions_protocol
  ON swap_transactions(protocol_name);

-- 2. trade_legs table (individual Bitquery legs)
CREATE TABLE IF NOT EXISTS trade_legs (
  id BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT NOT NULL REFERENCES swap_transactions(id) ON DELETE CASCADE,
  leg_index INTEGER NOT NULL,
  protocol_name VARCHAR(120),
  route_hint VARCHAR(255),
  side VARCHAR(4) NOT NULL CHECK (side IN ('BUY', 'SELL')),
  wallet_address VARCHAR(42) NOT NULL,
  token_in_address VARCHAR(42) NOT NULL,
  token_out_address VARCHAR(42) NOT NULL,
  amount_in NUMERIC(78, 0) NOT NULL,
  amount_out NUMERIC(78, 0) NOT NULL,
  token_in_decimals SMALLINT DEFAULT 18,
  token_out_decimals SMALLINT DEFAULT 18,
  usd_value NUMERIC(38, 12),
  price_usd NUMERIC(38, 12),
  is_protocol_fee BOOLEAN DEFAULT FALSE,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_legs_tx_leg
  ON trade_legs(transaction_id, leg_index);

CREATE INDEX IF NOT EXISTS idx_trade_legs_wallet_token_time
  ON trade_legs(wallet_address, token_out_address, transaction_id);

CREATE INDEX IF NOT EXISTS idx_trade_legs_protocol
  ON trade_legs(protocol_name);

-- 3. indexer_runs table (audit Bitquery sync usage)
CREATE TABLE IF NOT EXISTS indexer_runs (
  id BIGSERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  initiator VARCHAR(120),
  sync_type VARCHAR(20) NOT NULL DEFAULT 'incremental',
  tokens_scanned INTEGER DEFAULT 0,
  bitquery_pages INTEGER DEFAULT 0,
  bitquery_calls INTEGER DEFAULT 0,
  credits_spent_estimate NUMERIC(20, 4),
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_indexer_runs_status
  ON indexer_runs(status);

CREATE INDEX IF NOT EXISTS idx_indexer_runs_started_at
  ON indexer_runs(started_at DESC);

-- 4. Alter trades table to reference swap_transactions and relax uniqueness
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS transaction_id BIGINT REFERENCES swap_transactions(id) ON DELETE SET NULL;

-- Drop legacy unique constraint if present and recreate using transaction_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'trades_wallet_address_tx_hash_token_address_side_key'
      AND conrelid = 'trades'::regclass
  ) THEN
    ALTER TABLE trades
      DROP CONSTRAINT trades_wallet_address_tx_hash_token_address_side_key;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END$$;

ALTER TABLE trades
  ADD CONSTRAINT trades_transaction_wallet_token_side_unique
  UNIQUE (transaction_id, wallet_address, token_address, side);

COMMIT;

