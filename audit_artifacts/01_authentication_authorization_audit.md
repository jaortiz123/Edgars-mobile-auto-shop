# 🔐 Authentication & Authorization Audit

**Deliverable**: Save/export this document as `01-authentication-authorization-audit.md`

**Repo**: `<project_root>`
**Commit SHA**: `<fill>`
**Auditor**: `<your_name>`
**Date**: 2025‑09‑06

---

## 0) Objectives & Success Criteria
**Goal:** Eliminate auth brittleness and enforce correct permissions across every entry point.

**Done means:**
- All protected routes actually require auth; public routes are explicitly whitelisted.
- Role/permission checks are consistent and server‑enforced (not just UI‑gated).
- Sessions/tokens are short‑lived, rotated, revocable, and stored safely.
- Password/OAuth/reset flows are hardened (one‑time tokens, expiry, invalidation).
- Cross‑tenant access is impossible by design (no IDOR across tenants).
- Zero Critical/High issues from static scans; tests cover happy paths + abuse paths.

---

## 1) System Inventory & Discovery
Capture every auth touchpoint before judging quality.

### 1.1 Locate Auth‑Relevant Code
```bash
# Fast search (requires ripgrep). Fallback to grep shown below.
rg -n --hidden --no-ignore -S \
  -e '(auth|login|logout|signup|register|jwt|token|refresh|permission|role|rbac|oauth|sso|password|reset|forgot|magic|session)' \
  -g '!node_modules' -g '!*dist*' -g '!*.min.*'

# Fallback
find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) -print0 | \
  xargs -0 grep -nE '(auth|login|logout|signup|register|jwt|token|refresh|permission|role|rbac|oauth|sso|password|reset|forgot|magic|session)'
```
**Artifacts:**
- `audit_artifacts/inventory_auth_matches.txt` (full grep/rg output)

### 1.2 Endpoint Map (Fill this table)
| Endpoint | Method | Guard/Middleware | Required Role/Perm | Tenant Scoped? | Notes |
|---|---|---|---|---|---|
| `/api/auth/login` | POST | `auth.none` | public | N/A | rate‑limited? |
| `/api/...` | ... | ... | ... | ... | ... |

Save as: `audit_artifacts/endpoint_auth_matrix.csv`

---

## 2) Automated Scans
Static/dyn checks to surface misconfig quickly.

### 2.1 Python/Flask (if applicable)
```bash
# Security linters
pip install --upgrade bandit pip-audit safety
mkdir -p audit_artifacts
bandit -r backend -f json -o audit_artifacts/bandit_auth.json
pip-audit -r requirements.txt -f json > audit_artifacts/pip_audit.json || true
safety check --full-report > audit_artifacts/safety_auth.txt || true
```

### 2.2 Node/TS (if applicable)
```bash
npm audit --json > audit_artifacts/npm_audit.json || true
npx retire --outputformat json --outputpath audit_artifacts/retire.json || true
# Optional: static rules for auth/JWT
npx semgrep ci --config p/owasp-top-ten --config r/jwt --config r/flask \
  --json --output audit_artifacts/semgrep_auth.json || true
```

### 2.3 Secrets & Leaks (All stacks)
```bash
# Gitleaks
curl -sSL https://raw.githubusercontent.com/gitleaks/gitleaks/master/install.sh | bash
./gitleaks detect -v --report-format json --report-path audit_artifacts/gitleaks.json || true
```

**Pass/Fail bar:** No Critical/High findings unresolved.

---

## 3) Manual Review Checklists
Deep‑dive the things scanners miss. Mark ✅/❌ and add notes/evidence.

### 3.1 Access Tokens & Refresh Flow
- ☐ Access token expiry ≤ 15m; refresh ≤ 7–30d.
- ☐ Rotation on each use; stolen refresh ⇒ subsequent uses rejected.
- ☐ Logout revokes/blacklists tokens (server‑side store or versioned token IDs).
- ☐ Tokens bound to user‑agent/IP heuristics (optional), with care for mobility.
- ☐ Storage: httpOnly + `Secure` cookies preferred over `localStorage`.
- ☐ JWT claims minimal (sub, iat, exp, jti, tenant_id, roles[] only as needed).
- ☐ Signature alg is strong (HS256 with strong secret or RS256/EdDSA with keys).

