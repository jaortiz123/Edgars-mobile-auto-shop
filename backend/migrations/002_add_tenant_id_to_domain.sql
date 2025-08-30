-- 002_add_tenant_id_to_domain.sql
BEGIN;

-- Add tenant_id (nullable during backfill)
ALTER TABLE customers   ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE vehicles    ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE invoices    ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS tenant_id TEXT;

-- Backfill strategy: map legacy data to a bootstrap tenant (e.g., 't_default')
INSERT INTO tenants(id, name)
  VALUES('t_default','Default Tenant')
  ON CONFLICT (id) DO NOTHING;

UPDATE customers   SET tenant_id = COALESCE(tenant_id, 't_default');
UPDATE vehicles    SET tenant_id = COALESCE(tenant_id, 't_default');
UPDATE invoices    SET tenant_id = COALESCE(tenant_id, 't_default');
UPDATE appointments SET tenant_id = COALESCE(tenant_id, 't_default');
UPDATE invoice_line_items SET tenant_id = COALESCE(tenant_id, 't_default');

-- Enforce NOT NULL + FKs after backfill
ALTER TABLE customers   ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE vehicles    ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE invoices    ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE appointments ALTER COLUMN tenant_id SET NOT NULL;
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
