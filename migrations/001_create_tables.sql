-- Migration: Create tables for user registration and payouts
-- Run this in your PostgreSQL database (Vercel Postgres or Supabase)

-- Users table: Track registered users
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

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_users_fid ON users(fid);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_opt_in_status ON users(opt_in_status);

-- Daily payouts table: Track payout history
CREATE TABLE IF NOT EXISTS daily_payouts (
  id SERIAL PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  winner_fid BIGINT REFERENCES users(fid),
  winner_address VARCHAR(42),
  payout_amount DECIMAL(78, 0), -- Support up to 78 digits for token amounts
  tx_hash VARCHAR(66),
  status VARCHAR(50) DEFAULT 'pending',
  fee_collected DECIMAL(78, 0),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for payout queries
CREATE INDEX IF NOT EXISTS idx_daily_payouts_date ON daily_payouts(date);
CREATE INDEX IF NOT EXISTS idx_daily_payouts_winner_fid ON daily_payouts(winner_fid);
CREATE INDEX IF NOT EXISTS idx_daily_payouts_status ON daily_payouts(status);

-- Trading metrics table: Track daily trading performance
CREATE TABLE IF NOT EXISTS trading_metrics (
  id SERIAL PRIMARY KEY,
  user_fid BIGINT REFERENCES users(fid),
  date DATE NOT NULL,
  pnl DECIMAL(78, 0) DEFAULT 0,
  trades_count INTEGER DEFAULT 0,
  volume DECIMAL(78, 0) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_fid, date)
);

-- Indexes for metrics queries
CREATE INDEX IF NOT EXISTS idx_trading_metrics_user_fid ON trading_metrics(user_fid);
CREATE INDEX IF NOT EXISTS idx_trading_metrics_date ON trading_metrics(date);
CREATE INDEX IF NOT EXISTS idx_trading_metrics_user_date ON trading_metrics(user_fid, date);

