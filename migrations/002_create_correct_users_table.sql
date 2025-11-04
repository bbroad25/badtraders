-- This shows Supabase Auth tables, not our application's users table
-- Let's check if our users table exists in the public schema:

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'users';

-- If it doesn't exist or has wrong structure, create it properly:

CREATE TABLE IF NOT EXISTS public.users (
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

CREATE INDEX IF NOT EXISTS idx_users_fid ON public.users(fid);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON public.users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_opt_in_status ON public.users(opt_in_status);

