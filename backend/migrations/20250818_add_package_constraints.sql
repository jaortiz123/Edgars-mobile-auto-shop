-- Forward migration: add package constraints & enhancements (Option B)
-- Adds sort_order column, trigger to prevent nested packages, and indexes (idempotent-ish)

-- 1) Add sort_order if missing
ALTER TABLE package_items ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

-- 2) Create trigger function (create or replace)
CREATE OR REPLACE FUNCTION prevent_nested_packages() RETURNS trigger AS $$
BEGIN
  -- If child is itself a package, block (no nesting in Phase 1)
  IF EXISTS (SELECT 1 FROM service_operations so WHERE so.id = NEW.child_id AND so.is_package) THEN
    RAISE EXCEPTION 'Child service % is a package (nesting not allowed)', NEW.child_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Create trigger (drop first to avoid duplicate definition)
DROP TRIGGER IF EXISTS trg_prevent_nested_packages ON package_items;
CREATE TRIGGER trg_prevent_nested_packages
  BEFORE INSERT OR UPDATE ON package_items
  FOR EACH ROW EXECUTE FUNCTION prevent_nested_packages();

-- 4) Add check constraints if not present (Postgres lacks IF NOT EXISTS for constraints -> guard via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'package_items_qty_positive'
  ) THEN
    ALTER TABLE package_items ADD CONSTRAINT package_items_qty_positive CHECK (qty > 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'package_items_no_self_ref'
  ) THEN
    ALTER TABLE package_items ADD CONSTRAINT package_items_no_self_ref CHECK (service_id <> child_id);
  END IF;
END$$;

-- 5) Index to optimize ordering lookups (ignore failure if exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_package_items_service_sort') THEN
    CREATE INDEX idx_package_items_service_sort ON package_items(service_id, sort_order, child_id);
  END IF;
END$$;

COMMENT ON COLUMN package_items.sort_order IS 'Explicit ordering of children within a package (Phase 1)';
-- Note: service_id acts as package_id in application layer (see code comment in data access layer).
