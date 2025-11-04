# Database Migration Setup - Quick Guide

**One-time setup:** Run this SQL migration once in Supabase to create all required tables.

## Step 1: Open Supabase SQL Editor

1. Go to https://supabase.com
2. Sign in and select your project
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New query"**

## Step 2: Copy & Paste This SQL

Copy the **ENTIRE** contents below and paste into the SQL Editor:

```sql
-- 1. Create users table
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

CREATE INDEX IF NOT EXISTS idx_users_fid ON users(fid);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_opt_in_status ON users(opt_in_status);

-- 2. Create daily_payouts table
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
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT daily_payouts_winner_fid_fkey FOREIGN KEY (winner_fid) REFERENCES users(fid)
);

CREATE INDEX IF NOT EXISTS idx_daily_payouts_date ON daily_payouts(date);
CREATE INDEX IF NOT EXISTS idx_daily_payouts_winner_fid ON daily_payouts(winner_fid);
CREATE INDEX IF NOT EXISTS idx_daily_payouts_status ON daily_payouts(status);

-- 3. Create trading_metrics table
CREATE TABLE IF NOT EXISTS trading_metrics (
  id SERIAL PRIMARY KEY,
  user_fid BIGINT,
  date DATE NOT NULL,
  pnl DECIMAL(78, 0) DEFAULT 0,
  trades_count INTEGER DEFAULT 0,
  volume DECIMAL(78, 0) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_fid, date),
  CONSTRAINT trading_metrics_user_fid_fkey FOREIGN KEY (user_fid) REFERENCES users(fid)
);

CREATE INDEX IF NOT EXISTS idx_trading_metrics_user_fid ON trading_metrics(user_fid);
CREATE INDEX IF NOT EXISTS idx_trading_metrics_date ON trading_metrics(date);
CREATE INDEX IF NOT EXISTS idx_trading_metrics_user_date ON trading_metrics(user_fid, date);

-- 4. Create leaderboard_cache table
CREATE TABLE IF NOT EXISTS leaderboard_cache (
  id SERIAL PRIMARY KEY,
  cache_key VARCHAR(50) DEFAULT 'default' UNIQUE NOT NULL,
  leaderboard_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_key ON leaderboard_cache(cache_key);
```

## Step 3: Run It

1. Click the **"Run"** button (or press `Ctrl+Enter` / `Cmd+Enter`)
2. You should see **"Success"** or **"Success. No rows returned"**
3. That's it! Tables are created.

## Verify It Worked

Run this in SQL Editor to check:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('users', 'daily_payouts', 'trading_metrics', 'leaderboard_cache');
```

You should see all 4 tables listed.

## Troubleshooting

**Error: "relation already exists"**
- ✅ This is fine! Tables already exist, you're all set.

**Error: "column fid does not exist"**
- Make sure you copied the ENTIRE SQL (all sections 1-4)
- Run sections one at a time if needed (start with section 1)

**Error: "permission denied"**
- Make sure you're signed into the correct Supabase project
- Check you have admin access to the project

**Still having issues?**
- Check the file `migrations/001_create_tables_simple.sql` in the repo
- Or try running each section separately (1, then 2, then 3, then 4)

---

**That's it!** Once you run this migration, your database is ready and the app will work. No need to run it again.

