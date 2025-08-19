-- SMS Consent Migration for TCPA Compliance
-- Adds SMS consent tracking fields to customers table

-- Add SMS consent fields to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS sms_consent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sms_consent_date TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS sms_consent_ip VARCHAR(45) NULL,
ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sms_opt_out_date TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS sms_opt_out_method VARCHAR(20) NULL; -- 'STOP', 'WEB', 'CALL'

-- Add index for SMS queries
CREATE INDEX IF NOT EXISTS idx_customers_sms_consent ON customers(sms_consent, sms_opt_out);

-- Update existing customers to maintain current SMS behavior (opt them in if they have a phone)
-- This ensures existing functionality continues to work
UPDATE customers
SET sms_consent = TRUE,
    sms_consent_date = created_at
WHERE phone IS NOT NULL
  AND phone != ''
  AND sms_consent IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN customers.sms_consent IS 'Whether customer has opted in to receive SMS notifications';
COMMENT ON COLUMN customers.sms_consent_date IS 'Timestamp when customer opted in to SMS';
COMMENT ON COLUMN customers.sms_consent_ip IS 'IP address when consent was given (for audit trail)';
COMMENT ON COLUMN customers.sms_opt_out IS 'Whether customer has opted out of SMS notifications';
COMMENT ON COLUMN customers.sms_opt_out_date IS 'Timestamp when customer opted out';
COMMENT ON COLUMN customers.sms_opt_out_method IS 'Method used to opt out (STOP, WEB, CALL)';
