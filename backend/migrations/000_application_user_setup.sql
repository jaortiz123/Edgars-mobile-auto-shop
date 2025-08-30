-- application_user_setup.sql
-- CRITICAL: Create non-superuser for application to respect RLS

-- Create application database user (skip if exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'edgars_app') THEN
        CREATE USER edgars_app WITH PASSWORD 'secure_app_password_change_in_prod';
    END IF;
END
$$;

-- Grant database connection (dynamic database name)
DO $$
BEGIN
    EXECUTE 'GRANT CONNECT ON DATABASE ' || current_database() || ' TO edgars_app';
END
$$;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO edgars_app;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO edgars_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO edgars_app;

-- Ensure future tables have permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO edgars_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO edgars_app;

-- NOTE: Application should connect as 'edgars_app', NOT 'postgres'
-- RLS policies only apply to non-superuser accounts
