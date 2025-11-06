-- Migration: Add last_synced_block to tracked_tokens for token-first indexing
-- Run this in your Supabase database (via SQL Editor or psql)

-- Add last_synced_block column to track which blocks have been scanned for each token
ALTER TABLE tracked_tokens ADD COLUMN IF NOT EXISTS last_synced_block BIGINT DEFAULT NULL;

-- Add index for faster lookups when syncing tokens
CREATE INDEX IF NOT EXISTS idx_tracked_tokens_last_synced ON tracked_tokens(last_synced_block);

