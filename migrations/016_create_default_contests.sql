-- Migration: Create default contests for BadTraders token and other tokens
-- These are the initial contests that are active

BEGIN;

-- Contest 1: BadTraders Token
INSERT INTO weekly_contests (token_address, token_symbol, start_date, end_date, status, created_at, updated_at)
SELECT
  '0x0774409cda69a47f272907fd5d0d80173167bb07',
  'BADTRADERS',
  NOW() + INTERVAL '1 day', -- Start tomorrow
  NOW() + INTERVAL '8 days', -- End 7 days from tomorrow
  'active',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM weekly_contests
  WHERE token_address = '0x0774409cda69a47f272907fd5d0d80173167bb07'
    AND status = 'active'
);

-- Contest 2: Other Token
INSERT INTO weekly_contests (token_address, token_symbol, start_date, end_date, status, created_at, updated_at)
SELECT
  '0x051024b653e8ec69e72693f776c41c2a9401fb07',
  NULL,
  NOW() + INTERVAL '1 day', -- Start tomorrow
  NOW() + INTERVAL '8 days', -- End 7 days from tomorrow
  'active',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM weekly_contests
  WHERE token_address = '0x051024b653e8ec69e72693f776c41c2a9401fb07'
    AND status = 'active'
);

-- Contest 3: Token 0x1bc0c42215582d5a085795f4badbac3ff36d1bcb
INSERT INTO weekly_contests (token_address, token_symbol, start_date, end_date, status, created_at, updated_at)
SELECT
  '0x1bc0c42215582d5a085795f4badbac3ff36d1bcb',
  NULL,
  NOW() + INTERVAL '1 day', -- Start tomorrow
  NOW() + INTERVAL '8 days', -- End 7 days from tomorrow
  'active',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM weekly_contests
  WHERE token_address = '0x1bc0c42215582d5a085795f4badbac3ff36d1bcb'
    AND status = 'active'
);

-- Contest 4: Token 0xd09cf0982a32dd6856e12d6bf2f08a822ea5d91d
INSERT INTO weekly_contests (token_address, token_symbol, start_date, end_date, status, created_at, updated_at)
SELECT
  '0xd09cf0982a32dd6856e12d6bf2f08a822ea5d91d',
  NULL,
  NOW() + INTERVAL '1 day', -- Start tomorrow
  NOW() + INTERVAL '8 days', -- End 7 days from tomorrow
  'active',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM weekly_contests
  WHERE token_address = '0xd09cf0982a32dd6856e12d6bf2f08a822ea5d91d'
    AND status = 'active'
);

COMMIT;

