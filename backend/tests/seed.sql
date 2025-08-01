-- Test seed data for containerized integration tests
-- Provides realistic data for testing SQL constraints, joins, and business logic

-- Set timezone for consistent test data
SET TIME ZONE 'UTC';

-- Insert test customers
INSERT INTO customers (id, name, email, phone, address, created_at) VALUES
(1, 'John Doe', 'john.doe@example.com', '+15551234567', '123 Main St, Anytown, ST 12345', '2024-01-01 08:00:00'),
(2, 'Jane Smith', 'jane.smith@example.com', '+15559876543', '456 Oak Ave, Somewhere, ST 67890', '2024-01-02 09:00:00'),
(3, 'Bob Johnson', 'bob.johnson@example.com', '+15555551212', '789 Pine St, Elsewhere, ST 11111', '2024-01-03 10:00:00'),
(4, 'Alice Brown', 'alice.brown@example.com', '+15552468013', '321 Elm Dr, Nowhere, ST 22222', '2024-01-04 11:00:00'),
(5, 'Charlie Wilson', 'charlie.wilson@example.com', '+15557890123', '654 Maple Ln, Anywhere, ST 33333', '2024-01-05 12:00:00');

-- Insert test vehicles
INSERT INTO vehicles (id, customer_id, make, model, year, vin, license_plate, created_at) VALUES
(1, 1, 'Toyota', 'Camry', 2020, '1HGBH41JXMN109186', 'ABC123', '2024-01-01 08:30:00'),
(2, 1, 'Honda', 'Civic', 2018, '2HGBH41JXMN109187', 'DEF456', '2024-01-01 08:31:00'),
(3, 2, 'Ford', 'F-150', 2021, '3HGBH41JXMN109188', 'GHI789', '2024-01-02 09:30:00'),
(4, 3, 'Chevrolet', 'Malibu', 2019, '4HGBH41JXMN109189', 'JKL012', '2024-01-03 10:30:00'),
(5, 4, 'Nissan', 'Altima', 2022, '5HGBH41JXMN109190', 'MNO345', '2024-01-04 11:30:00'),
(6, 5, 'BMW', '328i', 2020, '6HGBH41JXMN109191', 'PQR678', '2024-01-05 12:30:00');

-- Insert test appointments with various statuses
INSERT INTO appointments (id, customer_id, vehicle_id, status, start_ts, end_ts, total_amount, paid_amount, notes, created_at) VALUES
-- SCHEDULED appointments
(1, 1, 1, 'SCHEDULED', '2024-02-15 09:00:00+00', '2024-02-15 10:00:00+00', 150.00, 0.00, 'Oil change and inspection', '2024-02-01 09:00:00'),
(2, 2, 3, 'SCHEDULED', '2024-02-16 14:00:00+00', '2024-02-16 16:00:00+00', 350.00, 0.00, 'Brake pad replacement', '2024-02-02 10:00:00'),
(3, 5, 6, 'SCHEDULED', '2024-02-20 11:00:00+00', '2024-02-20 12:30:00+00', 200.00, 0.00, 'Diagnostic check', '2024-02-05 11:00:00'),

-- IN_PROGRESS appointments
(4, 3, 4, 'IN_PROGRESS', '2024-02-10 08:00:00+00', '2024-02-10 10:00:00+00', 275.00, 0.00, 'Transmission service', '2024-02-01 08:00:00'),
(5, 1, 2, 'IN_PROGRESS', '2024-02-12 13:00:00+00', '2024-02-12 15:00:00+00', 125.00, 0.00, 'Tire rotation and balance', '2024-02-03 13:00:00'),

-- READY appointments  
(6, 4, 5, 'READY', '2024-02-08 10:00:00+00', '2024-02-08 11:30:00+00', 95.00, 0.00, 'Battery replacement', '2024-01-28 10:00:00'),

-- COMPLETED appointments
(7, 2, 3, 'COMPLETED', '2024-02-05 09:00:00+00', '2024-02-05 11:00:00+00', 450.00, 450.00, 'Major service - completed', '2024-01-25 09:00:00'),
(8, 1, 1, 'COMPLETED', '2024-02-01 14:00:00+00', '2024-02-01 15:00:00+00', 75.00, 75.00, 'Quick oil change - paid in full', '2024-01-20 14:00:00'),
(9, 3, 4, 'COMPLETED', '2024-01-30 11:00:00+00', '2024-01-30 12:00:00+00', 180.00, 180.00, 'Brake inspection - completed', '2024-01-15 11:00:00'),

-- NO_SHOW appointment
(10, 5, 6, 'NO_SHOW', '2024-02-07 15:00:00+00', '2024-02-07 16:00:00+00', 120.00, 0.00, 'Customer did not show up', '2024-01-30 15:00:00');

-- Insert test appointment services (let PostgreSQL generate UUIDs)
INSERT INTO appointment_services (appointment_id, name, notes, estimated_hours, estimated_price, category, created_at) VALUES
-- Services for appointment 1 (SCHEDULED)
(1, 'Oil Change', 'Full synthetic oil change', 0.5, 75.00, 'Maintenance', '2024-02-01 09:00:00'),
(1, 'Multi-point Inspection', 'Complete vehicle inspection', 0.75, 75.00, 'Inspection', '2024-02-01 09:01:00'),

-- Services for appointment 2 (SCHEDULED)  
(2, 'Brake Pad Replacement', 'Front brake pads', 2.0, 250.00, 'Repair', '2024-02-02 10:00:00'),
(2, 'Brake Fluid Flush', 'Replace brake fluid', 0.5, 100.00, 'Maintenance', '2024-02-02 10:01:00'),

