-- Seed sample template usage analytics events
-- Purpose: provide varied data for /api/admin/analytics/templates dashboard
-- Safe to run multiple times (idempotent-ish) via hash uniqueness where provided.
-- Assumes message_templates table already contains the referenced slugs.

BEGIN;

-- 1) vehicle_ready_sms (higher volume) - only insert if we haven't already added recent sample rows in last 24h
WITH tpl AS (
  SELECT id, channel FROM message_templates WHERE slug='vehicle_ready_sms'
), recent AS (
  SELECT 1 AS present FROM template_usage_events t JOIN tpl ON t.template_id=tpl.id
   WHERE t.sent_at > now() - interval '24 hours'
), rows AS (
  SELECT tpl.id AS template_id, 'vehicle_ready_sms' AS template_slug, tpl.channel AS tpl_channel, *
  FROM tpl
  CROSS JOIN (
    VALUES
      ('11111111-1111-1111-1111-111111111111'::uuid, now() - interval '6 hours',  TRUE, 320),
      ('22222222-2222-2222-2222-222222222222'::uuid, now() - interval '5 hours',  FALSE,410),
      ('11111111-1111-1111-1111-111111111111'::uuid, now() - interval '4 hours',  TRUE, 305),
      ('33333333-3333-3333-3333-333333333333'::uuid, now() - interval '2 hours',  FALSE,500),
      ('44444444-4444-4444-4444-444444444444'::uuid, now() - interval '30 minutes', TRUE,275)
  ) v(user_id, sent_at, was_automated, delivery_ms)
)
INSERT INTO template_usage_events (template_id, template_slug, channel, user_id, sent_at, was_automated, delivery_ms)
SELECT template_id, template_slug, tpl_channel, user_id, sent_at, was_automated, delivery_ms
FROM rows
WHERE EXISTS (SELECT 1 FROM tpl) AND NOT EXISTS (SELECT 1 FROM recent);

-- 2) thanks_followup_email
WITH tpl AS (
  SELECT id, channel FROM message_templates WHERE slug='thanks_followup_email'
), rows AS (
  SELECT tpl.id AS template_id, 'thanks_followup_email' AS template_slug, tpl.channel AS tpl_channel, *
  FROM tpl
  CROSS JOIN (
    VALUES
      ('55555555-5555-5555-5555-555555555555'::uuid, now() - interval '3 days', TRUE, 600),
      ('66666666-6666-6666-6666-666666666666'::uuid, now() - interval '1 days', FALSE,720)
  ) v(user_id, sent_at, was_automated, delivery_ms)
)
INSERT INTO template_usage_events (template_id, template_slug, channel, user_id, sent_at, was_automated, delivery_ms)
SELECT template_id, template_slug, tpl_channel, user_id, sent_at, was_automated, delivery_ms
FROM rows
WHERE EXISTS (SELECT 1 FROM tpl);

-- 3) appointment_confirm_sms
WITH tpl AS (
  SELECT id, channel FROM message_templates WHERE slug='appointment_confirm_sms'
), rows AS (
  SELECT tpl.id AS template_id, 'appointment_confirm_sms' AS template_slug, tpl.channel AS tpl_channel, *
  FROM tpl
  CROSS JOIN (
    VALUES
      ('77777777-7777-7777-7777-777777777777'::uuid, now() - interval '20 hours', TRUE, 310),
      ('88888888-8888-8888-8888-888888888888'::uuid, now() - interval '18 hours', TRUE, 305),
      ('99999999-9999-9999-9999-999999999999'::uuid, now() - interval '3 hours',  FALSE,450)
  ) v(user_id, sent_at, was_automated, delivery_ms)
)
INSERT INTO template_usage_events (template_id, template_slug, channel, user_id, sent_at, was_automated, delivery_ms)
SELECT template_id, template_slug, tpl_channel, user_id, sent_at, was_automated, delivery_ms
FROM rows
WHERE EXISTS (SELECT 1 FROM tpl);

-- 4) service_reminder_email
WITH tpl AS (
  SELECT id, channel FROM message_templates WHERE slug='service_reminder_email'
), rows AS (
  SELECT tpl.id AS template_id, 'service_reminder_email' AS template_slug, tpl.channel AS tpl_channel, *
  FROM tpl
  CROSS JOIN (
    VALUES
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, now() - interval '10 days', TRUE, 800),
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, now() - interval '6 days',  TRUE, 795),
      ('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, now() - interval '2 days',  FALSE,620)
  ) v(user_id, sent_at, was_automated, delivery_ms)
)
INSERT INTO template_usage_events (template_id, template_slug, channel, user_id, sent_at, was_automated, delivery_ms)
SELECT template_id, template_slug, tpl_channel, user_id, sent_at, was_automated, delivery_ms
FROM rows
WHERE EXISTS (SELECT 1 FROM tpl);

COMMIT;
