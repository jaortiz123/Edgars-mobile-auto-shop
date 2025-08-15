-- Migration: Add service_operations table and appointment links (Phase 1 Service Catalog)
-- Date: 2025-08-14
-- Idempotent: checks for existing columns / table

BEGIN;

-- Create service_operations if not exists
CREATE TABLE IF NOT EXISTS service_operations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    keywords TEXT[] NOT NULL DEFAULT '{}',
    default_hours NUMERIC(5,2),
    default_price NUMERIC(10,2),
    flags TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    replaced_by_id TEXT REFERENCES service_operations(id),
    labor_matrix_code TEXT,
    skill_level INT CHECK (skill_level BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_service_operations_category ON service_operations(category);

-- Add columns to appointments if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='appointments' AND column_name='primary_operation_id'
    ) THEN
        ALTER TABLE appointments ADD COLUMN primary_operation_id TEXT REFERENCES service_operations(id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='appointments' AND column_name='service_category'
    ) THEN
        ALTER TABLE appointments ADD COLUMN service_category TEXT;
    END IF;
END$$;

-- Touch trigger (create or replace)
CREATE OR REPLACE FUNCTION trg_touch_service_operations()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t_service_operations_updated ON service_operations;
CREATE TRIGGER t_service_operations_updated
BEFORE UPDATE ON service_operations
FOR EACH ROW EXECUTE PROCEDURE trg_touch_service_operations();

COMMIT;

-- Verification (optional)
-- \d service_operations
-- SELECT count(*) FROM service_operations;
