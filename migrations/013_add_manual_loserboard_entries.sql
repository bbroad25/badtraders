-- Add manual_loserboard_entries table for admin-managed loserboard entries
-- This is used since automated PnL calculation isn't working yet

CREATE TABLE IF NOT EXISTS manual_loserboard_entries (
  id SERIAL PRIMARY KEY,
  fid INTEGER,
  username TEXT,
  display_name TEXT,
  address TEXT,
  pfp_url TEXT,
  added_at TIMESTAMP DEFAULT NOW(),
  added_by_fid INTEGER,
  notes TEXT -- Optional notes about why they're a loser
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_manual_loserboard_fid ON manual_loserboard_entries(fid);
CREATE INDEX IF NOT EXISTS idx_manual_loserboard_added_at ON manual_loserboard_entries(added_at DESC);

