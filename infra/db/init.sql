CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  make VARCHAR(100),
  model VARCHAR(100),
  year INTEGER,
  license_plate VARCHAR(20),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  base_price DECIMAL(10,2)
);

CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  vehicle_id  INTEGER REFERENCES vehicles(id),
  service_id  INTEGER REFERENCES services(id),
  scheduled_date DATE,
  scheduled_time TIME,
  location_address TEXT,
  status VARCHAR(50) DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_appointments_schedule
  ON appointments (scheduled_date, scheduled_time);
