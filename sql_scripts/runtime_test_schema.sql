-- Simple schema for security runtime testing
-- This creates the minimal tables needed to test RLS and tenant isolation

BEGIN;

-- Create users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    tenant_id TEXT DEFAULT 't_default',
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT REFERENCES tenants(id),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Create vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT REFERENCES tenants(id),
    customer_id UUID REFERENCES customers(id),
    make TEXT,
    model TEXT,
    year INTEGER,
    vin TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Create appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT REFERENCES tenants(id),
    customer_id UUID REFERENCES customers(id),
    vehicle_id UUID REFERENCES vehicles(id),
    status TEXT DEFAULT 'SCHEDULED',
    start_ts TIMESTAMP,
    end_ts TIMESTAMP,
    title TEXT,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT REFERENCES tenants(id),
    appointment_id UUID REFERENCES appointments(id),
    customer_id UUID REFERENCES customers(id),
    amount DECIMAL(10,2),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Create password_resets table
CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

COMMIT;
