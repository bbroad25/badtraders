-- Migration: Add notification tokens table for Farcaster notifications
-- Stores notification tokens received from Farcaster webhook events

BEGIN;

-- notification_tokens table
CREATE TABLE IF NOT EXISTS notification_tokens (
  id SERIAL PRIMARY KEY,
  fid INTEGER NOT NULL,
  token TEXT NOT NULL,
  url TEXT NOT NULL,
  client_app TEXT, -- Which Farcaster client (e.g., 'warpcast')
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fid, token) -- One token per FID (though docs say per fid+client+miniapp)
);

CREATE INDEX IF NOT EXISTS idx_notification_tokens_fid
  ON notification_tokens(fid);

CREATE INDEX IF NOT EXISTS idx_notification_tokens_active
  ON notification_tokens(fid) WHERE token IS NOT NULL;

COMMIT;

