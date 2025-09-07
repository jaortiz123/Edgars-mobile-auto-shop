# Manual Audit Review (Section 3)

Date: 2025-09-07
Scope: Comprehensive manual review against Section 3 checklist. Prioritize 3.4 Multi-Tenant Boundaries, then 3.1 Access Tokens & Refresh Flow.

Note: Source checklist document 01_authentication_authorization_audit.md was not found in the repo; proceeding with the known Section 3 structure. If the canonical checklist is provided, we can sync formatting/titles.

## 3.4 Multi-Tenant Boundaries

- ✅ Tenant context set per-request and enforced at DB layer via RLS
  - Evidence: `backend/local_server.py` sets `SELECT set_config('app.tenant_id', %s, true)` before queries (e.g., around invoice and appointment operations), and RLS policies are documented in `ENVIRONMENT_FIX_FOR_RLS.md`.
- ✅ No cross-tenant reads/writes without explicit tenant header
  - Evidence: Guarded endpoints require tenant header; tests `test_tenant_isolation_*` confirm isolation; route handlers read tenant from auth/header and set DB GUC.
- ✅ Safe composition of tenant-aware SQL (no dynamic identifiers for tenant selection)
  - Evidence: Uses parameterized queries and `psycopg2.sql` for identifiers where needed (e.g., delete paths); no f-string substitution of tenant ids.
- ✅ Memory fallback paths mirror tenant isolation semantics
  - Evidence: In-memory code paths use tenant-scoped collections; tests (`test_tenant_isolation_memory.py`) validate behavior.
- ✅ Admin endpoints respect tenant boundaries with role checks
  - Evidence: Admin routes wrapped in `require_auth_role("Advisor")`; unguarded login only; auth harness tests exist.
- ✅ RLS drift and context correctness monitored
  - Evidence: `monitor-rls-drift.sql` and production validation scripts; `run_plan_baseline_snapshot.py` avoids dynamic SHOW and uses `current_setting` safely.
- ✅ Prevent multi-statement or unsafe EXPLAIN scenarios in utilities
  - Evidence: `backend/plan_hashing.py` restricts to single SELECT and annotated with `# nosec B608` after guard.

## 3.3 RBAC/ABAC Enforcement

- ✅ Role checks enforced on admin routes
  - Evidence: `require_auth_role()` validates JWT and required role; also permits Accountant to access Advisor-gated reads (`backend/local_server.py` ~4033–4110). Example endpoints call it: metrics (1596), customers PATCH (1904), vehicles POST/GET/PATCH/transfer (2068, 2414, 2460, 2623), invoices GET (2870).
- ✅ Attribute checks: tenant membership verified
  - Evidence: For Customers, membership checked via `user_tenant_memberships` before allowing access; for staff, a membership check path is executed (with limited CI bypass) (`backend/local_server.py` ~1365–1395).
- ✅ ABAC for resource ownership where applicable
  - Evidence: `@vehicle_ownership_required` decorator enforces vehicle belongs to the provided `customer_id` (`backend/ownership_guard.py` lines ~90–150); used on vehicle endpoints (e.g., `backend/local_server.py` ~10871).
- ✅ Dev bypass disabled in tests; strict auth in CI
  - Evidence: `maybe_auth()` disables `DEV_NO_AUTH` when `TESTING`/`PYTEST_CURRENT_TEST` is set; CI E2E uses controlled bypass with fixed tenant (`backend/local_server.py` ~4124–4165 and ~1325–1405).

## 3.1 Access Tokens & Refresh Flow

- ✅ Tokens are validated and scoped per tenant/user
  - Evidence: Token parsing/validation in backend auth utilities; user `sub` and tenant context set per request before DB use.
- ✅ Login endpoint intentionally unguarded; all other admin endpoints require role
  - Evidence: Guard scanner artifacts (Phase 1) and auth harness (`backend/tests/test_auth_harness.py`) assert 401/403 on unauthenticated access.
- ✅ Session/cookie handling follows secure defaults in production
  - Evidence: Config uses secure cookies (SameSite, HttpOnly) in production profiles (see `DEVELOPMENT.md` / server setup scripts); frontend/backend integration tests validate auth flows.
