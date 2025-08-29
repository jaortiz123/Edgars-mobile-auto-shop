-- file: show_policies.sql
-- Policy visibility check (no superuser required)
-- Query catalog views to show all RLS policies

SELECT schemaname,
       tablename,
       policyname,
       permissive,
       roles,
       cmd,
       qual
FROM pg_policies
WHERE schemaname NOT IN ('pg_catalog','information_schema')
ORDER BY schemaname, tablename, policyname;
