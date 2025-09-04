-- 003_rls_enable.sql
BEGIN;

-- Pre-drop any existing RLS policies that reference current_tenant_id()
DO $$
DECLARE tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['customers','vehicles','invoices','appointments','invoice_line_items']) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_rls_select ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_rls_modify ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_rls_update ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_rls_delete ON %I', tbl, tbl);
  END LOOP;
END$$;

-- Replace any prior text-typed function with a UUID-returning version
DROP FUNCTION IF EXISTS current_tenant_id();
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Read/write policies
DO $$
DECLARE tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['customers','vehicles','invoices','appointments','invoice_line_items']) LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I_rls_select ON %I', tbl, tbl
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS %I_rls_modify ON %I', tbl, tbl
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS %I_rls_update ON %I', tbl, tbl
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS %I_rls_delete ON %I', tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I_rls_select ON %I FOR SELECT USING (tenant_id = current_tenant_id())',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I_rls_modify ON %I FOR INSERT WITH CHECK (tenant_id = current_tenant_id())',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I_rls_update ON %I FOR UPDATE USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id())',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I_rls_delete ON %I FOR DELETE USING (tenant_id = current_tenant_id())',
      tbl, tbl
    );
  END LOOP;
END$$;

-- Optional: default tenant injection on insert via trigger
CREATE OR REPLACE FUNCTION enforce_tenant_on_insert() RETURNS trigger AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := current_tenant_id();
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- Attach to all tenant tables (idempotent helper)
DO $$
DECLARE tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['customers','vehicles','invoices','appointments','invoice_line_items']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_tenant_insert_%I ON %I', tbl, tbl);
    EXECUTE format('CREATE TRIGGER trg_tenant_insert_%I BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION enforce_tenant_on_insert()', tbl, tbl);
  END LOOP;
END$$;

COMMIT;
