-- Migration: Fix numeric field overflow by increasing DECIMAL precision
-- Run this in your Supabase database (via SQL Editor or psql)

-- Increase precision for trades table
ALTER TABLE trades
  ALTER COLUMN price_usd TYPE DECIMAL(30, 8),
  ALTER COLUMN usd_value TYPE DECIMAL(30, 8);

-- Increase precision for positions table
ALTER TABLE positions
  ALTER COLUMN cost_basis_usd TYPE DECIMAL(30, 8),
  ALTER COLUMN realized_pnl_usd TYPE DECIMAL(30, 8);
