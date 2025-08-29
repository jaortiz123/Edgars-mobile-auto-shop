-- file: verify_rls.sql
-- RLS tenant isolation verification for Edgar's Auto Shop
-- Adjust tenant IDs to your actual dataset

BEGIN;

-- 1) Without tenant context (must be fail-closed = 0 rows)
RESET ROLE;
SET ROLE app_user;
SELECT 'no_tenant_customers' AS check, COUNT(*) AS rows FROM customers;
SELECT 'no_tenant_vehicles' AS check, COUNT(*) AS rows FROM vehicles;
SELECT 'no_tenant_appointments' AS check, COUNT(*) AS rows FROM appointments;
SELECT 'no_tenant_services' AS check, COUNT(*) AS rows FROM services;

-- 2) With tenant A
SET LOCAL app.tenant_id = '00000000-0000-0000-0000-00000000000A';  -- <- Replace with your tenant_id A
SELECT 'tenantA_customers' AS check, COUNT(*) AS rows FROM customers;
SELECT 'tenantA_vehicles' AS check, COUNT(*) AS rows FROM vehicles;
SELECT 'tenantA_appointments' AS check, COUNT(*) AS rows FROM appointments;
SELECT 'tenantA_services' AS check, COUNT(*) AS rows FROM services;

-- 3) With tenant B (should show 0 or different count, never A's rows)
SET LOCAL app.tenant_id = '00000000-0000-0000-0000-00000000000B';  -- <- Replace with your tenant_id B
SELECT 'tenantB_customers' AS check, COUNT(*) AS rows FROM customers;
SELECT 'tenantB_vehicles' AS check, COUNT(*) AS rows FROM vehicles;
SELECT 'tenantB_appointments' AS check, COUNT(*) AS rows FROM appointments;
SELECT 'tenantB_services' AS check, COUNT(*) AS rows FROM services;

-- 4) Negative: explicit cross-tenant probe must return 0
-- (Policy predicates use tenant_id = current_setting('app.tenant_id',true)::uuid)
SET LOCAL app.tenant_id = '00000000-0000-0000-0000-00000000000A';
SELECT 'cross_tenant_customers_probe' AS check,
       COUNT(*) AS rows
FROM customers
WHERE tenant_id <> current_setting('app.tenant_id', true)::uuid;

SELECT 'cross_tenant_vehicles_probe' AS check,
       COUNT(*) AS rows
FROM vehicles
WHERE tenant_id <> current_setting('app.tenant_id', true)::uuid;

SELECT 'cross_tenant_appointments_probe' AS check,
       COUNT(*) AS rows
FROM appointments
WHERE tenant_id <> current_setting('app.tenant_id', true)::uuid;

SELECT 'cross_tenant_services_probe' AS check,
       COUNT(*) AS rows
FROM services
WHERE tenant_id <> current_setting('app.tenant_id', true)::uuid;

ROLLBACK;  -- read-only script
