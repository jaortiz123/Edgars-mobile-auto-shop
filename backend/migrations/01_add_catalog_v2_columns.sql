-- migrations/01_add_catalog_v2_columns.sql
-- Purpose: Add structured catalog fields and invoice snapshot columns.
-- Safe to run multiple times (IF NOT EXISTS guards + idempotent backfills).

BEGIN;

-- 1) Add new catalog columns
ALTER TABLE service_operations ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE service_operations ADD COLUMN IF NOT EXISTS internal_code VARCHAR(100);
ALTER TABLE service_operations ADD COLUMN IF NOT EXISTS display_order INT;

-- 2) Backfill internal_code from legacy id (1:1 mapping)
UPDATE service_operations
SET internal_code = id
WHERE internal_code IS NULL;

-- 3) Enforce NOT NULL + uniqueness after backfill
-- Validate no NULL internal_code remain then enforce constraint (will error if any NULL)
ALTER TABLE service_operations ALTER COLUMN internal_code SET NOT NULL;

-- Unique constraint (skip creation if it already exists)
-- Add unique constraint if missing
DO $$
BEGIN
  BEGIN
    ALTER TABLE service_operations ADD CONSTRAINT service_operations_internal_code_key UNIQUE (internal_code);
  EXCEPTION WHEN duplicate_object THEN
    -- constraint already exists
    NULL;
  END;
END $$ LANGUAGE plpgsql;

-- 4) Backfill display_order deterministically when NULL (category‑scoped, step = 10)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY category ORDER BY name, id) * 10 AS rn
  FROM service_operations
)
UPDATE service_operations s
SET display_order = r.rn
FROM ranked r
WHERE s.id = r.id AND s.display_order IS NULL;

-- 5) Add invoice snapshot columns (denormalized for analytics)
ALTER TABLE invoice_line_items
  ADD COLUMN IF NOT EXISTS service_category       TEXT,
  ADD COLUMN IF NOT EXISTS service_subcategory    TEXT,
  ADD COLUMN IF NOT EXISTS service_internal_code  VARCHAR(100);

-- 6) Backfill snapshot columns for existing line items where service_operation_id is present
UPDATE invoice_line_items li
SET service_category = so.category,
    service_subcategory = so.subcategory,
    service_internal_code = so.internal_code
FROM service_operations so
WHERE li.service_operation_id = so.id
  AND (li.service_category IS NULL OR li.service_internal_code IS NULL OR li.service_subcategory IS NULL);

COMMIT;
