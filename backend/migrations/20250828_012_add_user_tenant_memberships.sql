-- 20250828_012_add_user_tenant_memberships.sql
-- Create a user-to-tenant membership table and backfill from existing data

BEGIN;

-- Create membership table linking customers (users) to tenants
CREATE TABLE IF NOT EXISTS user_tenant_memberships (
  user_id   INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tenant_id UUID    NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
  role      TEXT    NOT NULL DEFAULT 'Customer',
  PRIMARY KEY (user_id, tenant_id)
);

-- Helpful composite index for membership lookups
CREATE INDEX IF NOT EXISTS idx_user_tenant_memberships_user ON user_tenant_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenant_memberships_tenant ON user_tenant_memberships(tenant_id);

-- Backfill: for any existing customers with a tenant_id, ensure a membership row exists
INSERT INTO user_tenant_memberships (user_id, tenant_id, role)
SELECT c.id, c.tenant_id, 'Customer'
  FROM customers c
 WHERE c.tenant_id IS NOT NULL
   AND NOT EXISTS (
         SELECT 1 FROM user_tenant_memberships m
          WHERE m.user_id = c.id AND m.tenant_id = c.tenant_id
       );

COMMIT;
