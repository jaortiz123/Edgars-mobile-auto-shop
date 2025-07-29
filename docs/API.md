# API.md — Edgar’s Mobile Auto Shop

**Date:** 2025‑07‑25
**Owner:** Jesus
**Status:** Stable for S1; S2/S3 sections flagged.

> **Principle:** Small, predictable, appointment‑centric API. Single payloads for Drawer. All timestamps **UTC** ISO‑8601. JWT with role claims. Feature‑flag new surfaces.

---

## 0. Conventions

* **Base URL**: `/api`
* **Auth**: JWT in cookie or `Authorization: Bearer <token>`
* **Content‑Type**: `application/json`
* **Time**: ISO‑8601 UTC, e.g., `2025-07-29T17:00:00Z`
* **IDs**: UUID strings (client may show human IDs but API uses UUIDs)
* **Errors**: structured (see below)
* **Feature Flags**: returns `404` or `403` if disabled

### Error model

```json
{
  "error": {
    "code": "RBAC_FORBIDDEN",
    "message": "Role Tech cannot complete appointments.",
    "details": { "requiredRole": "Advisor" }
  }
}
```

Common `code` values:

* `AUTH_REQUIRED`, `TOKEN_EXPIRED`
* `RBAC_FORBIDDEN`
* `VALIDATION_FAILED`
* `RESOURCE_NOT_FOUND`
* `RATE_LIMITED`
* `PROVIDER_ERROR`

### Pagination

Use `limit` (default 50, max 200) and `cursor` for forward pagination:

```
GET /api/appointments?from=...&limit=50&cursor=eyJpZCI6...
```

Response includes `nextCursor` when more pages exist.

### Idempotency

For message sending and payment creation, clients may send header `Idempotency-Key`. Server ensures single effect per key for 24h.

### Rate limits (defaults)

* Messaging: **20 / customer / 24h**, **200 / shop / hour**
* Exports: **5 / user / hour**
* Auth login: **5 / 15m / IP**
  On breach: `429 Too Many Requests` with `Retry-After` seconds.

---

## 1. Auth & Session

### POST `/api/auth/login` *(if using local auth)*

```jsonc
{ "email": "user@example.com", "password": "..." }
```

**200** → sets HTTP‑only cookie (or returns JWT):

```json
{ "user": { "id": "...", "name": "Jesus", "role": "Owner" } }
```

### GET `/api/me`

Returns current user and feature flags.

```json
{
  "user": { "id": "...", "name": "Jesus", "role": "Owner" },
  "flags": { "messaging": true, "payments": false, "inspections": false }
}
```

### POST `/api/auth/logout`

Clears session.

RBAC roles: `Owner`, `Advisor`, `Tech`, `Accountant`.

---

## 2. Appointments / Calendar

### GET `/api/appointments`

_Query params:_ `from`, `to`, `status`, `techId`, `q`, `limit`, `cursor`

**Response 200**

```json
{
  "appointments": [
    {
      "id": "APT-1",
      "status": "SCHEDULED",
      "start": "2025-07-29T17:00:00Z",     // legacy
      "end": null,                          // legacy
      "start_ts": "2025-07-29T17:00:00Z",  // canonical
      "end_ts": null                       // canonical
    }
  ],
  "nextCursor": null
}
```

### POST `/api/appointments`

```json
{
  "customer_id": "...",
  "vehicle_id": "...",
  "start": "2025-07-29T17:00:00Z",
  "end": "2025-07-29T18:00:00Z",
  "title": "Brake pads"
}
```

**201** → appointment

### GET `/api/appointments/:id`

Returns a **drawer payload**.

```json
{
  "appointment": { "id": "APT-1201", "status": "IN_PROGRESS", "start": "2025-07-29T17:00:00Z", "total_amount": 256.65, "paid_amount": 0 },
  "customer":   { "id": "C-412", "name": "Noah Bell", "phone": "+1-555-0100" },
  "vehicle":    { "id": "V-733", "year": 2019, "make": "Honda", "model": "HR-V", "vin": "..." },
  "services":   [ { "id": "SV-1", "name": "Front brake pad replacement", "estimated_price": 180.0 } ],
  "messages":   [ { "id": "MSG-1", "channel": "sms", "status": "delivered", "sent_at": "2025-07-28T18:05:22Z" } ],
  "payments":   []
}
```

### PATCH `/api/appointments/:id`

Partial update. RBAC guards enforced.

```json
{ "status": "IN_PROGRESS", "tech_id": "...", "total_amount": 256.65 }
```

**200** → updated appointment

### PATCH `/api/appointments/:id/status`

