-- Migration for SQLite (local development)
-- This file creates all tables needed for the app

-- Users table: Track registered users
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fid INTEGER UNIQUE NOT NULL,
  username TEXT,
  wallet_address TEXT NOT NULL,
  eligibility_status INTEGER DEFAULT 0, -- SQLite uses 0/1 for booleans
  opt_in_status INTEGER DEFAULT 0,
  registered_at INTEGER, -- Unix timestamp
  last_active_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_users_fid ON users(fid);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_opt_in_status ON users(opt_in_status);

-- Daily payouts table: Track payout history
CREATE TABLE IF NOT EXISTS daily_payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT UNIQUE NOT NULL, -- SQLite stores dates as TEXT
  winner_fid INTEGER REFERENCES users(fid),
  winner_address TEXT,
  payout_amount TEXT, -- Store as TEXT for precision
  tx_hash TEXT,
  status TEXT DEFAULT 'pending',
  fee_collected TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Indexes for payout queries
CREATE INDEX IF NOT EXISTS idx_daily_payouts_date ON daily_payouts(date);
CREATE INDEX IF NOT EXISTS idx_daily_payouts_winner_fid ON daily_payouts(winner_fid);
CREATE INDEX IF NOT EXISTS idx_daily_payouts_status ON daily_payouts(status);

-- Trading metrics table: Track daily trading performance
CREATE TABLE IF NOT EXISTS trading_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_fid INTEGER REFERENCES users(fid),
  date TEXT NOT NULL,
  pnl TEXT DEFAULT '0',
  trades_count INTEGER DEFAULT 0,
  volume TEXT DEFAULT '0',
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE(user_fid, date)
);

-- Indexes for metrics queries
CREATE INDEX IF NOT EXISTS idx_trading_metrics_user_fid ON trading_metrics(user_fid);
CREATE INDEX IF NOT EXISTS idx_trading_metrics_date ON trading_metrics(date);
CREATE INDEX IF NOT EXISTS idx_trading_metrics_user_date ON trading_metrics(user_fid, date);

