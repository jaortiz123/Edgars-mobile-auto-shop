-- Packages & Promotions Phase 1 Migration
-- (Original baseline – keep minimal; later constraints added in forward migrations)
-- Adds is_package flag to service_operations and introduces package_items join table

ALTER TABLE service_operations
  ADD COLUMN IF NOT EXISTS is_package BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN service_operations.is_package IS 'Indicates this service_operation represents a package composed of other service_operations (Phase 1 baseline)';

CREATE TABLE IF NOT EXISTS package_items (
  service_id TEXT NOT NULL REFERENCES service_operations(id) ON DELETE CASCADE,
  child_id   TEXT NOT NULL REFERENCES service_operations(id),
  qty        NUMERIC(6,2) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (service_id, child_id),
  CHECK (qty > 0)
);

CREATE INDEX IF NOT EXISTS idx_package_items_child ON package_items(child_id);

COMMENT ON TABLE package_items IS 'Baseline package -> child service relationships (constraints added later)';
COMMENT ON COLUMN package_items.service_id IS 'Parent package service_operation id (named service_id for legacy reasons; treat as package_id in code)';
COMMENT ON COLUMN package_items.child_id   IS 'Child service_operation id included in the package';
COMMENT ON COLUMN package_items.qty        IS 'Quantity of the child service within the package';
