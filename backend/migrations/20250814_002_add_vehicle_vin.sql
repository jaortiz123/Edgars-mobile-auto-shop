-- Migration: Add VIN column to vehicles (schema alignment with tests & seed)
-- Date: 2025-08-14
-- Idempotent
BEGIN;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vin TEXT; -- consider UNIQUE later
COMMIT;

-- Verification:
-- SELECT column_name FROM information_schema.columns WHERE table_name='vehicles' AND column_name='vin';
