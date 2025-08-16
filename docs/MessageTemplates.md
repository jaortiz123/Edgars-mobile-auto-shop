# Message Templates (Phase 5 Increment 1 & 2)

Initial scaffolding for a lightweight, extensible message template system used within the Appointment Drawer "Messages" tab.

## Objectives

- Provide advisors with rapid insert of common outbound messages.
- Keep first increment intentionally simple (static JSON + insertion UI).
- Lay groundwork for variable interpolation & persistence without premature complexity.

## Data Model

Stored in `frontend/src/data/messageTemplates.json` (bundled at build time):

```jsonc
{
  "id": "vehicle_ready_sms",        // unique identifier
  "label": "Vehicle Ready (SMS)",   // human readable
  "channel": "sms",                 // 'sms' | 'email' | 'any'
  "category": "Status Updates",     // optional grouping
  "body": "Good news! Your vehicle service is complete and ready for pickup." 
}
```

Future extension: add `variables: ["customer_name", "appointment_date"]` so we can pre-scan & highlight placeholders.

## Runtime Helpers

`messageTemplates.ts` exports:

- `messageTemplates`: typed array
- `getTemplatesForChannel(channel)`
- `applyTemplate(template, context)` simple `{{var}}` replacement (leaves unknowns intact)

## UI Integration (MessageThread)

- New "Templates" toggle button reveals a scrollable panel.
- Category filter appears when templates loaded.
- Selecting a template appends (or sets) the composer textarea content.
- Focus returns to textarea for immediate editing.

## Testing

`messageTemplates.insert.test.tsx` validates picker flow & insertion.

## Increment 2 Additions

Implemented lightweight variable engine with features:

- Nested path resolution: `{{customer.name}}`, `{{vehicle.year}}`.
- Escaped literals: prefix with backslash `\\{{notAVar}}` -> renders `{{notAVar}}`.
- Missing variable tagging: unresolved tokens render as `[path.to.var]` in preview.
- Optional fallback syntax scaffold (pipe + quoted text reserved for future use).
- Preview UI inside template picker (expand per template; shows resolved text & missing markers).
- Insert action uses resolved text at time of insertion.

Added personalized example template `appt_reminder_personalized_sms` demonstrating variables.

### Acceptance (Increment 2)

- User can preview template with variables substituted from drawer context (appointment/customer/vehicle).
- Missing values clearly indicated (bracketed path form).
- Escaped tokens render literally.
- Unit tests cover nested resolution, missing handling, escape behavior.

## Upcoming Increments

| Increment | Feature | Notes |
|-----------|---------|-------|
| 3 | Send Integration + Optimistic UX | Insert & Send, optimistic pending, retry on failure, payload includes template metadata. |
| 4 | Favorites / Pinning | Persist user pinned templates in localStorage. |
| 5 | Admin Template Management | CRUD UI (role-gated) backed by backend storage. |
| 6 | Analytics | Track template usage frequency for optimization. |

## Increment 3 Additions

Implemented optimistic send pipeline:

- Insert & Send button in template preview.
- POST payload now supports `template_id` + `variables_used` via new API util.
- Immediate optimistic message with `sending` indicator; auto-updates on success.
- Failure path marks message as `failed` with inline Retry.
- Playwright E2E test (`e2e/messageTemplates.send.spec.ts`) covers success & failure flows and payload validation.

## Acceptance (Increment 1)

- Static templates load & filter by channel.
- User can insert template text into composer.
- No runtime errors; existing messaging still works.
