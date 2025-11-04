-- First, check what columns exist in users table
-- Run this in Supabase SQL Editor to see current structure:
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- If fid column doesn't exist, add it:
ALTER TABLE users ADD COLUMN IF NOT EXISTS fid BIGINT UNIQUE;

-- Make sure fid is NOT NULL if it should be:
-- (Only run this if fid should be required)
-- ALTER TABLE users ALTER COLUMN fid SET NOT NULL;

