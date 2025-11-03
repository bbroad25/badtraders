-- Migration: Create tables for user registration and payouts (Safe version)
-- Run this in your Supabase database (via SQL Editor)
-- This version creates tables first, then adds foreign keys separately

-- Step 1: Create users table first (no dependencies)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  fid BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  wallet_address VARCHAR(42) NOT NULL,
  eligibility_status BOOLEAN DEFAULT false,
  opt_in_status BOOLEAN DEFAULT false,
  registered_at TIMESTAMP,
  last_active_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Step 2: Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_fid ON users(fid);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_opt_in_status ON users(opt_in_status);

-- Step 3: Create daily_payouts table (references users)
CREATE TABLE IF NOT EXISTS daily_payouts (
  id SERIAL PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  winner_fid BIGINT,
  winner_address VARCHAR(42),
  payout_amount DECIMAL(78, 0),
  tx_hash VARCHAR(66),
  status VARCHAR(50) DEFAULT 'pending',
  fee_collected DECIMAL(78, 0),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Step 4: Add foreign key constraint for daily_payouts (after both tables exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_payouts_winner_fid_fkey'
  ) THEN
    ALTER TABLE daily_payouts
    ADD CONSTRAINT daily_payouts_winner_fid_fkey
    FOREIGN KEY (winner_fid) REFERENCES users(fid);
  END IF;
END $$;

-- Step 5: Create indexes for daily_payouts
CREATE INDEX IF NOT EXISTS idx_daily_payouts_date ON daily_payouts(date);
CREATE INDEX IF NOT EXISTS idx_daily_payouts_winner_fid ON daily_payouts(winner_fid);
CREATE INDEX IF NOT EXISTS idx_daily_payouts_status ON daily_payouts(status);

-- Step 6: Create trading_metrics table (references users)
CREATE TABLE IF NOT EXISTS trading_metrics (
  id SERIAL PRIMARY KEY,
  user_fid BIGINT,
  date DATE NOT NULL,
  pnl DECIMAL(78, 0) DEFAULT 0,
  trades_count INTEGER DEFAULT 0,
  volume DECIMAL(78, 0) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_fid, date)
);

-- Step 7: Add foreign key constraint for trading_metrics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trading_metrics_user_fid_fkey'
  ) THEN
    ALTER TABLE trading_metrics
    ADD CONSTRAINT trading_metrics_user_fid_fkey
    FOREIGN KEY (user_fid) REFERENCES users(fid);
  END IF;
END $$;

-- Step 8: Create indexes for trading_metrics
CREATE INDEX IF NOT EXISTS idx_trading_metrics_user_fid ON trading_metrics(user_fid);
CREATE INDEX IF NOT EXISTS idx_trading_metrics_date ON trading_metrics(date);
CREATE INDEX IF NOT EXISTS idx_trading_metrics_user_date ON trading_metrics(user_fid, date);

-- Step 9: Create leaderboard_cache table (no dependencies)
CREATE TABLE IF NOT EXISTS leaderboard_cache (
  id SERIAL PRIMARY KEY,
  cache_key VARCHAR(50) DEFAULT 'default' UNIQUE NOT NULL,
  leaderboard_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Step 10: Create index for leaderboard_cache
CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_key ON leaderboard_cache(cache_key);

