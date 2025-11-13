-- Migration: Create token_transfers table for Shovel to populate
-- Note: Shovel will create this table automatically based on shovel-config.json
-- This migration creates a helper view for text queries once Shovel has populated the table

-- Drop view if it exists (in case we need to recreate it)
DROP VIEW IF EXISTS token_transfers_text CASCADE;

-- Create view only if table exists with required columns
DO $$
BEGIN
  -- Check if table exists and has minimum required columns
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'token_transfers'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'token_transfers'
    AND column_name IN ('transaction_hash', 'token_address', 'block_number', 'log_idx')
  ) THEN
    -- Create view with core columns (handle optional columns gracefully)
    EXECUTE '
    CREATE OR REPLACE VIEW token_transfers_text AS
    SELECT
      block_number::BIGINT as block_number,
      ' || CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'token_transfers' AND column_name = 'tx_idx')
        THEN 'COALESCE(tx_idx, transaction_index)::INTEGER'
        ELSE 'transaction_index::INTEGER'
      END || ' as transaction_index,
      log_idx as log_index,
      CASE WHEN block_hash IS NOT NULL THEN ''0x'' || encode(block_hash, ''hex'') ELSE NULL END as block_hash,
      ''0x'' || encode(transaction_hash, ''hex'') as transaction_hash,
      ''0x'' || encode(token_address, ''hex'') as token_address,
      ''0x'' || encode(from_address, ''hex'') as from_address,
      ''0x'' || encode(to_address, ''hex'') as to_address,
      ''0x'' || encode(value, ''hex'') as value_hex,
      (''x'' || encode(value, ''hex''))::bit(256)::bigint::numeric as value
    FROM token_transfers
    WHERE transaction_hash IS NOT NULL';

    RAISE NOTICE 'Created token_transfers_text view';
  ELSE
    RAISE NOTICE 'Skipping view creation: token_transfers table does not exist or is missing required columns. Run Shovel first to create the table.';
  END IF;
END $$;

-- Create indexes if table exists (helpful for queries even if Shovel creates its own)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'token_transfers') THEN
    -- Only create indexes if columns exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'token_transfers' AND column_name = 'token_address') THEN
      CREATE INDEX IF NOT EXISTS idx_token_transfers_token_address ON token_transfers USING GIN (token_address);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'token_transfers' AND column_name = 'transaction_hash') THEN
      CREATE INDEX IF NOT EXISTS idx_token_transfers_transaction_hash ON token_transfers USING GIN (transaction_hash);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'token_transfers' AND column_name = 'block_number') THEN
      CREATE INDEX IF NOT EXISTS idx_token_transfers_block_number ON token_transfers(block_number);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'token_transfers' AND column_name = 'log_idx') THEN
      CREATE UNIQUE INDEX IF NOT EXISTS u_token_transfers_tx_log ON token_transfers(transaction_hash, log_idx);
    END IF;
  END IF;
END $$;
