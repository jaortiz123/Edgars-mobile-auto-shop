-- Clean rewrite (previous version corrupted by line wrapping) --

BEGIN; -- Postgres migration

-- Ensure required extensions for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- Ensure message_channel enum exists
DO $$
BEGIN
  CREATE TYPE message_channel AS ENUM ('sms','email');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Table definition
CREATE TABLE IF NOT EXISTS message_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,            -- stable identifier (e.g. 'vehicle_ready_sms')
  label       TEXT NOT NULL,                   -- human friendly label
  channel     message_channel NOT NULL,        -- 'sms' | 'email'
  category    TEXT,                            -- arbitrary grouping (e.g., 'Reminders')
  body        TEXT NOT NULL,                   -- template body with tokens
  variables   TEXT[] DEFAULT ARRAY[]::TEXT[],  -- extracted variable tokens
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID NULL,
  updated_by  UUID NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT now(),
  updated_at  TIMESTAMP NOT NULL DEFAULT now()
);

-- Touch function & trigger (idempotent)
CREATE OR REPLACE FUNCTION trg_mt_touch() RETURNS trigger AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_message_templates_touch ON message_templates;
CREATE TRIGGER trg_message_templates_touch
BEFORE UPDATE ON message_templates
FOR EACH ROW EXECUTE PROCEDURE trg_mt_touch();

CREATE INDEX IF NOT EXISTS idx_message_templates_active ON message_templates(is_active) WHERE is_active IS TRUE;
CREATE INDEX IF NOT EXISTS idx_message_templates_channel ON message_templates(channel) WHERE is_active IS TRUE;
CREATE INDEX IF NOT EXISTS idx_message_templates_category ON message_templates(category) WHERE is_active IS TRUE;

-- Seed (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM message_templates) THEN
    INSERT INTO message_templates (slug, label, channel, category, body, variables) VALUES
      ('appt_reminder_basic_sms', 'Appointment Reminder (SMS)', 'sms', 'Reminders', 'Hi there! This is a reminder about your upcoming service appointment. Reply YES to confirm or call us to reschedule.', ARRAY[]::TEXT[]),
      ('appt_reminder_personalized_sms', 'Appt Reminder (Personalized SMS)', 'sms', 'Reminders', 'Hi {{customer.name}}, this is a reminder for your appointment on {{appointment.start}} regarding your {{vehicle.year}} {{vehicle.make}} {{vehicle.model}}.', ARRAY['customer.name','appointment.start','vehicle.year','vehicle.make','vehicle.model']),
      ('vehicle_ready_sms', 'Vehicle Ready (SMS)', 'sms', 'Status Updates', 'Good news! Your vehicle service is complete and ready for pickup. Let us know when you''re on the way.', ARRAY[]::TEXT[]),
      ('thanks_followup_email', 'Thank You + Review (Email)', 'email', 'Follow Up', 'Thank you for choosing us for your recent service. We''d love your feedback—reply to this email with any thoughts or questions!', ARRAY[]::TEXT[]);
  END IF;
END $$;

COMMIT;

-- Down (development only)
-- BEGIN;
-- DROP TABLE IF EXISTS message_templates;
-- COMMIT;
