-- Migration: Add token voting system for registered users
-- Allows users to vote for which token will be used in the next weekly contest

BEGIN;

-- 1. voting_periods table
-- Tracks active and past voting periods
CREATE TABLE IF NOT EXISTS voting_periods (
  id SERIAL PRIMARY KEY,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ NOT NULL,
  winning_token_address TEXT, -- Set when voting period completes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voting_periods_status
  ON voting_periods(status);

CREATE INDEX IF NOT EXISTS idx_voting_periods_dates
  ON voting_periods(start_date, end_date);

-- 2. voting_options table
-- Tokens that users can vote for
CREATE TABLE IF NOT EXISTS voting_options (
  id SERIAL PRIMARY KEY,
  voting_period_id INTEGER NOT NULL REFERENCES voting_periods(id) ON DELETE CASCADE,
  token_address TEXT NOT NULL,
  token_symbol TEXT,
  token_name TEXT,
  description TEXT, -- Optional description of why this token
  vote_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(voting_period_id, token_address)
);

CREATE INDEX IF NOT EXISTS idx_voting_options_period
  ON voting_options(voting_period_id);

CREATE INDEX IF NOT EXISTS idx_voting_options_votes
  ON voting_options(voting_period_id, vote_count DESC);

-- 3. user_votes table
-- Tracks individual user votes
CREATE TABLE IF NOT EXISTS user_votes (
  id SERIAL PRIMARY KEY,
  voting_period_id INTEGER NOT NULL REFERENCES voting_periods(id) ON DELETE CASCADE,
  option_id INTEGER NOT NULL REFERENCES voting_options(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  fid INTEGER, -- Farcaster ID if available
  voted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(voting_period_id, wallet_address) -- One vote per user per period
);

CREATE INDEX IF NOT EXISTS idx_user_votes_period
  ON user_votes(voting_period_id);

CREATE INDEX IF NOT EXISTS idx_user_votes_wallet
  ON user_votes(wallet_address);

CREATE INDEX IF NOT EXISTS idx_user_votes_option
  ON user_votes(option_id);

COMMIT;

