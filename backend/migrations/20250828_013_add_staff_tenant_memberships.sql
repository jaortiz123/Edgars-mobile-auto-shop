-- 20250828_013_add_staff_tenant_memberships.sql
-- Table to associate internal staff identities with tenants

BEGIN;

CREATE TABLE IF NOT EXISTS staff_tenant_memberships (
  staff_id  TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'Advisor',
  PRIMARY KEY (staff_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_tenant_memberships_staff ON staff_tenant_memberships(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_tenant_memberships_tenant ON staff_tenant_memberships(tenant_id);

COMMIT;