-- Services for appointment 3 (SCHEDULED)
(3, 'Engine Diagnostic', 'Check engine light diagnosis', 1.0, 150.00, 'Diagnostic', '2024-02-05 11:00:00'),
(3, 'Software Update', 'ECU software update', 0.5, 50.00, 'Software', '2024-02-05 11:01:00'),

-- Services for appointment 4 (IN_PROGRESS)
(4, 'Transmission Service', 'Fluid change and filter', 2.5, 275.00, 'Maintenance', '2024-02-01 08:00:00'),

-- Services for appointment 5 (IN_PROGRESS)
(5, 'Tire Rotation', 'Rotate all four tires', 0.5, 50.00, 'Maintenance', '2024-02-03 13:00:00'),
(5, 'Wheel Balancing', 'Balance all wheels', 0.75, 75.00, 'Maintenance', '2024-02-03 13:01:00'),

-- Services for appointment 6 (READY)
(6, 'Battery Replacement', 'New 12V battery installation', 0.5, 95.00, 'Repair', '2024-01-28 10:00:00'),

-- Services for appointment 7 (COMPLETED)
(7, 'Major Service', 'Complete major service package', 4.0, 350.00, 'Maintenance', '2024-01-25 09:00:00'),
(7, 'Coolant Flush', 'Complete coolant system flush', 1.0, 100.00, 'Maintenance', '2024-01-25 09:01:00'),

-- Services for appointment 8 (COMPLETED)
(8, 'Express Oil Change', 'Quick oil change service', 0.5, 75.00, 'Maintenance', '2024-01-20 14:00:00'),

-- Services for appointment 9 (COMPLETED)
(9, 'Brake Inspection', 'Comprehensive brake inspection', 1.0, 180.00, 'Inspection', '2024-01-15 11:00:00'),

-- Services for appointment 10 (NO_SHOW)
(10, 'Air Filter Replacement', 'Replace engine air filter', 0.25, 45.00, 'Maintenance', '2024-01-30 15:00:00'),
(10, 'Cabin Filter Replacement', 'Replace cabin air filter', 0.25, 75.00, 'Maintenance', '2024-01-30 15:01:00');

-- Insert test payments for completed appointments (let PostgreSQL generate UUIDs)
INSERT INTO payments (appointment_id, amount, method, note, created_at) VALUES
(7, 450.00, 'card', 'Payment processed via credit card', '2024-02-05 11:30:00'),
(8, 75.00, 'cash', 'Paid in cash upon completion', '2024-02-01 15:30:00'),
(9, 180.00, 'card', 'Debit card payment', '2024-01-30 12:30:00');

-- Insert test messages (let PostgreSQL generate UUIDs)
INSERT INTO messages (appointment_id, channel, direction, body, status, sent_at) VALUES
(1, 'sms', 'out', 'Hi John, your oil change appointment is scheduled for tomorrow at 9 AM. Please arrive 10 minutes early.', 'delivered', '2024-02-14 17:00:00'),
(2, 'email', 'out', 'Dear Jane, your brake service appointment is confirmed for February 16th at 2 PM.', 'delivered', '2024-02-15 10:00:00'),
(4, 'sms', 'out', 'Hi Bob, your vehicle is currently being serviced. We will update you with progress.', 'delivered', '2024-02-10 10:00:00'),
(6, 'sms', 'out', 'Hi Alice, your vehicle is ready for pickup. Battery replacement completed successfully.', 'delivered', '2024-02-08 11:45:00'),
(7, 'sms', 'in', 'Thanks for the great service! Vehicle runs perfectly.', 'delivered', '2024-02-05 12:00:00');

-- Verify data integrity with some basic checks
DO $$
DECLARE
    customer_count INTEGER;
    vehicle_count INTEGER;
    appointment_count INTEGER;
    service_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO customer_count FROM customers;
    SELECT COUNT(*) INTO vehicle_count FROM vehicles;
    SELECT COUNT(*) INTO appointment_count FROM appointments;
    SELECT COUNT(*) INTO service_count FROM appointment_services;
    
    RAISE INFO 'Seed data loaded successfully:';
    RAISE INFO '  Customers: %', customer_count;
    RAISE INFO '  Vehicles: %', vehicle_count;
    RAISE INFO '  Appointments: %', appointment_count;
    RAISE INFO '  Services: %', service_count;
    
    -- Verify foreign key relationships
    IF EXISTS (SELECT 1 FROM vehicles WHERE customer_id NOT IN (SELECT id FROM customers)) THEN
        RAISE EXCEPTION 'Foreign key violation: vehicles reference non-existent customers';
    END IF;
    
    IF EXISTS (SELECT 1 FROM appointments WHERE customer_id NOT IN (SELECT id FROM customers)) THEN
        RAISE EXCEPTION 'Foreign key violation: appointments reference non-existent customers';
    END IF;
    
    IF EXISTS (SELECT 1 FROM appointments WHERE vehicle_id NOT IN (SELECT id FROM vehicles)) THEN
        RAISE EXCEPTION 'Foreign key violation: appointments reference non-existent vehicles';
    END IF;
    
    RAISE INFO '  ✓ All foreign key relationships verified';
END $$;

-- Reset sequences to avoid conflicts in tests
SELECT setval('customers_id_seq', (SELECT MAX(id) FROM customers) + 1000);
SELECT setval('vehicles_id_seq', (SELECT MAX(id) FROM vehicles) + 1000);
SELECT setval('appointments_id_seq', (SELECT MAX(id) FROM appointments) + 1000);
