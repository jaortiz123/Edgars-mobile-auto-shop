# Mobile Appointments — List Endpoint

**Endpoint**: `GET /api/appointments`

**Audience**: iOS / mobile clients requesting a paginated list of appointments for the active tenant.

**Headers**

- `Authorization: Bearer <jwt>` (Owner, Advisor, Tech, or Accountant) — required
- `X-Tenant-Id: <uuid>` — required, must resolve to a tenant the caller may access
- `Accept: application/json`

> ⚠️ Requests missing `X-Tenant-Id` receive `403 missing_tenant`.

## Query Parameters

| Name | Type | Default | Notes |
| --- | --- | --- | --- |
| `page` | integer | 1 | 1-indexed page number. Ignored if `cursor` provided. |
| `pageSize` | integer | 20 | Must be between 1 and 100 inclusive. Values >100 clamp to 100. |
| `cursor` | string | – | Opaque cursor returned from previous response. Mutually exclusive with `page`. |
| `status` | string | – | Optional filter. Case-insensitive but must map to `SCHEDULED`, `IN_PROGRESS`, `READY`, `COMPLETED`, `NO_SHOW`, or `CANCELED`. |
| `from` / `to` | ISO-8601 timestamp | – | Optional start/end filters. Accepted as date or datetime. Coerced to UTC on input. |
| `customerId` | string | – | Optional tenant-scoped customer identifier. |

## Response

```jsonc
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "apt-001",
        "status": "SCHEDULED",
        "title": "Brake pads",
        "startAt": "2025-07-29T17:00:00Z",   // always UTC with Z suffix
        "endAt": "2025-07-29T18:00:00Z",    // null when not scheduled
        "customerName": "Noah Bell",
        "vehicleLabel": "2019 Honda HR-V",
        "totalAmountCents": 25665            // integer cents (no floats)
      }
    ],
    "page": 1,
    "pageSize": 20,
    "nextCursor": null
  },
  "meta": {
    "request_id": "req_01j4y9yynwg929309a7gxp9tz3"
  }
}
```

### Invariants (Enforced by Service & Tests)

- **Clamp**: `pageSize` > 100 returns a payload with `pageSize == 100` and `len(items) == 100`.
- **Deterministic order**: Without concurrent mutations, multiple calls with identical query parameters return the same ordered list. Sort precedence:
  1. `startAt` ascending (nulls last)
  2. `createdAt` descending
  3. `id` ascending
- **Money is cents**: `totalAmountCents` is an integer (Python `int`). All calculations use banker’s rounding on cents.
- **Timestamps**: `startAt` / `endAt` normalized to UTC with a trailing `Z`. `null` allowed.
- **Tenant isolation**: Tenant ID is resolved upstream via middleware; service verifies membership before issuing queries.

### Error Model

Standard `_error` JSON envelope (see `API.md`).

| HTTP Status | Code | Description |
| --- | --- | --- |
| 400 | `bad_request` | Invalid query parameter (e.g., negative `page`, invalid status). |
| 401 | `auth_required` | Missing/invalid JWT. |
| 403 | `missing_tenant` | Missing `X-Tenant-Id` header. |
| 422 | `validation_failed` | Service-level validation failure (future use). |

## CORS & Board Parity Guardrails

- Preflight `OPTIONS /api/admin/appointments/board` must continue to return `204` with headers:
  - `Access-Control-Allow-Origin: <Origin header>`
  - `Access-Control-Allow-Methods` includes `GET`
- Board response remains the raw payload (`{"columns": ..., "cards": ...}`) without the `_ok` envelope. Unit tests enforce this.

## Testing

`pytest backend/tests/test_mobile_appointments_api.py`

Covers clamp, determinism, money shape, UTC suffix, and CORS/board parity regression.
