-- Clean RLS Migration for Python Execution
-- Production RLS-Based Multi-Tenant Migration (psycopg2 compatible)

BEGIN;

-- ============================================================================
-- PHASE 1: Create tenants table with proper constraints
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    plan VARCHAR(50) NOT NULL DEFAULT 'starter',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Billing and limits
    max_appointments INTEGER DEFAULT 100,
    max_vehicles INTEGER DEFAULT 50,
    max_customers INTEGER DEFAULT 100,

    -- Contact and branding
    admin_email VARCHAR(255),
    phone VARCHAR(50),
    logo_url VARCHAR(500),
    primary_color VARCHAR(7) DEFAULT '#0066cc',

    -- Constraints for data integrity
    CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
    CONSTRAINT valid_plan CHECK (plan IN ('starter', 'pro', 'enterprise', 'trial')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'suspended', 'cancelled', 'trial')),
    CONSTRAINT valid_color CHECK (primary_color ~ '^#[0-9a-fA-F]{6}$')
);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PHASE 2: Add tenant_id columns with proper indexes
-- ============================================================================

-- Add tenant_id to core tables if not exists
DO $$
BEGIN
    -- Customers
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'customers' AND column_name = 'tenant_id') THEN
        ALTER TABLE customers ADD COLUMN tenant_id UUID;
    END IF;

    -- Vehicles
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'vehicles' AND column_name = 'tenant_id') THEN
        ALTER TABLE vehicles ADD COLUMN tenant_id UUID;
    END IF;

    -- Appointments
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'appointments' AND column_name = 'tenant_id') THEN
        ALTER TABLE appointments ADD COLUMN tenant_id UUID;
    END IF;
END $$;

-- ============================================================================
-- PHASE 3: Create default tenant and backfill data
-- ============================================================================

INSERT INTO tenants (id, slug, name, plan, status, admin_email)
VALUES (
    '00000000-0000-0000-0000-000000000001'::UUID,
    'edgar-auto-shop',
    'Edgar''s Auto Shop (Default)',
    'enterprise',
    'active',
    'admin@edgarautoshop.com'
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = NOW();

-- Backfill existing data to default tenant
DO $$
DECLARE
    default_tenant_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
BEGIN
    UPDATE customers SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    UPDATE vehicles SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    UPDATE appointments SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
END $$;

-- ============================================================================
-- PHASE 4: Add foreign key constraints and NOT NULL
-- ============================================================================

-- Add foreign key constraints
DO $$
BEGIN
    -- Only add constraint if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'customers_tenant_id_fkey') THEN
        ALTER TABLE customers ADD CONSTRAINT customers_tenant_id_fkey
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'vehicles_tenant_id_fkey') THEN
        ALTER TABLE vehicles ADD CONSTRAINT vehicles_tenant_id_fkey
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'appointments_tenant_id_fkey') THEN
        ALTER TABLE appointments ADD CONSTRAINT appointments_tenant_id_fkey
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Make tenant_id NOT NULL after backfilling
ALTER TABLE customers ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE vehicles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE appointments ALTER COLUMN tenant_id SET NOT NULL;

-- ============================================================================
-- PHASE 5: Tenant-aware unique constraints (prevent cross-tenant collisions)
-- ============================================================================

-- Drop existing unique constraints and recreate as tenant-aware
DROP INDEX IF EXISTS customers_email_key;
DROP INDEX IF EXISTS vehicles_vin_key;

