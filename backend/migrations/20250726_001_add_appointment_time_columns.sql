-- Migration: Add missing appointment time columns used by seeds, tests, and later indexes
-- Safe and idempotent: uses IF NOT EXISTS guards

BEGIN;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS start_ts        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_ts          TIMESTAMPTZ;

-- Optional future backfill idea (left commented to avoid assumptions about local time zones):
-- UPDATE appointments
--   SET start_ts = (scheduled_date::timestamp + scheduled_time),
--       end_ts   = (scheduled_date::timestamp + scheduled_time) + INTERVAL '1 hour'
-- WHERE start_ts IS NULL AND scheduled_date IS NOT NULL AND scheduled_time IS NOT NULL;

COMMIT;
