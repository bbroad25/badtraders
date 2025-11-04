-- Migration: Add price metadata columns to trades table
-- This supports advanced price resolution (Chainlink, DEX pools, traces)

-- Add price source tracking
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS price_source VARCHAR(20),
  ADD COLUMN IF NOT EXISTS price_confidence FLOAT,
  ADD COLUMN IF NOT EXISTS trace_data JSONB;

-- Add index for price_source (for filtering by source)
CREATE INDEX IF NOT EXISTS idx_trades_price_source ON trades(price_source);

-- Add index for price_confidence (for filtering low-confidence prices)
CREATE INDEX IF NOT EXISTS idx_trades_price_confidence ON trades(price_confidence);

-- Update existing rows to have default values
UPDATE trades
SET
  price_source = 'swap_derived',
  price_confidence = 0.7
WHERE price_source IS NULL;

