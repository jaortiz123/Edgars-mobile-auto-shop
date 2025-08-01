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
    created_at TIMESTAMP NOT NULL DEFAULT now()
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
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- appointments table
CREATE TABLE appointments (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
    status appointment_status NOT NULL DEFAULT 'SCHEDULED',
    start_ts TIMESTAMPTZ,
    end_ts TIMESTAMPTZ,
    total_amount NUMERIC(10,2),
    paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    check_in_at TIMESTAMP,
    check_out_at TIMESTAMP,
    tech_id UUID,
    title TEXT,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- appointment_services table
CREATE TABLE appointment_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
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
CREATE INDEX idx_appointments_customer ON appointments(customer_id);
CREATE INDEX idx_appointments_vehicle ON appointments(vehicle_id);
CREATE INDEX idx_services_appt ON appointment_services(appointment_id);
CREATE INDEX idx_messages_appt ON messages(appointment_id);
CREATE INDEX idx_messages_sent_at ON messages(sent_at);
CREATE INDEX idx_payments_appt ON payments(appointment_id);
CREATE INDEX idx_checklists_appt ON inspection_checklists(appointment_id);
CREATE INDEX idx_items_checklist ON inspection_items(checklist_id);

COMMIT;
