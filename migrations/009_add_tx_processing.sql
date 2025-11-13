-- Migration: Add transaction processing tracking table
-- Track which transactions have been processed to avoid duplicates

CREATE TABLE IF NOT EXISTS processed_transactions (
  tx_hash VARCHAR(66) PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL,
  block_number BIGINT NOT NULL,
  processed_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_processed_transactions_wallet ON processed_transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_processed_transactions_block ON processed_transactions(block_number);
CREATE INDEX IF NOT EXISTS idx_processed_transactions_processed_at ON processed_transactions(processed_at);
