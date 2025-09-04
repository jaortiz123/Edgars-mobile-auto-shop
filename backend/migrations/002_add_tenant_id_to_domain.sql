-- 002_add_tenant_id_to_domain.sql
BEGIN;

-- Add tenant_id (nullable during backfill). Use UUID to align with modern schema.
ALTER TABLE customers            ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE vehicles             ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE invoices             ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE appointments         ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE invoice_line_items   ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- Backfill strategy: map legacy data to the default tenant (if present)
DO $$
DECLARE
  default_tenant UUID;
BEGIN
  SELECT id INTO default_tenant FROM tenants WHERE slug = 'default' LIMIT 1;
  IF default_tenant IS NULL THEN
    SELECT id INTO default_tenant FROM tenants WHERE name ILIKE 'Edgar%Auto Shop%' LIMIT 1;
  END IF;
  IF default_tenant IS NULL THEN
    -- fallback to canonical id used elsewhere if present
    IF EXISTS (SELECT 1 FROM tenants WHERE id = '00000000-0000-0000-0000-000000000001'::uuid) THEN
      default_tenant := '00000000-0000-0000-0000-000000000001'::uuid;
    END IF;
  END IF;
  IF default_tenant IS NOT NULL THEN
    UPDATE customers          SET tenant_id = COALESCE(tenant_id, default_tenant);
    UPDATE vehicles           SET tenant_id = COALESCE(tenant_id, default_tenant);
    UPDATE invoices           SET tenant_id = COALESCE(tenant_id, default_tenant);
    UPDATE appointments       SET tenant_id = COALESCE(tenant_id, default_tenant);
    UPDATE invoice_line_items SET tenant_id = COALESCE(tenant_id, default_tenant);
  END IF;
END $$;

-- Enforce NOT NULL + FKs after backfill
ALTER TABLE customers          ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE vehicles           ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE invoices           ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE appointments       ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE invoice_line_items ALTER COLUMN tenant_id SET NOT NULL;

-- Add FK constraints (using DO blocks for conditional execution)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'customers_tenant_fk') THEN
        ALTER TABLE customers ADD CONSTRAINT customers_tenant_fk
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'vehicles_tenant_fk') THEN
        ALTER TABLE vehicles ADD CONSTRAINT vehicles_tenant_fk
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'invoices_tenant_fk') THEN
        ALTER TABLE invoices ADD CONSTRAINT invoices_tenant_fk
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'appointments_tenant_fk') THEN
        ALTER TABLE appointments ADD CONSTRAINT appointments_tenant_fk
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'ili_tenant_fk') THEN
        ALTER TABLE invoice_line_items ADD CONSTRAINT ili_tenant_fk
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
    END IF;
END $$;

-- Performance indexes (confirm in prod)
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant ON vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appts_tenant_sched ON appointments(tenant_id, scheduled_date, id);
CREATE INDEX IF NOT EXISTS idx_ili_tenant ON invoice_line_items(tenant_id);

COMMIT;
