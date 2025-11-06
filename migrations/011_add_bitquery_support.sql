-- Migration: Add Bitquery support to trades table
-- Adds 'bitquery' to parsed_source enum and improves indexing

-- Update parsed_source check constraint to include 'bitquery'
ALTER TABLE trades
  DROP CONSTRAINT IF EXISTS trades_parsed_source_check;

ALTER TABLE trades
  ADD CONSTRAINT trades_parsed_source_check
  CHECK (parsed_source IN ('trace', 'log', 'receipt', 'alchemy', 'covalent', 'bitquery'));

-- Add composite index for faster token/block queries (used by Bitquery sync)
CREATE INDEX IF NOT EXISTS idx_trades_token_block ON trades(token_address, block_number);

-- Note: token_transfers table is now optional - only used for holder discovery, not swap detection
-- Swap detection is now exclusively via Bitquery