### 3.2 Session & Cookies (if session‑based)
- ☐ `Secure`, `HttpOnly`, `SameSite=Lax|Strict` set.
- ☐ Server‑side session invalidation on password change/reset, role change, logout.
- ☐ CSRF tokens enforced on state‑changing requests (POST/PUT/PATCH/DELETE).

### 3.3 RBAC/ABAC Enforcement
- ☐ Server enforces roles/permissions for every protected route.
- ☐ Roles are least‑privilege; permissions are granular where needed.
- ☐ AuthZ happens after AuthN and after tenant scoping is determined.
- ☐ Authorization is centralized (middleware/decorator), not ad‑hoc per route.

### 3.4 Multi‑Tenant Boundaries
- ☐ Every DB query is tenant‑scoped (`WHERE tenant_id = ?`).
- ☐ Tenant ID is derived from server‑trusted context, not from client input.
- ☐ Object lookups verify ownership/tenant before returning or mutating.
- ☐ No sequential IDs that enable IDOR; use UUIDs where possible.

### 3.5 Password & Reset Flows
- ☐ Hashing: Argon2id/bcrypt with cost tuned; no plain or unsalted storage.
- ☐ Reset tokens are single‑use, short‑lived, and stored hashed.
- ☐ On reset: revoke all sessions/tokens; require re‑auth.
- ☐ Brute‑force controls on login & reset endpoints (rate limit, backoff).

### 3.6 OAuth/SSO (if used)
- ☐ Strict allow‑listed redirect URIs.
- ☐ PKCE for public clients; `state` checked; nonce validated (OIDC).
- ☐ Email/identity mapping cannot escalate privileges automatically.

### 3.7 CORS & CSRF
- ☐ CORS origins are explicit; no `*` with credentials.
- ☐ Preflight allowed methods minimal; headers restricted.
- ☐ CSRF tokens required on cookie‑based auth.

### 3.8 Observability & Abuse Signals
- ☐ Structured logs for auth events (login fail/success, resets, role changes).
- ☐ Threshold alerting for brute force, password spray, token reuse.
- ☐ Audit trail is immutable or tamper‑evident.

---

## 4) Focused Heuristics & Quick Wins
Quick triage items that frequently cause the 95%→100% reliability gap.

- **Unprotected routes:** grep for `@app.route` / `router.get/post` without `require_auth`.
- **Claims drift:** UI assumes role `admin`; backend checks only `is_authenticated`.
- **Tenant drift:** queries missing `tenant_id`. Add DB constraints + default scopes.
- **Token reuse:** refresh token non‑rotating ⇒ session fixation. Implement rotation.
- **LocalStorage tokens:** switch to httpOnly cookies or use a hardened token service.
- **CSRF gaps:** cookie auth without CSRF middleware. Add tokens now.

---

## 5) Evidence Capture Templates

### 5.1 Findings Register
| ID | Title | Severity | Likelihood (1–5) | Impact (1–5) | Risk (L×I) | Affected Assets | Evidence (file:line, logs) | Recommendation | Owner | ETA |
|---|---|---:|---:|---:|---:|---|---|---|---|---|
| AUTH‑001 | Example | High | 3 | 4 | 12 | `/api/users` | `backend/users.py:88` | Add tenant scope | BE | 2d |

### 5.2 Endpoint → Guard Matrix (export from script below)
| Endpoint | Method | Guard | Roles Required | Tenant Scoped |
|---|---|---|---|---|

---

## 6) Helper Scripts (drop‑in)

### 6.1 Flask Guard Scanner (heuristic)
Create `scripts/audit/auth_guard_scan.py`:
```python
import re, sys, json, pathlib

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
route_re = re.compile(r"@app\.route\([\"']([^\"']+)[\"'].*?\)\n\s*def\s+(\w+)\(")
auth_re  = re.compile(r"@(require_auth|maybe_auth|login_required|jwt_required)")

results = []
for p in ROOT.rglob("*.py"):
    if any(s in str(p) for s in ("venv", "site-packages", "node_modules")):
        continue
    text = p.read_text(errors="ignore")
    for m in route_re.finditer(text):
        path, func = m.group(1), m.group(2)
        # look back ~6 decorators above for auth decorator
        start = m.start()
        pre = text[max(0, start-800):start]
        guard = "public" if not auth_re.search(pre) else auth_re.search(pre).group(1)
        results.append({"file": str(p), "endpoint": path, "function": func, "guard": guard})

print(json.dumps(results, indent=2))
```
Run and export:
```bash
python scripts/audit/auth_guard_scan.py backend > audit_artifacts/flask_guard_scan.json
```

