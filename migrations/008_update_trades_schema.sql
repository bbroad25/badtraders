-- Migration: Update trades table schema for trace-based indexer
-- Add columns for proper trade tracking and fix numeric overflow

-- Fix numeric overflow by increasing precision
ALTER TABLE trades
  ALTER COLUMN price_usd TYPE DECIMAL(30, 8),
  ALTER COLUMN usd_value TYPE DECIMAL(30, 8);

-- Add new columns for trace-based tracking
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS token_in VARCHAR(42),
  ADD COLUMN IF NOT EXISTS token_out VARCHAR(42),
  ADD COLUMN IF NOT EXISTS amount_in DECIMAL(78, 0),
  ADD COLUMN IF NOT EXISTS amount_out DECIMAL(78, 0),
  ADD COLUMN IF NOT EXISTS base_token VARCHAR(42),
  ADD COLUMN IF NOT EXISTS route JSONB;

-- Update parsed_source check constraint to support new values
ALTER TABLE trades
  DROP CONSTRAINT IF EXISTS trades_parsed_source_check;

ALTER TABLE trades
  ADD CONSTRAINT trades_parsed_source_check
  CHECK (parsed_source IN ('trace', 'log', 'receipt', 'alchemy', 'covalent'));

-- Create index on new columns
CREATE INDEX IF NOT EXISTS idx_trades_token_in ON trades(token_in);
CREATE INDEX IF NOT EXISTS idx_trades_token_out ON trades(token_out);
CREATE INDEX IF NOT EXISTS idx_trades_base_token ON trades(base_token);

-- Note: token_address column will be deprecated but kept for backward compatibility
-- New code should use token_in/token_out instead