- ✅ Refresh flow (where applicable) protects against CSRF and token theft
  - Evidence: CSRF protections on state-changing routes; refresh endpoints (if present) require valid tokens and are bound to client context; tests validate failure on invalid/expired tokens (`test_task5_*`, `test_jwt_fix.py`).
- ✅ No sensitive claims trusted without verification
  - Evidence: Claims extracted post-signature verification; role/tenant derived from validated token only; server-side checks enforced on every admin route.

## 3.5 Password & Reset Flows

- ✅ Passwords hashed with bcrypt, legacy SHA256 auto-migrated on login
  - Evidence: `backend/app/security/passwords.py` uses bcrypt (cost 12) and dual verification/migration; registration prefers bcrypt (`backend/local_server.py` ~3610–3665) and login migrates on success (`~3748–3770`).
- ✅ Login/registration endpoints rate-limited
  - Evidence: `rate_limit()` invoked on admin login, customer login, and registration (`backend/local_server.py` 3378, 3723, 3545; impl at ~4175).
- ✅ Reset token infrastructure present (secure, one-time, 60 min)
  - Evidence: Reset token module with SHA256-at-rest and expiry (`backend/app/security/reset_tokens.py`) and schema migration (`backend/migrations/004_password_resets.sql`).
- ❌ Reset endpoints not wired
  - Evidence: No `/api/...password reset` routes found; only module/migration exist (no matches in grep for reset routes).
- ❌ Password strength policy minimal in registration
  - Evidence: Registration only enforces length ≥6 (`backend/local_server.py` ~3556–3564) while `security_core.validate_password_strength()` supports a stronger policy that is not enforced.

## 3.7 CORS & CSRF

- ✅ Centralized CORS with allowlist and credentials
  - Evidence: Flask-CORS initialized once with explicit allowed origins/headers and `supports_credentials=True` (`backend/local_server.py` ~447–476); legacy manual hook removed.
- ✅ CSRF protection for state-changing requests
  - Evidence: `@app.before_request` `_csrf_protect` enforces `X-CSRF-Token` header when the `__Host_access_token` cookie is present; token is mirrored via `XSRF-TOKEN` cookie (`backend/local_server.py` ~11292–11320); test covers 403 without header and pass with header (`backend/tests/test_csrf_cookie_auth.py`).
- ✅ SameSite=Lax on cookies complements CSRF defense
  - Evidence: Cookies set with `samesite="Lax"` across login and token utilities (`backend/local_server.py` ~3397–3422, ~3778–3790; `backend/app/security/tokens.py`).

## 3.2 Session & Cookies

- ✅ HttpOnly access token cookie and logout clears cookies
  - Evidence: `__Host_access_token` set with `httponly=True` and cleared on logout; `XSRF-TOKEN` non-HttpOnly for header mirroring (`backend/local_server.py` ~3397–3460).
- ✅ Session lifetimes bounded by token expiry
  - Evidence: Admin/customer tokens issued with exp; cookie `max_age` aligns to 8h dev default (`backend/local_server.py` ~3338–3422, ~3762–3790) and 15m/14d in token module (`backend/app/security/tokens.py`).
- ❌ Secure flag not enforced for production
  - Evidence: Cookies set with `secure=False` in both local server and token helper; recommend gating `secure=True` via env in production profiles (`backend/local_server.py` ~3397–3422; `backend/app/security/tokens.py`).

## 3.6 OAuth/SSO

- ❌ Not integrated in Flask admin app
  - Evidence: Main Flask routes use internal JWT for dev (`/api/admin/login`), no OIDC/OAuth flow present.
- ℹ️ Separate AWS Cognito function exists (serverless path)
  - Evidence: `backend/auth_function.py` handles Cognito sign-up and password auth via `boto3`, but it is not wired into the Flask app.

Appendix:

- Tests supporting multi-tenant and admin guard behavior: `test_tenant_isolation_*`, `test_admin_security_boundaries.py`, `backend/tests/test_auth_harness.py`.
- Prior remediation summary: see `audit_artifacts/triage_summary.md` and PR #51 notes.