### 6.2 Express/TS Guard Scanner (optional)
```bash
rg -n "router\.(get|post|put|patch|delete)\(([^)]*)\)" -g '!node_modules' > audit_artifacts/express_routes.txt
rg -n "(requireAuth|verifyToken|passport\.authenticate|ensureRole)" -g '!node_modules' > audit_artifacts/express_guards.txt
```

### 6.3 Public Whitelist (document explicitly)
```text
/public/health
/api/auth/login
/api/auth/refresh
# anything else must be explicitly added and justified
```

---

## 7) Tests to Add (minimum set)

### 7.1 Unit/Integration (backend)
- ✅ All protected endpoints return **401/403** when:
  - No token
  - Expired token
  - Wrong role
  - Cross‑tenant resource ID
- ✅ Refresh rotation works; reused refresh is rejected.
- ✅ Password reset token is single‑use; post‑reset invalidates prior sessions.

**PyTest sketch:**
```python
def test_admin_only_requires_role(client, token_user, token_admin):
    assert client.get("/api/admin/thing").status_code == 401
    assert client.get("/api/admin/thing", headers={"Authorization": f"Bearer {token_user}"}).status_code in (401,403)
    assert client.get("/api/admin/thing", headers={"Authorization": f"Bearer {token_admin}"}).status_code == 200
```

### 7.2 E2E Abuse Cases
- Brute force (rate limit kicks in)
- Tenant hopping attempt (`resource_id` from another tenant)
- Refresh reuse after rotation (should be denied)
- CSRF probe on cookie‑auth route (denied without token)

---

## 8) RBAC Matrix (authoritative)
Define the single source of truth and enforce it in code + tests.

| Role | Permissions | Notes |
|---|---|---|
| `admin` | `*` on tenant resources | Limited to tenant scope |
| `manager` | manage users, services, billing (tenant) | No system‑level ops |
| `tech` | read/write jobs assigned | No user admin |
| `viewer` | read‑only | No mutations |

Store as `docs/rbac_matrix.yml` and validate in CI.

---

## 9) Risk Scoring & Prioritization
Use **Severity** (Critical/High/Medium/Low) + **Likelihood/Impact (1–5)**.

- Critical: token/session compromise, cross‑tenant access, unguarded admin.
- High: missing CSRF on cookie auth, refresh non‑rotation, weak password reset.
- Medium: overly broad CORS, verbose claims, noisy logs.
- Low: minor inconsistency in error codes, doc gaps.

Prioritize by Risk (L×I), then by Effort (S/M/L). Add owners and dates.

---

## 10) Remediation Plan (example)
- **Day 1–2:** Lock down CORS, add CSRF middleware, document public whitelist.
- **Day 3–4:** Implement refresh rotation + blacklist; revoke on password reset.
- **Day 5:** Add tenant scopes + DB constraint; backfill tests.

---

## 11) CI Enforcement
- Add CI job to fail on Critical/High in Bandit/Semgrep/Gitleaks.
- Add test gate: endpoints without guards ⇒ fail build (use `auth_guard_scan.py`).
- Track `audit_artifacts/*` as build artifacts for review.

---

## 12) Reviewer Checklist (PR‑level)
- ☐ Endpoint has explicit guard & required role(s).
- ☐ DB query includes tenant scope.
- ☐ Tokens/cookies handled per policy.
- ☐ Tests include negative/abuse cases.
- ☐ Logs avoid secrets; events are structured.

---

## 13) Findings Summary (fill at the end)
- **Critical:** `<count>`
- **High:** `<count>`
- **Medium:** `<count>`
- **Low:** `<count>`

Top risks & owners:
1) `<AUTH‑XXX – title>` — Owner: `<name>` — ETA: `<date>`
2) `<AUTH‑XXX – title>` — Owner: `<name>` — ETA: `<date>`

---

## 14) Sign‑off
- Security: `<name>`
- Backend Lead: `<name>`
- Product: `<name>`

> Attach all `audit_artifacts/*.json|.txt|.csv` and this markdown in the PR or release notes.
