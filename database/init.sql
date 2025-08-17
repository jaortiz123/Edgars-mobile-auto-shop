CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  -- Added in migration 20250816_007_add_customer_is_vip.sql; kept here so fresh init DBs have column without needing migration replay
  is_vip BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE vehicles (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  make VARCHAR(100),
  model VARCHAR(100),
  year INTEGER,
  vin VARCHAR(32),
  license_plate VARCHAR(20),
  notes TEXT
);
CREATE TABLE services (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  base_price DECIMAL(10,2)
);
CREATE TABLE appointments (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  vehicle_id INTEGER REFERENCES vehicles(id),
  service_id INTEGER REFERENCES services(id),
  scheduled_date DATE,
  scheduled_time TIME,
  location_address TEXT,
  status VARCHAR(50) DEFAULT 'scheduled',
  notes TEXT,
  -- Added columns used by analytics/search queries
  start_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_ts TIMESTAMP,
  total_amount NUMERIC(12,2) DEFAULT 0,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  check_in_at TIMESTAMP,
  check_out_at TIMESTAMP,
  title TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO services (name, description, duration_minutes, base_price) VALUES
('Oil Change', 'Standard oil change with filter', 30, 45.00),
('Brake Inspection', 'Complete brake system inspection', 45, 65.00),
('Battery Replacement', 'Replace car battery', 20, 120.00),
('Tire Rotation', 'Rotate and balance tires', 45, 50.00);

-- Performance indexes
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_appointments_schedule ON appointments(scheduled_date, scheduled_time);

-- Invoices & related (added for E2E invoice lifecycle)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status_enum') THEN
    CREATE TYPE invoice_status_enum AS ENUM ('DRAFT','SENT','PARTIALLY_PAID','PAID','VOID');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    appointment_id INTEGER UNIQUE REFERENCES appointments(id) ON DELETE SET NULL,
    customer_id INTEGER,
    vehicle_id INTEGER,
    status invoice_status_enum NOT NULL DEFAULT 'DRAFT',
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

CREATE TABLE IF NOT EXISTS invoice_line_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    service_operation_id TEXT,
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
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON invoice_line_items(invoice_id, position);
