-- Migration: Add vehicle management columns for Milestone 3
-- Date: 2025-08-26
-- Adds is_primary and is_active columns to vehicles table

BEGIN;

-- Add vehicle management columns
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Ensure only one primary vehicle per customer
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_primary_per_customer
ON vehicles(customer_id)
WHERE is_primary = TRUE;

-- Index for active vehicles
CREATE INDEX IF NOT EXISTS idx_vehicles_active ON vehicles(is_active);

-- Touch trigger for vehicles (update timestamp)
CREATE OR REPLACE FUNCTION trg_touch_vehicles()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t_vehicles_updated ON vehicles;
CREATE TRIGGER t_vehicles_updated
BEFORE UPDATE ON vehicles
FOR EACH ROW EXECUTE PROCEDURE trg_touch_vehicles();

-- Set the first vehicle for each customer as primary if none exists
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT customer_id, MIN(id) as first_vehicle_id
        FROM vehicles
        WHERE customer_id NOT IN (
            SELECT customer_id FROM vehicles WHERE is_primary = TRUE
        )
        GROUP BY customer_id
    LOOP
        UPDATE vehicles
        SET is_primary = TRUE
        WHERE id = r.first_vehicle_id;
    END LOOP;
END $$;

-- Create audit log table for vehicle transfers
CREATE TABLE IF NOT EXISTS vehicle_audit_log (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
    action VARCHAR(50) NOT NULL,
    old_customer_id INTEGER REFERENCES customers(id),
    new_customer_id INTEGER REFERENCES customers(id),
    performed_by VARCHAR(100),
    performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_vehicle_audit_log_vehicle_id ON vehicle_audit_log(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_audit_log_performed_at ON vehicle_audit_log(performed_at);

COMMIT;
