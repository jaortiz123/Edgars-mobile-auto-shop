-- Test database schema for containerized integration tests
-- Based on the production schema but simplified for testing

BEGIN;
SET TIME ZONE 'UTC';

-- Ensure UUID generation is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create ENUM types
CREATE TYPE appointment_status AS ENUM (
    'SCHEDULED','IN_PROGRESS','READY','COMPLETED','NO_SHOW','CANCELED'
);

CREATE TYPE message_channel AS ENUM ('sms','email');
CREATE TYPE message_direction AS ENUM ('out','in');
CREATE TYPE message_status AS ENUM ('sending','delivered','failed');
CREATE TYPE payment_method AS ENUM ('cash','card','ach','other');
CREATE TYPE inspection_item_status AS ENUM ('pass','attention','fail');

-- Core tables

-- customers table
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    is_vip BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- vehicles table
CREATE TABLE vehicles (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    make TEXT,
    model TEXT,
    year INTEGER,
    vin TEXT,
    license_plate TEXT,
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- service_operations table (must exist before appointments for FK)
CREATE TABLE service_operations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    internal_code TEXT,
    display_order INT,
    keywords TEXT[] NOT NULL DEFAULT '{}',
    default_hours NUMERIC(5,2),
    default_price NUMERIC(10,2),
    flags TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    -- Marks this service operation as a package (collection of other operations)
    is_package BOOLEAN NOT NULL DEFAULT FALSE,
    replaced_by_id TEXT REFERENCES service_operations(id),
    labor_matrix_code TEXT,
    skill_level INT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_service_operations_category ON service_operations(category);

-- Package composition table (mirrors production; legacy service_id column name for package id)
CREATE TABLE package_items (
    service_id TEXT NOT NULL REFERENCES service_operations(id) ON DELETE CASCADE, -- package id
    child_id TEXT NOT NULL REFERENCES service_operations(id) ON DELETE RESTRICT,
    qty NUMERIC(10,2) NOT NULL DEFAULT 1,
    sort_order INT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (service_id, child_id),
    CHECK (qty > 0),
    CHECK (service_id <> child_id)
);

-- Prevent nesting packages (a package cannot include another package as a child)
CREATE OR REPLACE FUNCTION trg_package_items_prevent_nesting()
RETURNS TRIGGER AS $fn$
DECLARE
    child_is_package BOOLEAN;
BEGIN
    SELECT is_package INTO child_is_package FROM service_operations WHERE id = NEW.child_id;
    IF child_is_package THEN
        RAISE EXCEPTION 'Cannot add package % to package % (nesting not allowed)', NEW.child_id, NEW.service_id;
    END IF;
    RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_package_items_prevent_nesting ON package_items;
CREATE TRIGGER trg_package_items_prevent_nesting
BEFORE INSERT ON package_items
FOR EACH ROW EXECUTE PROCEDURE trg_package_items_prevent_nesting();
CREATE INDEX idx_package_items_service ON package_items(service_id, sort_order);
CREATE INDEX idx_package_items_child ON package_items(child_id);

-- appointments table
-- technicians table (new progress tracking)
CREATE TABLE technicians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    initials TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE appointments (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
    status appointment_status NOT NULL DEFAULT 'SCHEDULED',
    -- Added to align with robustness tests referencing appointment_date
    appointment_date TIMESTAMPTZ,
    start_ts TIMESTAMPTZ,
    end_ts TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    total_amount NUMERIC(10,2),
    paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    check_in_at TIMESTAMP,
    check_out_at TIMESTAMP,
    tech_id UUID REFERENCES technicians(id),
    title TEXT,
    notes TEXT,
    location_address TEXT,
    primary_operation_id TEXT REFERENCES service_operations(id),
    service_category TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);
-- Performance indexes for unified profile endpoint
CREATE INDEX IF NOT EXISTS idx_appointments_customer ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_customer_start_ts ON appointments(customer_id, start_ts DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_vehicle_start_ts ON appointments(vehicle_id, start_ts DESC);

-- audit_logs table (needed for audit() function to avoid failing inserts in tests)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    before JSONB NOT NULL DEFAULT '{}'::jsonb,
    after JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- appointment_services table
CREATE TABLE appointment_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    service_operation_id TEXT REFERENCES service_operations(id),
    name TEXT NOT NULL,
    notes TEXT,
    estimated_hours NUMERIC(5,2),
    estimated_price NUMERIC(10,2),
    category TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    channel message_channel NOT NULL,
    direction message_direction NOT NULL,
    body TEXT NOT NULL,
    status message_status NOT NULL,
    sent_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Customer / Vehicle patch audit tables (Epic E Phase 2)
CREATE TABLE IF NOT EXISTS customer_audits (
    id BIGSERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    actor_id TEXT NOT NULL,
    fields_changed JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_audits_customer_created ON customer_audits(customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS vehicle_audits (
    id BIGSERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    actor_id TEXT NOT NULL,
    fields_changed JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vehicle_audits_vehicle_created ON vehicle_audits(vehicle_id, created_at DESC);

-- Invoicing tables (test subset mirrors production schema logic)
CREATE TYPE test_invoice_status AS ENUM ('DRAFT','SENT','PARTIALLY_PAID','PAID','VOID');

CREATE TABLE invoices (
    id TEXT PRIMARY KEY,
    appointment_id INTEGER UNIQUE REFERENCES appointments(id) ON DELETE SET NULL,
    customer_id INTEGER, -- denormalized optional
    vehicle_id INTEGER,
    status test_invoice_status NOT NULL DEFAULT 'DRAFT',
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    subtotal_cents INTEGER NOT NULL DEFAULT 0,
    tax_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL DEFAULT 0,
    amount_paid_cents INTEGER NOT NULL DEFAULT 0,
    amount_due_cents INTEGER NOT NULL DEFAULT 0,
    issued_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    voided_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (subtotal_cents >= 0),
    CHECK (tax_cents >= 0),
    CHECK (total_cents = subtotal_cents + tax_cents),
    CHECK (amount_paid_cents >= 0),
    CHECK (amount_paid_cents <= total_cents),
    CHECK (amount_due_cents = total_cents - amount_paid_cents)
);
-- Performance indexes for profile/timeline lookups
CREATE INDEX idx_invoices_customer_created ON invoices(customer_id, created_at DESC);
CREATE INDEX idx_invoices_vehicle_created ON invoices(vehicle_id, created_at DESC);

CREATE TABLE invoice_line_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    service_operation_id TEXT,
    service_category TEXT,
    service_subcategory TEXT,
    service_internal_code TEXT,
    -- Package tagging for analytics (optional foreign key to service_operations)
    package_id TEXT REFERENCES service_operations(id),
    package_name TEXT,
    name TEXT NOT NULL,
    description TEXT,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit_price_cents INTEGER NOT NULL DEFAULT 0,
    line_subtotal_cents INTEGER NOT NULL DEFAULT 0,
    tax_rate_basis_points INTEGER NOT NULL DEFAULT 0,
    tax_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (quantity > 0),
    CHECK (unit_price_cents >= 0),
    CHECK (line_subtotal_cents = unit_price_cents * quantity),
    CHECK (tax_cents >= 0),
    CHECK (total_cents = line_subtotal_cents + tax_cents)
);

CREATE INDEX idx_invoice_line_items_invoice ON invoice_line_items(invoice_id, position);

-- Snapshot trigger for invoice_line_items (mirrors production migration 20250817_009_invoice_snapshot_trigger.sql)
CREATE OR REPLACE FUNCTION trg_invoice_line_items_snapshot()
RETURNS TRIGGER AS $fn$
DECLARE
    so_category TEXT;
    so_subcategory TEXT;
    so_internal TEXT;
BEGIN
    IF NEW.service_operation_id IS NOT NULL THEN
        SELECT category, subcategory, id INTO so_category, so_subcategory, so_internal
        FROM service_operations WHERE id = NEW.service_operation_id;
        NEW.service_category := COALESCE(NEW.service_category, so_category);
        NEW.service_subcategory := COALESCE(NEW.service_subcategory, so_subcategory);
        NEW.service_internal_code := COALESCE(NEW.service_internal_code, so_internal);
    END IF;
    RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_line_items_snapshot ON invoice_line_items;
CREATE TRIGGER trg_invoice_line_items_snapshot
BEFORE INSERT ON invoice_line_items
FOR EACH ROW EXECUTE PROCEDURE trg_invoice_line_items_snapshot();

-- payments table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    method payment_method NOT NULL,
    note TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- inspection_checklists table
CREATE TABLE inspection_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- inspection_items table
CREATE TABLE inspection_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_id UUID NOT NULL REFERENCES inspection_checklists(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    status inspection_item_status NOT NULL,
    notes TEXT
);

-- Create indexes for performance
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_vehicles_customer ON vehicles(customer_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_start_ts ON appointments(start_ts);
CREATE INDEX IF NOT EXISTS idx_appointments_vehicle ON appointments(vehicle_id);
CREATE INDEX idx_services_appt ON appointment_services(appointment_id);
CREATE INDEX idx_messages_appt ON messages(appointment_id);
CREATE INDEX idx_messages_sent_at ON messages(sent_at);
CREATE INDEX idx_payments_appt ON payments(appointment_id);
CREATE INDEX idx_checklists_appt ON inspection_checklists(appointment_id);
CREATE INDEX idx_items_checklist ON inspection_items(checklist_id);

-- message_templates table (subset of production fields)
CREATE TABLE message_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug TEXT UNIQUE NOT NULL,
        label TEXT NOT NULL,
        channel message_channel NOT NULL,
        category TEXT,
        body TEXT NOT NULL,
        variables TEXT[] DEFAULT ARRAY[]::TEXT[],
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_message_templates_active ON message_templates(is_active) WHERE is_active IS TRUE;
CREATE INDEX idx_message_templates_channel ON message_templates(channel) WHERE is_active IS TRUE;

-- Seed a few templates used by tests (idempotent style)
INSERT INTO message_templates (slug, label, channel, category, body, variables)
VALUES
    ('appt_reminder_basic_sms', 'Appointment Reminder (SMS)', 'sms', 'Reminders', 'Hi there! This is a reminder about your upcoming service appointment.', ARRAY[]::TEXT[]),
    ('vehicle_ready_sms', 'Vehicle Ready (SMS)', 'sms', 'Status Updates', 'Good news! Your vehicle service is complete and ready for pickup.', ARRAY[]::TEXT[]),
    ('thanks_followup_email', 'Thank You + Review (Email)', 'email', 'Follow Up', 'Thank you for choosing us for your recent service.', ARRAY[]::TEXT[])
ON CONFLICT (slug) DO NOTHING;

-- template_usage_events table
CREATE TABLE template_usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES message_templates(id) ON DELETE RESTRICT,
    template_slug TEXT NOT NULL,
    channel message_channel NOT NULL,
    appointment_id INTEGER NULL REFERENCES appointments(id) ON DELETE SET NULL,
    user_id UUID NULL,
    sent_at TIMESTAMP NOT NULL DEFAULT now(),
    delivery_ms INTEGER NULL CHECK (delivery_ms IS NULL OR delivery_ms >= 0),
    was_automated BOOLEAN NOT NULL DEFAULT FALSE,
    hash TEXT NULL,
    CONSTRAINT template_usage_events_slug_nonempty CHECK (length(template_slug) > 0)
);
-- Indexes aligned with production migration
CREATE UNIQUE INDEX idx_template_usage_hash ON template_usage_events(hash) WHERE hash IS NOT NULL;
CREATE INDEX idx_template_usage_sent_at ON template_usage_events(sent_at DESC);
CREATE INDEX idx_template_usage_template ON template_usage_events(template_id, sent_at DESC);
CREATE INDEX idx_template_usage_slug ON template_usage_events(template_slug);
CREATE INDEX idx_template_usage_appointment ON template_usage_events(appointment_id) WHERE appointment_id IS NOT NULL;
CREATE INDEX idx_template_usage_user ON template_usage_events(user_id) WHERE user_id IS NOT NULL;

COMMIT;