Shortcut for status only.

```json
{ "status": "READY" }
```

### DELETE `/api/appointments/:id`

Soft delete. **204**

---

## 3. Status Board

### GET `/api/admin/appointments/board?from&to&techId`

**200**

```json
{
  "columns": [
    { "key": "SCHEDULED", "title": "Scheduled", "count": 8, "sum": 1620.5 },
    { "key": "IN_PROGRESS", "title": "In Progress", "count": 3, "sum": 945.25 },
    { "key": "READY", "title": "Ready", "count": 2, "sum": 712.1 },
    { "key": "COMPLETED", "title": "Completed", "count": 11, "sum": 5240 }
  ],
  "cards": [
    {
      "id": "APT-1201",
      "status": "SCHEDULED",
      "position": 1,
      "start": "2025-07-29T17:00:00Z",
      "end": "2025-07-29T18:00:00Z",
      "customerName": "Noah Bell",
      "vehicle": "2019 Honda HR-V",
      "servicesSummary": "Brake pads (front)",
      "price": 256.65,
      "tags": ["New Client"]
    }
  ]
}
```

### PATCH `/api/admin/appointments/:id/move`

Move an appointment card to a new status and position on the admin board.

**Request**
```http
PATCH /api/admin/appointments/APT-1201/move
Content-Type: application/json

{
  "status": "IN_PROGRESS",   // New status (AppointmentStatus)
  "position": 2               // New position within the column
}
```

**Response 200**
```json
{
  "data": {
    "id": "APT-1201",
    "status": "IN_PROGRESS",
    "position": 2
  },
  "errors": null,
  "meta": { "request_id": "<uuid>" }
}
```

**Error Responses**

- **400 Invalid Transition** (code `INVALID_TRANSITION`)

```json
{
  "data": null,
  "errors": [
    {
      "status": "400",
      "code": "INVALID_TRANSITION",
      "detail": "Invalid transition SCHEDULED → COMPLETED"
    }
  ],
  "meta": { "request_id": "<uuid>" }
}
```

- **429 Rate Limited** (code `RATE_LIMITED`)

```json
{
  "data": null,
  "errors": [
    {
      "status": "429",
      "code": "RATE_LIMITED",
      "detail": "Rate limit exceeded"
    }
  ],
  "meta": { "request_id": "<uuid>" }
}
```

- **500 Server Error** (code `PROVIDER_ERROR`)

```json
{
  "data": null,
  "errors": [
    {
      "status": "500",
      "code": "PROVIDER_ERROR",
      "detail": "Could not move appointment"
    }
  ],
  "meta": { "request_id": "<uuid>" }
}
```

---

## 4. Services (S2)

> **Flag:** `ff.messaging` not required. Services are always on from S2.

### GET `/api/appointments/:id/services`

**200** → list of `appointment_services`

### POST `/api/appointments/:id/services`

```json
{ "name": "Front brake pad replacement", "estimated_hours": 1.5, "estimated_price": 180 }
```

**201** → created service row

### PATCH `/api/appointments/:id/services/:serviceId`

Partial update.

### DELETE `/api/appointments/:id/services/:serviceId`

**204**

**Server recomputes** `appointments.total_amount` from services if provided, or client may send explicit totals — decide per UX (document in `FRONTEND.md`).

---

## 5. Messaging (S2)

> **Flag:** `ff.messaging` must be enabled. TCPA compliance required.

### GET `/api/appointments/:id/messages`

Returns latest messages first (paginate with `cursor`).

### POST `/api/appointments/:id/messages`

Headers: optional `Idempotency-Key`

```json
{ "channel": "sms", "body": "Your vehicle is ready for pickup." }
```

**201** → `status: "sending"` message

**Errors**

* `RBAC_FORBIDDEN` for roles
* `VALIDATION_FAILED` for missing consent or quiet hours

### POST `/api/webhooks/messaging`

Provider → system (HMAC signed).

```json
{ "provider": "twilio", "message_id": "...", "status": "delivered", "error_code": null }
```

**200**. Server updates `messages.status` and stores `provider_id`, `error_code`.

**STOP handling**
Inbound `body` equals `STOP` → set `customers.sms_consent_status = 'denied'`, insert auto reply, audit log.

---

## 6. Payments (S3)

> **Flag:** `ff.payments` must be enabled. Payments are immutable; void via separate action later if needed.

### GET `/api/appointments/:id/payments`

List of payments (newest first).

### POST `/api/appointments/:id/payments`

Headers: optional `Idempotency-Key`

```json
{ "amount": 256.65, "method": "cash", "note": "Paid in full" }
```

