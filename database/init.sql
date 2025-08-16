CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  -- Added in migration 20250816_007_add_customer_is_vip.sql; kept here so fresh init DBs have column without needing migration replay
  is_vip BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
