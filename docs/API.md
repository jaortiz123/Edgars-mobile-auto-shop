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

### GET `/api/appointments` *(mobile list view)*

Used by the mobile surface and consumer apps. Requires `X-Tenant-Id` header that resolves to a tenant the caller may access.

_Query params:_ `page` (default 1), `pageSize` (default 20, **max 100**), `status`, `from`, `to`, `customerId`

**Behavior Notes**

* `status` is case-insensitive but must map to one of `SCHEDULED`, `IN_PROGRESS`, `READY`, `COMPLETED`, `NO_SHOW`, `CANCELED`.
* `from` / `to` accept ISO-8601 dates or datetimes; all timestamps are normalized to UTC and serialized with a `Z` suffix.
* `totalAmountCents` is always an integer (money stored in cents, rounded half-up).
* Results are deterministic: sorted by `startAt` ascending (nulls last), then `createdAt` descending, then `id`.

**Response 200**

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "apt-123",
        "status": "SCHEDULED",
        "title": "Brake pads",
        "startAt": "2025-07-29T17:00:00Z",
        "endAt": "2025-07-29T18:00:00Z",
        "customerName": "Noah Bell",
        "vehicleLabel": "2019 Honda HR-V",
        "totalAmountCents": 25665
      }
    ],
    "page": 1,
    "pageSize": 20,
    "nextCursor": null
  },
  "meta": {
    "request_id": "req_01h9v1..."
  }
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

## 2.1 Services Management

### GET `/api/appointments/:id/services`

Returns all services for an appointment.

**200**
```json
{
  "services": [
    {
      "id": "svc-1",
      "appointment_id": "apt-123",
      "name": "Front brake pad replacement",
      "notes": "OEM preferred",
      "estimated_hours": 1.5,
      "estimated_price": 180.00,
      "category": "Brakes",
      "created_at": "2025-07-28T10:00:00Z"
    }
  ]
}
```

### POST `/api/appointments/:id/services`

Creates a new service for the appointment.

**Request:**
```json
{
  "name": "Brake Fluid Check",
  "notes": "Check brake fluid level and condition",
  "estimated_hours": 0.25,
  "estimated_price": 25.00,
  "category": "Maintenance"
}
```

**201**
```json
{
  "service": {
    "id": "svc-2",
    "appointment_id": "apt-123",
    "name": "Brake Fluid Check",
    "notes": "Check brake fluid level and condition",
    "estimated_hours": 0.25,
    "estimated_price": 25.00,
    "category": "Maintenance",
    "created_at": "2025-07-28T10:15:00Z"
  },
  "appointment_total": 205.00
}
```

### PATCH `/api/appointments/:id/services/:serviceId`

Updates an existing service.

**Request:**
```json
{
  "name": "Brake Fluid Replacement",
  "estimated_price": 45.00
}
```

**200**
```json
{
  "service": {
    "id": "svc-2",
    "appointment_id": "apt-123",
    "name": "Brake Fluid Replacement",
    "notes": "Check brake fluid level and condition",
    "estimated_hours": 0.25,
    "estimated_price": 45.00,
    "category": "Maintenance",
    "created_at": "2025-07-28T10:15:00Z"
  },
  "appointment_total": 225.00
}
```

### DELETE `/api/appointments/:id/services/:serviceId`

Deletes a service from the appointment.

**204**
```json
{
  "message": "Service deleted successfully",
  "appointment_total": 180.00
}
```

**curl examples:**
```bash
# List services
curl -X GET "http://localhost:3001/api/appointments/45/services"

# Create service
curl -X POST "http://localhost:3001/api/appointments/45/services" \
  -H "Content-Type: application/json" \
  -d '{"name": "Oil Change", "estimated_price": 75.00}'

# Update service
curl -X PATCH "http://localhost:3001/api/appointments/45/services/svc-1" \
  -H "Content-Type: application/json" \
  -d '{"estimated_price": 85.00}'

# Delete service
curl -X DELETE "http://localhost:3001/api/appointments/45/services/svc-1"
```