**201** → payment row; server recalculates `paid_amount` and returns updated `appointment` or the payment.

**Response**

```json
{ "id": "PAY-991", "amount": 256.65, "method": "cash", "created_at": "2025-07-29T18:35:10Z" }
```

---

## 7. Inspections (S3, lite)

> **Flag:** `ff.inspections` must be enabled.

### GET `/api/appointments/:id/checklists`

### POST `/api/appointments/:id/checklists`

```json
{ "title": "Vehicle Check‑in" }
```

**201** → checklist

### POST `/api/checklists/:id/items`

```json
{ "label": "Headlights", "status": "pass", "notes": "" }
```

### PATCH `/api/checklists/:id/items/:itemId`

Partial update.

---

## 8. Dashboard & Widgets

### GET `/api/admin/dashboard/stats?from&to`

**200**

```json
{
  "jobsToday": 6,
  "carsOnPremises": 4,
  "scheduled": 12,
  "inProgress": 5,
  "ready": 3,
  "completed": 18,
  "noShow": 2,
  "unpaidTotal": 1298.40
}
```

Caching: **5‑minute** TTL with invalidation on status, payments, or services mutations.

### GET `/api/admin/cars-on-premises`

```
WHERE check_in_at IS NOT NULL AND check_out_at IS NULL
```

---

## 9. Customers

### GET `/api/customers/:id`

Basic profile.

### GET `/api/customers/:id/history`

**200**

```json
{
  "lastAppointments": [ { "id": "APT-1", "status": "COMPLETED", "total_amount": 420.00, "start": "2025-05-20T16:00:00Z" } ],
  "lifetimeSpend": 2135.50,
  "lastContactAt": "2025-07-10T21:02:00Z"
}
```

---

## 10. Exports (S2)

### GET `/api/exports/appointments.csv?from&to&status`

CSV with header: `id,customer,vehicle,start,status,total_amount,paid_amount`

### GET `/api/exports/payments.csv?from&to`

CSV with header: `id,appointment_id,amount,method,created_at`

**RBAC:** Owner/Advisor/Accountant only. Rate limited.

---

## 11. Health & Info

### GET `/healthz`

Process up.

### GET `/readyz`

DB reachable and migrations applied.

### GET `/version`

```json
{ "version": "2025.07.25+sha.abcdef" }
```

---

## 12. RBAC Matrix (summary)

| Capability          | Owner | Advisor |        Tech       | Accountant |
| ------------------- | :---: | :-----: | :---------------: | :--------: |
| View calendar/board |   ✅   |    ✅    |         ✅         |      ➖     |
| Move status         |   ✅   |    ✅    | ✅ *(no COMPLETE)* |      ➖     |
| Record payment      |   ✅   |    ✅    |         ➖         |      ✅     |
| Void payment        |   ✅   |    ➖    |         ➖         |      ✅     |
| Send SMS/email      |   ✅   |    ✅    |         ➖         |      ➖     |
| Edit services       |   ✅   |    ✅    |  ✅ *(notes only)* |      ➖     |
| Export CSV          |   ✅   |    ✅    |         ➖         |      ✅     |
| Manage users/roles  |   ✅   |    ➖    |         ➖         |      ➖     |

---

## 13. Example cURL

### Board

```sh
curl -s "${BASE}/api/admin/appointments/board?from=2025-07-28&to=2025-08-03" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Move card

```sh
curl -s -X PATCH "${BASE}/api/admin/appointments/abc-123/move" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"READY","position":3}' | jq
```

### Drawer

```sh
curl -s "${BASE}/api/appointments/abc-123" -H "Authorization: Bearer $TOKEN" | jq
```

### Send message (S2)

```sh
curl -s -X POST "${BASE}/api/appointments/abc-123/messages" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 9b3c2e4e-...' \
  -d '{"channel":"sms","body":"Your vehicle is ready for pickup."}' | jq
```

### Record payment (S3)

```sh
curl -s -X POST "${BASE}/api/appointments/abc-123/payments" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: a1c5...' \
  -d '{"amount":256.65,"method":"cash"}' | jq
```

---

## 14. Open decisions

1. Drawer payload size limits — cap list sizes vs. eager full payload? (current: eager with small caps).
2. Totals recompute rule — server‑driven from services vs. client‑submitted explicit totals.
3. SSE/WebSocket for live updates — optional; polling acceptable for V1.
4. Multi‑tenant: enable `shop_id` + RLS now or defer?

---

**End.** Matches `SCHEMA.md` and `ARCHITECTURE.md`. Implement S1 endpoints first; gate S2/S3 with flags.
