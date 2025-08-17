-- Template Usage Events table (logs each successful template send)
-- Simplified per guidance: no slug sync trigger; historical rows retain original slug.
-- Depends on message_templates table & message_channel enum (created earlier).

BEGIN;

CREATE TABLE IF NOT EXISTS template_usage_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES message_templates(id) ON DELETE RESTRICT,
  template_slug   TEXT NOT NULL,
  channel         message_channel NOT NULL,
  appointment_id  BIGINT NULL REFERENCES appointments(id) ON DELETE SET NULL,
  user_id         UUID NULL,
  sent_at         TIMESTAMP NOT NULL DEFAULT now(),
  delivery_ms     INTEGER NULL CHECK (delivery_ms IS NULL OR delivery_ms >= 0),
  was_automated   BOOLEAN NOT NULL DEFAULT FALSE,
  hash            TEXT NULL,
  CONSTRAINT template_usage_events_slug_nonempty CHECK (length(template_slug) > 0)
);

-- Optional idempotency support (skip duplicates when hash provided)
CREATE UNIQUE INDEX IF NOT EXISTS uq_template_usage_hash ON template_usage_events(hash) WHERE hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_template_usage_sent_at ON template_usage_events(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_usage_template ON template_usage_events(template_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_usage_slug ON template_usage_events(template_slug);
CREATE INDEX IF NOT EXISTS idx_template_usage_appointment ON template_usage_events(appointment_id) WHERE appointment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_template_usage_user ON template_usage_events(user_id) WHERE user_id IS NOT NULL;

COMMIT;

-- Down (development only)
-- BEGIN;
-- DROP TABLE IF EXISTS template_usage_events;
-- COMMIT;
