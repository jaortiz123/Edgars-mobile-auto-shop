# Sprint 2 – T8 Frontend Integration Contracts (Dev Hand‑off)

This doc is the **single source of truth** for frontend ↔ backend Status Board integration. It encodes the validated API contracts, error semantics, performance expectations, and reference client patterns produced in Sprint 2 (T7/T8).

---

## 1) Environments & Auth

* **Base URL (dev):** `https://onourabnw45tm2rrq72gegkgai0codqj.lambda-url.us-west-2.on.aws`
* **Auth modes**

  * **Open**: Function URL `AuthType=NONE` (default for local/integration).
  * **IAM** (toggleable): Requests must be **SigV4** signed. The client should accept an optional `signer` and add headers when enabled.
* **CORS**: `AllowOrigins=['*']`, `AllowMethods=['*']`, `AllowHeaders=['*']` (confirmed in T4).

> **Client note**: Build the API client to work in both modes. Expose `withAuth: boolean` or auto‑detect via a 403 from Function URL and retry with signed request (if signer provided).

---

## 2) Core Endpoints & Schemas

### 2.1 Status Board (read)

**GET** `/api/admin/appointments/board?date=YYYY-MM-DD`

* **200 OK**

```json
{
  "ok": true,
  "data": {
    "date": "2025-09-20",
    "columns": {
      "scheduled": { "items": [ {"id": 2, "status": "scheduled", "version": 1, "appt_start": "2025-09-20T15:00:00Z", "appt_end": "2025-09-20T16:00:00Z", "customer": {"id":1,"name":"John Doe","phone":"555-123-4567"}, "vehicle": {"id":1,"year":2020,"make":"Honda","model":"Civic","license_plate":"ABC123"} } ] },
      "in_progress": { "items": [ /* same card shape */ ] },
      "ready": { "items": [ /* ... */ ] },
      "completed": { "items": [ /* ... */ ] },
      "no_show": { "items": [ /* ... */ ] }
    }
  }
}
```

* **Notes**

  * Cards **always** include `id`, `status`, `version`, `appt_start`, `appt_end`, and embedded `customer` + `vehicle` summaries.
  * Empty columns return `items: []`.

### 2.2 Move Card (write)

**POST** `/api/admin/appointments/{id}/move`

**Request (JSON)**

```json
{
  "new_status": "in_progress|ready|completed|scheduled|no_show",
  "position": 0,
  "expected_version": 3
}
```

**Responses**

* **200 OK**

```json
{ "ok": true, "data": { "id": 2, "status": "in_progress", "version": 4 } }
```

* **409 Conflict (optimistic concurrency)**

```json
{ "ok": false, "error": { "code": "version_conflict", "message": "stale version 3 (current=4)", "current": 4 } }
```

* **400 Bad Request (invalid transition)**

```json
{ "ok": false, "error": { "code": "invalid_transition", "message": "scheduled → completed not allowed" } }
```

**Behavioral rules**

* Moving **into** `in_progress` auto‑sets `check_in_at` (server‑side).
* `position` is optional; when omitted, server appends to end of column.

### 2.3 Dashboard Stats (read)

**GET** `/api/admin/dashboard/stats?date=YYYY-MM-DD`

**200 OK**

```json
{
  "ok": true,
  "data": {
    "date": "2025-09-20",
    "jobsToday": 3,
    "onPrem": 1,
    "statusCounts": {"scheduled": 2, "in_progress": 0, "ready": 1, "completed": 0, "no_show": 0}
  }
}
```

> **Optional**: some builds also accept `from`/`to` ranges; treat as non‑required.

### 2.4 Services (seed helper)

* **POST** `/api/admin/services` (create)
* **GET** `/api/admin/services` (list)

List returns:

```json
{ "ok": true, "data": { "items": [ {"id":1,"code":"OIL001","name":"Oil Change","base_price":59.99,"estimated_duration_minutes":30 } ], "total": 1 } }
```

---

## 3) Performance Contracts (from T7)

* **Board**: `p95 ≤ 800ms` (observed \~385ms under 20 VUs / 60s)
* **Stats**: `p95 ≤ 500ms` (observed \~411ms)
* **Move**: `p95 ≤ 400ms` (validated manually; add in‑app metric capture)
* **Error rate**: `< 0.5%` target; transient 429/5xx should have client retries.

**Client timeouts**

* `GET` Board: **2.5s**
* `GET` Stats: **1.5s**
* `POST` Move: **2.0s**

---

## 4) Client Integration Patterns