-- Create tenant-aware unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_email_per_tenant
    ON customers(tenant_id, lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicles_vin_per_tenant
    ON vehicles(tenant_id, upper(vin)) WHERE vin IS NOT NULL;

-- Customer phone uniqueness per tenant (if phone should be unique)
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_phone_per_tenant
    ON customers(tenant_id, phone) WHERE phone IS NOT NULL;

-- ============================================================================
-- PHASE 6: Performance indexes for tenant queries
-- ============================================================================

-- Core tenant-aware indexes
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_created ON customers(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vehicles_tenant_id ON vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant_customer ON vehicles(tenant_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_id ON appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_date ON appointments(tenant_id, appointment_date DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_status ON appointments(tenant_id, status);

-- ============================================================================
-- PHASE 7: Row-Level Security (RLS) Implementation
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Create tenant isolation policies
DROP POLICY IF EXISTS tenant_isolation_customers ON customers;
CREATE POLICY tenant_isolation_customers ON customers
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_vehicles ON vehicles;
CREATE POLICY tenant_isolation_vehicles ON vehicles
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_appointments ON appointments;
CREATE POLICY tenant_isolation_appointments ON appointments
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ============================================================================
-- PHASE 8: Tenant context management functions
-- ============================================================================

-- Set tenant context for current session
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_uuid UUID)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.tenant_id', tenant_uuid::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get current tenant context
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.tenant_id', true)::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Validate tenant access (for middleware)
CREATE OR REPLACE FUNCTION validate_tenant_access(tenant_slug VARCHAR(100))
RETURNS UUID AS $$
DECLARE
    tenant_uuid UUID;
BEGIN
    SELECT id INTO tenant_uuid
    FROM tenants
    WHERE slug = tenant_slug AND status = 'active';

    IF tenant_uuid IS NULL THEN
        RAISE EXCEPTION 'Tenant not found or inactive: %', tenant_slug;
    END IF;

    RETURN tenant_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PHASE 9: Utility functions for tenant management
-- ============================================================================

-- Create new tenant with validation
CREATE OR REPLACE FUNCTION create_tenant(
    tenant_slug VARCHAR(100),
    tenant_name VARCHAR(255),
    admin_email VARCHAR(255),
    plan VARCHAR(50) DEFAULT 'trial'
)
RETURNS UUID AS $$
DECLARE
    new_tenant_id UUID;
BEGIN
    -- Validate inputs
    IF NOT tenant_slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' THEN
        RAISE EXCEPTION 'Invalid tenant slug format: %', tenant_slug;
    END IF;

    IF admin_email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
        RAISE EXCEPTION 'Invalid email format: %', admin_email;
    END IF;

    -- Create tenant
    INSERT INTO tenants (slug, name, admin_email, plan, status)
    VALUES (tenant_slug, tenant_name, admin_email, plan, 'trial')
    RETURNING id INTO new_tenant_id;

    RETURN new_tenant_id;
END;
$$ LANGUAGE plpgsql;

-- Tenant statistics view
CREATE OR REPLACE VIEW tenant_stats AS
SELECT
    t.id,
    t.slug,
    t.name,
    t.plan,
    t.status,
    t.created_at,
    COALESCE(stats.customer_count, 0) as customer_count,
    COALESCE(stats.vehicle_count, 0) as vehicle_count,
    COALESCE(stats.appointment_count, 0) as appointment_count,
    COALESCE(stats.appointments_this_month, 0) as appointments_this_month,

    -- Usage vs limits
    CASE WHEN t.max_customers > 0
         THEN (COALESCE(stats.customer_count, 0)::float / t.max_customers * 100)::int
         ELSE 0 END as customer_usage_pct,
    CASE WHEN t.max_vehicles > 0
         THEN (COALESCE(stats.vehicle_count, 0)::float / t.max_vehicles * 100)::int
         ELSE 0 END as vehicle_usage_pct
FROM tenants t
LEFT JOIN (
    SELECT
        c.tenant_id,
        COUNT(DISTINCT c.id) as customer_count,
        COUNT(DISTINCT v.id) as vehicle_count,
        COUNT(DISTINCT a.id) as appointment_count,
        COUNT(DISTINCT a.id) FILTER (
            WHERE a.appointment_date >= date_trunc('month', CURRENT_DATE)
        ) as appointments_this_month
    FROM customers c
    LEFT JOIN vehicles v ON c.tenant_id = v.tenant_id
    LEFT JOIN appointments a ON c.tenant_id = a.tenant_id
    GROUP BY c.tenant_id
) stats ON t.id = stats.tenant_id;

-- Create break-glass superuser role
DO $$
BEGIN
    -- Create break-glass role if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'breakglass_admin') THEN
        CREATE ROLE breakglass_admin WITH LOGIN PASSWORD 'temp-emergency-password-change-immediately';
        GRANT CONNECT ON DATABASE CURRENT_DATABASE TO breakglass_admin;
        GRANT USAGE ON SCHEMA public TO breakglass_admin;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO breakglass_admin;
        GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO breakglass_admin;
        ALTER ROLE breakglass_admin BYPASSRLS;

        -- Log the creation
        RAISE NOTICE 'Created break-glass admin role - CHANGE PASSWORD IMMEDIATELY';
    END IF;
END $$;

COMMIT;
