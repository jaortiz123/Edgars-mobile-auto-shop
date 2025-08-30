-- Create test tenants for validation
INSERT INTO tenants (id, name, slug, is_active) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Test Tenant 1', 'test-tenant-1', true),
  ('00000000-0000-0000-0000-000000000002', 'Test Tenant 2', 'test-tenant-2', true)
ON CONFLICT (id) DO NOTHING;