### 4.1 API Client (shape)

* Base options: `{ baseUrl, withAuth?, signer?, timeouts }`
* Methods: `getBoard(date)`, `move(id, {new_status, position, expected_version})`, `getStats(date)`
* All methods return `{ ok: boolean, data?: T, error?: ApiError }`
* Attach `x-correlation-id` per request (random UUID) to aid tracing.

### 4.2 Optimistic UI Flow (Move)

1. **Preconditions**: Read card `{id, status, version}`.
2. **Optimistic update**: Move the card locally to `target` column; bump local `version++`.
3. **Fire request**: `POST /move` with `expected_version = previousVersion`.
4. **On 200**: Keep local state; sync returned `version`.
5. **On 409**: **Rollback** optimistic change, `refetchBoard(date)`, show inline toast: *"Board updated by someone else. Your view was refreshed."*
6. **On 400**: Rollback and surface friendly error: *"That move isn't allowed."*

### 4.3 Refetch Strategy & Polling

* **Stale‑while‑revalidate**: Render cached state instantly; refetch in background.
* **Polling**: Default **30s**; pause when browser tab hidden.
* **Manual refetch**: Expose `refreshBoard()` for toolbar action.

### 4.4 Error Handling Matrix

| Failure            | Code                     | UX Action                                         |
| ------------------ | ------------------------ | ------------------------------------------------- |
| Version conflict   | 409 `version_conflict`   | Rollback, refetch, toast                          |
| Invalid transition | 400 `invalid_transition` | Rollback, inline error                            |
| Rate limited       | 429                      | Exponential backoff (200, 400, 800ms…) up to 3x   |
| Server error       | 5xx                      | Retry 1–2x, then surface error banner             |
| Network timeout    | —                        | Show *"Connection problem"* snackbar; allow Retry |

---

## 5) TypeScript Primitives (contract highlights)

```ts
export type BoardStatus = 'scheduled' | 'in_progress' | 'ready' | 'completed' | 'no_show';

export interface BoardCardCustomer { id: number; name: string; phone?: string; }
export interface BoardCardVehicle { id: number; year?: number; make?: string; model?: string; license_plate?: string; }

export interface BoardCard {
  id: number;
  status: BoardStatus;
  version: number;
  appt_start: string; // ISO8601
  appt_end: string;   // ISO8601
  customer: BoardCardCustomer;
  vehicle: BoardCardVehicle;
}

export interface BoardResponse {
  ok: true;
  data: { date: string; columns: Record<BoardStatus, { items: BoardCard[] }>; };
}

export interface MoveRequest { new_status: BoardStatus; position?: number; expected_version: number; }
export type MoveSuccess = { ok: true; data: { id: number; status: BoardStatus; version: number } };
export type ApiError = { ok: false; error: { code: string; message: string; [k: string]: unknown } };
```

> Full `api.ts` and `statusBoardClient.ts` are in the repo; this section is a contract snapshot for quick reference.

---

## 6) Instrumentation (frontend)

Emit lightweight client metrics to the console (or a metrics endpoint if available):

* `board.fetch.duration_ms`
* `move.duration_ms` + `move.result` (`ok|conflict|invalid|error`)
* `stats.fetch.duration_ms`

These pair with CloudWatch alarms set in T3.

---

## 7) Example Usage (React)

```tsx
const client = createStatusBoardClient({ baseUrl, withAuth: false });
const { board, loading, moveAppointment, refreshBoard } = useStatusBoard({ client, enablePolling: true, pollingInterval: 30000 });

// Move example
await moveAppointment(card.id, { new_status: 'in_progress', position: 0, expected_version: card.version });
```

---

## 8) Edge Cases & Notes

* Board **date** is required; default to `today` in UI with a date picker.
* Expect occasional `null`/`[]` in optional fields; guard renders.
* When IAM is enabled, **preflight test** the signed health check before switching UI to authenticated mode.
* Rate limiting may return **429**; clients must retry with backoff.

---

## 9) Hand‑off Checklist

* [ ] Wire `statusBoardClient` into Admin Appointments page.
* [ ] Render board with 5 columns; empty states for each.
* [ ] Implement drag‑drop → `move()` optimistic flow with rollback.
* [ ] Poll every **30s** while visible; manual refresh button available.
* [ ] Add toast messages for 409/400/5xx per Error Matrix.
* [ ] Log client perf metrics to help validate SLOs in real sessions.

**Contact**: Post questions in the `#status-board` thread; include `x-correlation-id` from network tab when reporting issues.
