-- DDL for page_signature table supporting precomputed weak ETags
-- Phase B: ETag Signature Table

CREATE TABLE IF NOT EXISTS page_signature (
    entity_id TEXT PRIMARY KEY,
    last_updated_at TIMESTAMPTZ NOT NULL,
    weak_etag TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helper function to upsert a signature given an entity_id and timestamp basis
CREATE OR REPLACE FUNCTION ensure_page_signature(p_entity_id TEXT, p_basis TIMESTAMPTZ)
RETURNS VOID AS $$
DECLARE
    v_etag TEXT;
BEGIN
    v_etag := 'W/"' || encode(digest(p_entity_id || ':' || p_basis::TEXT, 'sha1'), 'hex') || '"';
    INSERT INTO page_signature(entity_id, last_updated_at, weak_etag, updated_at)
    VALUES(p_entity_id, p_basis, v_etag, NOW())
    ON CONFLICT(entity_id)
    DO UPDATE SET last_updated_at = EXCLUDED.last_updated_at,
                  weak_etag = EXCLUDED.weak_etag,
                  updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger functions for contributing tables (customers, vehicles, appointments, invoices)
CREATE OR REPLACE FUNCTION trg_update_customer_signature()
RETURNS TRIGGER AS $$
DECLARE
    basis_ts TIMESTAMPTZ;
BEGIN
    basis_ts := NEW.updated_at; -- assume updated_at maintained
    PERFORM ensure_page_signature('customer:' || NEW.id::TEXT, basis_ts);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_update_vehicle_signature()
RETURNS TRIGGER AS $$
DECLARE
    basis_ts TIMESTAMPTZ;
BEGIN
    basis_ts := NEW.updated_at;
    PERFORM ensure_page_signature('vehicle:' || NEW.id::TEXT, basis_ts);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_update_appointment_signature()
RETURNS TRIGGER AS $$
DECLARE
    basis_ts TIMESTAMPTZ;
BEGIN
    basis_ts := NEW.updated_at;
    PERFORM ensure_page_signature('vehicle_profile:' || NEW.vehicle_id::TEXT, basis_ts);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_update_invoice_signature()
RETURNS TRIGGER AS $$
DECLARE
    basis_ts TIMESTAMPTZ;
    v_vehicle_id INT;
BEGIN
    basis_ts := NEW.updated_at;
    SELECT vehicle_id INTO v_vehicle_id FROM appointments WHERE id = NEW.appointment_id;
    IF v_vehicle_id IS NOT NULL THEN
        PERFORM ensure_page_signature('vehicle_profile:' || v_vehicle_id::TEXT, basis_ts);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers
DROP TRIGGER IF EXISTS customer_page_signature_trg ON customers;
CREATE TRIGGER customer_page_signature_trg
AFTER INSERT OR UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION trg_update_customer_signature();

DROP TRIGGER IF EXISTS vehicle_page_signature_trg ON vehicles;
CREATE TRIGGER vehicle_page_signature_trg
AFTER INSERT OR UPDATE ON vehicles
FOR EACH ROW EXECUTE FUNCTION trg_update_vehicle_signature();

DROP TRIGGER IF EXISTS appointment_page_signature_trg ON appointments;
CREATE TRIGGER appointment_page_signature_trg
AFTER INSERT OR UPDATE ON appointments
FOR EACH ROW EXECUTE FUNCTION trg_update_appointment_signature();

DROP TRIGGER IF EXISTS invoice_page_signature_trg ON invoices;
CREATE TRIGGER invoice_page_signature_trg
AFTER INSERT OR UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION trg_update_invoice_signature();
