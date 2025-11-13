-- Migration: Cleanup indexer data (truncate all tables)
-- Run this in your Supabase database (via SQL Editor or psql)
-- WARNING: This will delete ALL indexer data!

TRUNCATE TABLE trades CASCADE;
TRUNCATE TABLE positions CASCADE;
TRUNCATE TABLE wallets CASCADE;

-- Reset tracked_tokens updated_at timestamp
UPDATE tracked_tokens SET updated_at = NOW();

