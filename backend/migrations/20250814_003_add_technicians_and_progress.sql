-- Migration: Add technicians table and progress tracking columns to appointments
-- Date: 2025-08-14
-- Idempotent: safe to run multiple times
-- NOTE: Earlier seed migration added a bare tech_id column without FK; this migration
--       normalizes by adding the technicians table and retrofitting the FK + indexes.

BEGIN;

-- Ensure UUID generation available (pgcrypto preferred; fallback uuid-ossp if policy differs)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Technicians table ----------------------------------------------------
CREATE TABLE IF NOT EXISTS technicians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    initials TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint to prevent duplicate active initials (initials reused only if inactive)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_technicians_initials_active ON technicians(initials) WHERE is_active;

-- Touch trigger for technicians (upsert)
CREATE OR REPLACE FUNCTION trg_touch_technicians()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t_technicians_updated ON technicians;
CREATE TRIGGER t_technicians_updated
BEFORE UPDATE ON technicians
FOR EACH ROW EXECUTE PROCEDURE trg_touch_technicians();

-- 2. Appointment columns & constraints -----------------------------------
-- Ensure columns exist (add if missing)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS tech_id UUID;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Add / retrofit foreign key if absent (earlier migration may have added tech_id without FK)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_name = kcu.table_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'appointments'
          AND kcu.column_name = 'tech_id'
    ) THEN
        ALTER TABLE appointments
          ADD CONSTRAINT fk_appointments_technician
          FOREIGN KEY (tech_id) REFERENCES technicians(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_appointments_tech_id ON appointments(tech_id);
CREATE INDEX IF NOT EXISTS idx_appointments_started_at ON appointments(started_at);
CREATE INDEX IF NOT EXISTS idx_appointments_completed_at ON appointments(completed_at);

-- 3. Seed initial technicians if table empty ------------------------------
DO $$
DECLARE
    existing_count INT;
BEGIN
    SELECT COUNT(*) INTO existing_count FROM technicians;
    IF existing_count = 0 THEN
        INSERT INTO technicians (name, initials) VALUES
            ('Jesus Ortiz', 'JO'),
            ('Alex Garcia', 'AG'),
            ('Maria Lopez', 'ML');
    END IF;
END $$;

COMMIT;

-- Verification suggestions:
-- SELECT * FROM technicians;
-- \d+ appointments
