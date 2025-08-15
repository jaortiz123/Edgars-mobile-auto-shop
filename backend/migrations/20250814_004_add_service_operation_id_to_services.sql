-- Migration: add service_operation_id linkage for catalog to appointment_services
BEGIN;
ALTER TABLE appointment_services
  ADD COLUMN IF NOT EXISTS service_operation_id TEXT REFERENCES service_operations(id);
CREATE INDEX IF NOT EXISTS idx_services_operation_id ON appointment_services(service_operation_id);
COMMIT;
