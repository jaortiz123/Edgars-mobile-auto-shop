-- Migration: Tighten appointment time schema with backfill, constraints, and proper types
-- Safe and idempotent: guards for existing constraints and columns

BEGIN;

-- 1) Backfill start_ts/end_ts from scheduled_at if they exist and are null
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='appointments' AND column_name='scheduled_at') THEN
    UPDATE appointments
    SET start_ts = COALESCE(start_ts, scheduled_at),
        end_ts   = COALESCE(end_ts, scheduled_at + INTERVAL '1 hour')
    WHERE start_ts IS NULL OR end_ts IS NULL;
  END IF;
END $$;

-- 2) Convert appointment_date from TIMESTAMPTZ to DATE for better semantics
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='appointments' AND column_name='appointment_date'
               AND udt_name='timestamptz') THEN
    ALTER TABLE appointments
      ALTER COLUMN appointment_date TYPE DATE
      USING (COALESCE(appointment_date, start_ts)::date);
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name='appointments' AND column_name='appointment_date') THEN
    ALTER TABLE appointments
      ADD COLUMN appointment_date DATE GENERATED ALWAYS AS (start_ts::date) STORED;
  END IF;
END $$;

-- 3) Basic time bounds constraint
ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS chk_appt_time_bounds;

ALTER TABLE appointments
  ADD CONSTRAINT chk_appt_time_bounds
  CHECK (start_ts IS NULL OR end_ts IS NULL OR start_ts < end_ts);

-- 4) Performance indexes aligned with typical queries (paginated by time)
CREATE INDEX IF NOT EXISTS idx_appt_vehicle_time_desc
  ON appointments(vehicle_id, start_ts DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_appt_customer_time_desc
  ON appointments(customer_id, start_ts DESC, id DESC);

-- 5) Compatibility: keep scheduled_at in sync if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='appointments' AND column_name='scheduled_at') THEN
    -- Update existing rows to sync
    UPDATE appointments
    SET scheduled_at = start_ts
    WHERE scheduled_at IS DISTINCT FROM start_ts;

    -- Create trigger function
    CREATE OR REPLACE FUNCTION appointments_sync_scheduled() RETURNS TRIGGER AS $f$
    BEGIN
      NEW.scheduled_at := COALESCE(NEW.start_ts, NEW.scheduled_at);
      RETURN NEW;
    END $f$ LANGUAGE plpgsql;

    -- Drop and recreate trigger
    DROP TRIGGER IF EXISTS trg_appt_sync_scheduled ON appointments;
    CREATE TRIGGER trg_appt_sync_scheduled
      BEFORE INSERT OR UPDATE OF start_ts ON appointments
      FOR EACH ROW EXECUTE FUNCTION appointments_sync_scheduled();
  END IF;
END $$;

COMMIT;