---

## 3. Admin Appointments

### GET `/api/admin/appointments`

Returns a paginated list of appointments with comprehensive filtering support.

**Query Parameters:**
- `status` (string) - Filter by appointment status (scheduled, in_progress, ready, completed, cancelled)
- `from` (string) - Filter appointments starting after this ISO date (e.g., '2023-12-01T10:00:00Z')
- `to` (string) - Filter appointments ending before this ISO date (e.g., '2023-12-01T18:00:00Z')
- `techId` (string) - Filter by technician ID
- `q` (string) - Text search across customer name, vehicle make/model, email, and phone
- `limit` (integer) - Number of results per page (1-200, default: 50)
- `offset` (integer) - Pagination offset (≥0, default: 0)
- `cursor` (string) - Cursor-based pagination (cannot be used with offset)

**Response 200**
```json
{
  "data": {
    "appointments": [
      {
        "id": "apt-123",
        "status": "SCHEDULED",
        "start_ts": "2025-07-29T17:00:00Z",
        "end_ts": "2025-07-29T18:00:00Z",
        "total_amount": 256.65,
        "customer_name": "Noah Bell",
        "vehicle_label": "2019 Honda HR-V"
      }
    ],
    "nextCursor": "eyJpZCI6..."
  },
  "errors": null,
  "meta": { "request_id": "<uuid>" }
}
```

**Error Responses:**
- **400 Bad Request** - Invalid parameters (limit out of range, invalid date format, cursor+offset conflict)

```json
{
  "message": "limit must be between 1 and 200"
}
```

**curl sample:**
```bash
# Get appointments with filters
curl -X GET "http://localhost:3001/api/admin/appointments?status=scheduled&from=2023-01-01T00:00:00Z&limit=10" \
  -H "Content-Type: application/json"
```

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

## 5. Messaging (T-021)

**Role-based access:** Owner & Advisor can read/write, Tech can read only.

### GET `/api/appointments/:id/messages`

Returns all messages for an appointment, ordered by sent_at DESC (latest first).

**Response 200**

```json
{
  "data": {
    "messages": [
      {
        "id": "msg-uuid-1",
        "appointment_id": "123",
        "channel": "sms",
        "direction": "out",
        "body": "Your vehicle is ready for pickup.",
        "status": "delivered",
        "sent_at": "2025-07-29T14:30:00Z"
      },
      {
        "id": "msg-uuid-2",
        "appointment_id": "123",
        "channel": "sms",
        "direction": "in",
        "body": "Thank you!",
        "status": "delivered",
        "sent_at": "2025-07-29T14:35:00Z"
      }
    ]
  },
  "errors": null,
  "meta": { "request_id": "<uuid>" }
}
```

**Error Responses**

* **403 Forbidden** - Authentication required or invalid role
* **404 Not Found** - Appointment not found

### POST `/api/appointments/:id/messages`

Create a new outbound message for an appointment.

**Request**

```json
{
  "channel": "sms",
  "body": "Your estimate is ready. Please call to approve."
}
```

**Response 201**

```json
{
  "data": {
    "id": "msg-uuid-new",
    "status": "sending"
  },
  "errors": null,
  "meta": { "request_id": "<uuid>" }
}
```

**Error Responses**

* **400 Bad Request** - Invalid channel or empty body
* **403 Forbidden** - Only Owner & Advisor can send messages

### PATCH `/api/appointments/:id/messages/:message_id`

Update message delivery status (typically from webhook or manual retry).

**Request**

```json
{
  "status": "delivered"
}
```

**Response 200**

```json
{
  "data": {
    "id": "msg-uuid-1"
  },
  "errors": null,
  "meta": { "request_id": "<uuid>" }
}
```

**Error Responses**

* **400 Bad Request** - Invalid status value
* **403 Forbidden** - Only Owner & Advisor can update messages
* **404 Not Found** - Message not found

