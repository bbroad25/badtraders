-- Migration: Add base token tracking columns to trades table
-- Run this in your Supabase database (via SQL Editor or psql)

ALTER TABLE trades
ADD COLUMN IF NOT EXISTS base_token_amount DECIMAL(78, 0),
ADD COLUMN IF NOT EXISTS base_token_address VARCHAR(42),
ADD COLUMN IF NOT EXISTS price_source VARCHAR(50),
ADD COLUMN IF NOT EXISTS price_confidence DECIMAL(5, 4),
ADD COLUMN IF NOT EXISTS trace_data JSONB;

-- Add indexes for base token queries
CREATE INDEX IF NOT EXISTS idx_trades_base_token_address ON trades(base_token_address);

