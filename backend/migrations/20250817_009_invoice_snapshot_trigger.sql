-- Invoice snapshot trigger for denormalizing service_operation fields
-- Populates service_category, service_subcategory, service_internal_code on insert
-- and keeps them stable (no updates after insert to preserve historical accuracy).
-- Assumes columns already added by prior migration (01_add_catalog_v2_columns.sql)

BEGIN;

CREATE OR REPLACE FUNCTION trg_invoice_line_items_snapshot()
RETURNS TRIGGER AS $fn$
DECLARE
  so_category TEXT;
  so_subcategory TEXT;
  so_internal TEXT;
BEGIN
  IF NEW.service_operation_id IS NOT NULL THEN
    SELECT category, subcategory, internal_code
      INTO so_category, so_subcategory, so_internal
    FROM service_operations
    WHERE id = NEW.service_operation_id;

    NEW.service_category := COALESCE(NEW.service_category, so_category);
    NEW.service_subcategory := COALESCE(NEW.service_subcategory, so_subcategory);
    NEW.service_internal_code := COALESCE(NEW.service_internal_code, so_internal);
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_line_items_snapshot ON invoice_line_items;
CREATE TRIGGER trg_invoice_line_items_snapshot
BEFORE INSERT ON invoice_line_items
FOR EACH ROW EXECUTE PROCEDURE trg_invoice_line_items_snapshot();

COMMIT;