### DELETE `/api/appointments/:id/messages/:message_id`

Delete a message from an appointment.

**Response 204** - No content

**Error Responses**

* **403 Forbidden** - Only Owner & Advisor can delete messages
* **404 Not Found** - Message not found

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

Get customer's appointment and payment history. Returns past appointments (COMPLETED, NO_SHOW, CANCELED) with nested payment information.

**RBAC:** Owner & Advisor only

**Response 200**

```json
{
  "data": {
    "data": {
      "pastAppointments": [
        {
          "id": "APT-1",
          "status": "COMPLETED",
          "start": "2025-05-20T16:00:00Z",
          "total_amount": 420.00,
          "paid_amount": 420.00,
          "created_at": "2025-05-18T10:00:00Z",
          "payments": [
            {
              "id": "PAY-1",
              "amount": 420.00,
              "method": "cash",
              "created_at": "2025-05-20T16:30:00Z"
            }
          ]
        },
        {
          "id": "APT-2",
          "status": "NO_SHOW",
          "start": "2025-04-15T14:00:00Z",
          "total_amount": 180.00,
          "paid_amount": 0.00,
          "created_at": "2025-04-10T09:00:00Z",
          "payments": []
        }
      ],
      "payments": []
    },
    "errors": null
  },
  "errors": null,
  "meta": { "request_id": "<uuid>" }
}
```

**Error Responses**

* **403 Forbidden** - Only Owner & Advisor can view customer history
* **404 Not Found** - Customer not found

**Notes:**
- Only returns past appointments (COMPLETED, NO_SHOW, CANCELED status)
- Appointments ordered by start date descending (most recent first)
- Payments nested within each appointment
- Used by History tab in AppointmentDrawer (T-023)

---

## 10. CSV Export Reports (T-024)

### GET `/api/admin/reports/appointments.csv`

Export appointments data in CSV format for accounting integration.

**Query Parameters:**
- `from` (optional): ISO 8601 date string (YYYY-MM-DD) for start date filter
- `to` (optional): ISO 8601 date string (YYYY-MM-DD) for end date filter
- `status` (optional): Appointment status filter (SCHEDULED, IN_PROGRESS, READY, COMPLETED, NO_SHOW, CANCELED)

**Response:**
- Content-Type: `text/csv; charset=utf-8`
- Content-Disposition: `attachment; filename=appointments_export.csv`

**CSV Headers:**
```
ID,Status,Start,End,Total Amount,Paid Amount,Customer Name,Customer Email,Customer Phone,Vehicle Year,Vehicle Make,Vehicle Model,Vehicle VIN,Services
```

**Example:**
```
GET /api/admin/reports/appointments.csv?from=2024-01-01&to=2024-01-31&status=COMPLETED
```

### GET `/api/admin/reports/payments.csv`

Export payment records in CSV format for accounting integration.

**Query Parameters:**
- `from` (optional): ISO 8601 date string (YYYY-MM-DD) for start date filter
- `to` (optional): ISO 8601 date string (YYYY-MM-DD) for end date filter

**Response:**
- Content-Type: `text/csv; charset=utf-8`
- Content-Disposition: `attachment; filename=payments_export.csv`

**CSV Headers:**
```
ID,Appointment ID,Amount,Payment Method,Transaction ID,Payment Date,Status
```

**Example:**
```
GET /api/admin/reports/payments.csv?from=2024-01-01&to=2024-01-31
```

**Authentication & Authorization:**
- **RBAC:** Owner, Advisor, and Accountant roles only
- **Rate Limiting:** 5 exports per user per hour
- **Audit Logging:** All export activities are logged

**Error Responses:**
- `400 Bad Request`: Invalid date format or status value
- `403 Forbidden`: Insufficient permissions or authentication required
- `429 Too Many Requests`: Rate limit exceeded
- `503 Service Unavailable`: Database unavailable

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
