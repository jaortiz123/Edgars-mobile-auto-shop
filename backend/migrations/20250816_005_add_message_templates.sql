-- Message Templates table (dynamic admin-managed messaging templates)
-- Safe, idempotent-ish migration: guards for existing objects.

BEGIN; -- Postgres migration (uses DO $$ blocks and ENUM types)
-- NOTE: If a generic SQL linter flags syntax below, it's because this file is Postgres-specific.

-- Ensure message_channel enum exists (created in earlier migrations)
DO $$ BEGIN
  CREATE TYPE message_channel AS ENUM ('sms','email');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table: message_templates
-- Stores reusable message bodies (SMS / Email) with variable placeholders ( {{path.to.value}} )
-- We maintain both an internal UUID primary key and a stable slug ("template_id" from prior static JSON) for referencing.
CREATE TABLE IF NOT EXISTS message_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,            -- stable identifier (e.g. 'vehicle_ready_sms')
  label       TEXT NOT NULL,                   -- human friendly label
  channel     message_channel NOT NULL,        -- 'sms' | 'email'
  category    TEXT,                            -- arbitrary grouping (e.g., 'Reminders')
  body        TEXT NOT NULL,                   -- template body with tokens
  variables   TEXT[] DEFAULT ARRAY[]::TEXT[],  -- extracted variable tokens (denormalized for quick filtering)
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,   -- soft delete flag
  created_by  UUID NULL,                       -- optional author (audit can hold full before/after)
  updated_by  UUID NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT now(),
  updated_at  TIMESTAMP NOT NULL DEFAULT now()
);

-- Update trigger for updated_at
DO $$ BEGIN
  CREATE OR REPLACE FUNCTION trg_mt_touch() RETURNS trigger AS $$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END; $$ LANGUAGE plpgsql;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_message_templates_touch
  BEFORE UPDATE ON message_templates
  FOR EACH ROW EXECUTE PROCEDURE trg_mt_touch();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_message_templates_active ON message_templates(is_active) WHERE is_active IS TRUE;
CREATE INDEX IF NOT EXISTS idx_message_templates_channel ON message_templates(channel) WHERE is_active IS TRUE;
CREATE INDEX IF NOT EXISTS idx_message_templates_category ON message_templates(category) WHERE is_active IS TRUE;

-- Seed initial templates if table empty (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM message_templates) THEN
    INSERT INTO message_templates (slug, label, channel, category, body, variables)
    VALUES
      ('appt_reminder_basic_sms', 'Appointment Reminder (SMS)', 'sms', 'Reminders', 'Hi there! This is a reminder about your upcoming service appointment. Reply YES to confirm or call us to reschedule.', ARRAY[]::TEXT[]),
      ('appt_reminder_personalized_sms', 'Appt Reminder (Personalized SMS)', 'sms', 'Reminders', 'Hi {{customer.name}}, this is a reminder for your appointment on {{appointment.start}} regarding your {{vehicle.year}} {{vehicle.make}} {{vehicle.model}}.', ARRAY['customer.name','appointment.start','vehicle.year','vehicle.make','vehicle.model']),
      ('vehicle_ready_sms', 'Vehicle Ready (SMS)', 'sms', 'Status Updates', 'Good news! Your vehicle service is complete and ready for pickup. Let us know when you''re on the way.', ARRAY[]::TEXT[]),
      ('thanks_followup_email', 'Thank You + Review (Email)', 'email', 'Follow Up', 'Thank you for choosing us for your recent service. We''d love your feedback—reply to this email with any thoughts or questions!', ARRAY[]::TEXT[]);
  END IF;
END $$;

COMMIT; -- end Postgres migration

-- Down (development only)
-- BEGIN;
-- DROP TABLE IF EXISTS message_templates;
-- COMMIT;
