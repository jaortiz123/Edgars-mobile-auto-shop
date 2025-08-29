-- monitoring/monitor-rls-drift.sql
-- Read-only checks you can run nightly to detect drift.

-- A) Tables missing RLS or FORCE
SELECT n.nspname AS schema, c.relname AS table, c.relrowsecurity AS rls, c.relforcerowsecurity AS force
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
  AND c.relname IN ('customers','vehicles','appointments','invoices','invoice_line_items')
  AND NOT (c.relrowsecurity AND c.relforcerowsecurity);

-- B) Policies missing the tenant predicate
SELECT c.relname AS table, p.polname, p.polcmd, p.polqual
FROM pg_policies p JOIN pg_class c ON c.oid = p.polrelid
WHERE c.relname IN ('customers','vehicles','appointments','invoices','invoice_line_items')
  AND p.polname LIKE '%_tenant'
  AND position('current_setting(''app.tenant_id'')' IN p.polqual::text) = 0;

-- C) Roles with BYPASSRLS (flag)
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolbypassrls;

-- D) Public writes (flag tables granting INSERT/UPDATE/DELETE to PUBLIC)
SELECT n.nspname, c.relname, privilege_type
FROM information_schema.role_table_grants g
JOIN pg_class c ON c.relname = g.table_name
JOIN pg_namespace n ON n.nspname = g.table_schema
WHERE grantee = 'PUBLIC' AND privilege_type IN ('INSERT','UPDATE','DELETE');
