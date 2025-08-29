-- Multi-Tenant Database Schema Migration
-- Prepares your existing single-tenant database for SaaS multi-tenancy
-- Run this after establishing secure bastion connection

-- ============================================================================
-- PHASE 1: Add tenant support to existing tables
-- ============================================================================

-- Create tenants table (master tenant registry)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) UNIQUE NOT NULL, -- subdomain: acme.edgarautoshop.com
    name VARCHAR(255) NOT NULL,
    plan VARCHAR(50) NOT NULL DEFAULT 'starter', -- starter, pro, enterprise
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, suspended, cancelled
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Billing and limits
    max_appointments INTEGER DEFAULT 100,
    max_vehicles INTEGER DEFAULT 50,
    max_customers INTEGER DEFAULT 100,

    -- Contact info
    admin_email VARCHAR(255),
    phone VARCHAR(50),

    -- Branding
    logo_url VARCHAR(500),
    primary_color VARCHAR(7) DEFAULT '#0066cc',

    -- Constraints
    CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT valid_plan CHECK (plan IN ('starter', 'pro', 'enterprise')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'suspended', 'cancelled', 'trial'))
);

-- Add updated_at trigger for tenants
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PHASE 2: Add tenant_id to existing tables
-- ============================================================================

-- Add tenant_id to core tables (if not exists)
DO $$
BEGIN
    -- Customers table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'customers' AND column_name = 'tenant_id') THEN
        ALTER TABLE customers ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
    END IF;

    -- Vehicles table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'vehicles' AND column_name = 'tenant_id') THEN
        ALTER TABLE vehicles ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_vehicles_tenant_id ON vehicles(tenant_id);
    END IF;

    -- Appointments table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'appointments' AND column_name = 'tenant_id') THEN
        ALTER TABLE appointments ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_appointments_tenant_id ON appointments(tenant_id);
    END IF;

    -- Services table (if exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'services') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'services' AND column_name = 'tenant_id') THEN
            ALTER TABLE services ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
            CREATE INDEX IF NOT EXISTS idx_services_tenant_id ON services(tenant_id);
        END IF;
    END IF;
END $$;

-- ============================================================================
-- PHASE 3: Create default tenant for existing data
-- ============================================================================

-- Create a default tenant for existing data
INSERT INTO tenants (id, slug, name, plan, status, admin_email)
VALUES (
    '00000000-0000-0000-0000-000000000001'::UUID,
    'default',
    'Edgar''s Auto Shop',
    'enterprise',
    'active',
    'admin@edgarautoshop.com'
) ON CONFLICT (id) DO NOTHING;

-- Assign existing data to default tenant
DO $$
DECLARE
    default_tenant_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
BEGIN
    -- Update customers
    UPDATE customers SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;

    -- Update vehicles
    UPDATE vehicles SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;

    -- Update appointments
    UPDATE appointments SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;

    -- Update services (if exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'services') THEN
        EXECUTE 'UPDATE services SET tenant_id = $1 WHERE tenant_id IS NULL'
        USING default_tenant_id;
    END IF;
END $$;

-- ============================================================================
-- PHASE 4: Add tenant isolation constraints
-- ============================================================================

-- Make tenant_id NOT NULL after backfilling
DO $$
BEGIN
    -- Only add NOT NULL constraint if all rows have tenant_id
    IF (SELECT COUNT(*) FROM customers WHERE tenant_id IS NULL) = 0 THEN
        ALTER TABLE customers ALTER COLUMN tenant_id SET NOT NULL;
    END IF;

    IF (SELECT COUNT(*) FROM vehicles WHERE tenant_id IS NULL) = 0 THEN
        ALTER TABLE vehicles ALTER COLUMN tenant_id SET NOT NULL;
    END IF;

    IF (SELECT COUNT(*) FROM appointments WHERE tenant_id IS NULL) = 0 THEN
        ALTER TABLE appointments ALTER COLUMN tenant_id SET NOT NULL;
    END IF;
END $$;

-- Add composite indexes for tenant-aware queries
CREATE INDEX IF NOT EXISTS idx_customers_tenant_email ON customers(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant_customer ON vehicles(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_date ON appointments(tenant_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_status ON appointments(tenant_id, status);

-- ============================================================================
-- PHASE 5: Create tenant-aware views
-- ============================================================================

-- View for tenant statistics
CREATE OR REPLACE VIEW tenant_stats AS
SELECT
    t.id,
    t.slug,
    t.name,
    t.plan,
    t.status,
    COALESCE(c.customer_count, 0) as customer_count,
    COALESCE(v.vehicle_count, 0) as vehicle_count,
    COALESCE(a.appointment_count, 0) as appointment_count,
    COALESCE(a.appointments_this_month, 0) as appointments_this_month
FROM tenants t
LEFT JOIN (
    SELECT tenant_id, COUNT(*) as customer_count
    FROM customers
    GROUP BY tenant_id
) c ON t.id = c.tenant_id
LEFT JOIN (
    SELECT tenant_id, COUNT(*) as vehicle_count
    FROM vehicles
    GROUP BY tenant_id
) v ON t.id = v.tenant_id
LEFT JOIN (
    SELECT
        tenant_id,
        COUNT(*) as appointment_count,
        COUNT(*) FILTER (WHERE appointment_date >= date_trunc('month', CURRENT_DATE)) as appointments_this_month
    FROM appointments
    GROUP BY tenant_id
) a ON t.id = a.tenant_id;

-- ============================================================================
-- PHASE 6: Create tenant context functions
-- ============================================================================

-- Function to set tenant context (for RLS in future)
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_uuid UUID)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', tenant_uuid::text, true);
END;
$$ LANGUAGE plpgsql;

-- Function to get current tenant context
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_tenant_id', true)::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PHASE 7: Sample tenant creation
-- ============================================================================

-- Function to create new tenant with sample data
CREATE OR REPLACE FUNCTION create_sample_tenant(
    tenant_slug VARCHAR(100),
    tenant_name VARCHAR(255),
    admin_email VARCHAR(255)
)
RETURNS UUID AS $$
DECLARE
    new_tenant_id UUID;
BEGIN
    -- Create tenant
    INSERT INTO tenants (slug, name, admin_email, plan, status)
    VALUES (tenant_slug, tenant_name, admin_email, 'trial', 'active')
    RETURNING id INTO new_tenant_id;

    -- Create sample customer
    INSERT INTO customers (tenant_id, first_name, last_name, email, phone)
    VALUES (
        new_tenant_id,
        'Demo', 'Customer',
        'demo@' || tenant_slug || '.com',
        '(555) 123-4567'
    );

    RETURN new_tenant_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check migration results
SELECT 'Migration completed successfully' as status;

-- Show tenant summary
SELECT
    'Tenants created' as metric,
    COUNT(*) as count
FROM tenants
UNION ALL
SELECT
    'Customers with tenant_id' as metric,
    COUNT(*) as count
FROM customers WHERE tenant_id IS NOT NULL
UNION ALL
SELECT
    'Vehicles with tenant_id' as metric,
    COUNT(*) as count
FROM vehicles WHERE tenant_id IS NOT NULL
UNION ALL
SELECT
    'Appointments with tenant_id' as metric,
    COUNT(*) as count
FROM appointments WHERE tenant_id IS NOT NULL;

-- Show tenant stats view
SELECT * FROM tenant_stats;

-- Example: Create demo tenant
-- SELECT create_sample_tenant('demo-shop', 'Demo Auto Shop', 'demo@example.com');

COMMIT;
