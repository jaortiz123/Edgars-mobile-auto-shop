# Manual Security Review — Section 3

Scope: Final manual review for Section 3 of the Security & Data Isolation Audit. Focused first on 3.1 Cross‑Tenant Isolation and 3.2 Injection.

Reviewed commit: main (post hardening sprint)

---

## 3) Manual Review Checklists (✅/❌ + notes)

### 3.1 Cross‑Tenant Isolation

- ✅ All CRUD queries tenant‑scoped (or equivalent): Isolation enforced at the DB via RLS policies; application sets session tenant context before queries.
  - Evidence: RLS policies on tenant tables (e.g., `customers`, `vehicles`, `appointments`) — `backend/migrations/003_rls_enable.sql` (policies use `tenant_id = current_tenant_id()`); production cutover bundles reinforce `USING (tenant_id::text = current_setting('app.tenant_id', true))`.
  - Evidence: App sets `app.tenant_id` prior to queries — `backend/local_server.py` around invoices list: `cur.execute("SELECT set_config('app.tenant_id', %s, true)", (tenant_id,))` (near lines ~2945–2965).
  - Evidence: Verification scripts assert no data without context and cross‑tenant denial — `verify-rls-production.sh` (Tests 4–6).

- ✅ Tenant ID derived from server‑trusted context, not client payload: `X‑Tenant‑Id` is resolved to a canonical UUID via DB and membership is enforced for authenticated users; test/E2E bypass is gated to CI only.
  - Evidence: `backend/local_server.py::_resolve_tenant_context` resolves header via `SELECT id FROM tenants ...` and checks `user_tenant_memberships`/`staff_tenant_memberships`; E2E bypass only when `APP_INSTANCE_ID == 'ci'` and test accounts (lines ~1160–1510).

- ❌ Resource IDs are UUIDs (to lower IDOR risk): Not all primary keys are UUID; core entities like customers/vehicles/appointments use integer IDs in schema and FKs.
  - Evidence: `docs/backend/sql.md` shows integer FKs (e.g., `customer_id INTEGER`, `vehicle_id INTEGER`), and application code works with integer IDs in multiple endpoints.
  - Note: RLS significantly mitigates IDOR by denying cross‑tenant reads/writes even if IDs are guessable; consider opaque IDs for external exposure over time.

- ✅ Ownership re‑verified on every mutation/read: Membership checks run per request and RLS re‑enforces row ownership on all reads/updates/deletes.
  - Evidence: `backend/local_server.py::_resolve_tenant_context` enforces membership; updates/selects rely on RLS (e.g., PATCH customers/vehicles build parameterized UPDATEs and RLS limits rows).

### 3.2 Injection (SQL/NoSQL/Command)

- ✅ All SQL calls use bound parameters; no unsafe string concatenation for values.
  - Evidence: Customers PATCH builds `SET` list but binds values with `%s` — `backend/local_server.py` (~2006–2068) then `cur.execute(sql_query, sql_params)`.
  - Evidence: Vehicles PATCH similarly uses a f‑string for column list from a server allow‑list, with all values `%s`‑bound — `backend/local_server.py` (~2570–2610).
  - Evidence: Invoices list composes SQL safely via `psycopg2.sql` and binds params — `backend/local_server.py` (~2940–2980).
  - Evidence: Vehicle profile queries build WHERE from fixed tokens and bind user inputs — `backend/vehicle_profile_repo.py` (query built from whitelisted clauses; `cur.execute(query, params + [...])`).

- ✅ ORM `text()` uses explicit placeholders only: N/A — project uses psycopg2 with `sql` composition; all dynamic parts are identifiers/clauses from allow‑lists and values are bound.

- ✅ File paths, shell calls, subprocess guarded by allow‑lists (no user input):
  - Evidence: `backend/run_server.py` invokes a fixed migration script via `subprocess.run` (no user‑supplied args); Lambda code opens fixed `init.sql` paths; no `shell=True` with user input paths.

---

### 3.3 XSS & Output Encoding

- ✅ No dangerous HTML injection in frontend source: no `dangerouslySetInnerHTML`; `innerHTML` usage only in tests; file exports use `URL.createObjectURL` for downloads (no HTML sinks).
  - Evidence: `frontend/src/components/admin/DataExport.tsx` (~224), `CalendarView.tsx` (~240), `ReportsDropdown.tsx` (~64) use `URL.createObjectURL`; multiple `innerHTML` references limited to tests under `frontend/src/tests/*`.
- ⚠️ Missing defensive headers at app layer: no CSP/X-Frame-Options/X-Content-Type-Options/Referrer-Policy set in Flask; recommend setting via ALB/reverse proxy or an `after_request` hook for defense-in-depth.
  - Evidence: search showed no `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` in backend.

### 3.5 Validation & Parsing

- ❌ No centralized schema validation: endpoints parse bodies with `request.get_json(...)` and ad hoc checks; no Pydantic/Marshmallow style validators found.
  - Evidence: many `get_json` occurrences in `backend/local_server.py` (e.g., lines ~1959, ~2383, ~2657, ~3394, ~3563, ~5170, etc.); no hits for `pydantic|marshmallow` in backend.
- ✅ Limited parsing surface (no file uploads); key flows include explicit checks (e.g., password strength in reset flow) and server-side allow-lists for SQL identifiers.
  - Evidence: `reset_password()` validates strength; dynamic SQL uses allow-lists and bound params.

### 3.4 CSRF & State Changes

- ✅ Double-submit CSRF for cookie-based auth writes: `/api/csrf-token` issues `XSRF-TOKEN` (SameSite=Lax, Secure in secure mode); `_csrf_protect` enforces `X-CSRF-Token` header or cookie when `__Host_access_token` is present; bypass only in CI.
  - Evidence: `backend/local_server.py:get_csrf_token()` (~11305+) sets cookie; `_csrf_protect` (~11330+) checks header/cookie and returns 403 when missing.
- ⚠️ CORS currently wide (`origins: "*"`) but `supports_credentials=False`, so cookies aren’t sent cross-site; recommend tightening allowed origins in production and enabling credentials only when required.
  - Evidence: `flask_cors.CORS` init (~480+) with wildcard origins; custom 204 OPTIONS responses respect `ALLOWED_ORIGINS` only when matching.

### 3.6 Secrets & Config

- ✅ Production secrets are externalized: DB credentials stored in AWS Secrets Manager and injected via env/ARN with least-privilege IAM; no production secrets committed.
  - Evidence: `infrastructure/main.tf` defines `aws_secretsmanager_secret` and passes `DB_SECRET_ARN` to Lambda/ECS; IAM policy grants `secretsmanager:GetSecretValue`.
- ⚠️ Dev/test defaults present (e.g., `JWT_SECRET=dev_secret`, hardcoded test secrets in test utilities). Ensure overrides for non-dev environments and consider failing fast if unset in prod.
  - Evidence: `backend/local_server.py` and `backend/app_factory.py` default secrets; `.env.ci` contains test values.

### 3.7 Logging & Error Handling

- ✅ Centralized error handling with stable client messages and CI-only detail exposure; request correlation via `X-Request-Id` enforced and echoed; structured logs include traceback server-side.
  - Evidence: `handle_unexpected_exception` (~4754+) logs traceback and conditionally includes details when CI/debug; `REQUEST_ID_HEADER = "X-Request-Id"` and headers echoed; e2e logs show `x-request-id` present.

Status: 3.3–3.7 reviewed and recorded. Open items: add security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy), tighten CORS origins for prod, and introduce schema-based request validation.
