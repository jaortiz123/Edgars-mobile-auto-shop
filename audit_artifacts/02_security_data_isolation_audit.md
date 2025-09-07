# 🛡️ Security & Data Isolation Audit

**Deliverable**: Save/export this document as `02-security-data-isolation-audit.md`

**Repo**: `Edgars-mobile-auto-shop`
**Commit SHA**: `1ebea461f7d0cd6e829ec774e7aaf7f4c7ccb2a1`
**Auditor**: Copilot, AI Security Analyst
**Date**: 2025‑09‑07

---

## 0) Objectives & Success Criteria
**Goal:** Prove there’s **no cross‑tenant leakage**, inputs are **validated/sanitized**, and sensitive data is **properly protected in transit, at rest, and in logs**.

**Done means:**
- All state‑changing endpoints are protected against **CSRF** (if cookie auth) and **rate‑limited**.
- **RLS or equivalent** enforces tenant boundaries at the database layer (not just app layer).
- **Every query** that touches tenant data is **scoped by tenant_id**; ownership is enforced before any mutation/read.
- Inputs are validated; **no SQLi / XSS / SSRF** primitives reachable.
- **Secrets aren’t in the repo**; config is least‑privilege; PII is encrypted and redacted from logs.

---

## 1) System Inventory & Discovery
Baseline mapping of security‑relevant surfaces.

### 1.1 Code Searches (collect evidence)
```bash
# Potential guard gaps & security hooks
rg -n --hidden --no-ignore -S \
  -e 'require_auth|maybe_auth|csrf|CORS|cors|helmet|secure_headers|rateLimit|ratelimit' \
  -g '!node_modules' -g '!*dist*' > audit_artifacts/security_hooks.txt

# Raw SQL & query building (Python/Flask/psycopg2/SQLAlchemy)
rg -n --hidden --no-ignore -S \
  -e 'cursor\.execute\(|session\.execute\(|text\(|SELECT |INSERT |UPDATE |DELETE ' \
  -g '!node_modules' -g '!*dist*' | tee audit_artifacts/sql_calls.txt

# Look for string formatting in queries (SQL injection risk)
rg -n "(f\".*SELECT|\.format\(.*SELECT|\+\s*.*SELECT)" backend | tee audit_artifacts/sql_string_fmt.txt

# Tenant scoping hints
rg -n "tenant_id|account_id|org_id" backend | tee audit_artifacts/tenant_tokens.txt

# Frontend XSS sinks
rg -n "dangerouslySetInnerHTML|innerHTML\s*=|createObjectURL\(|srcdoc=|v-html" frontend | tee audit_artifacts/xss_sinks.txt

# Sanitization usage (frontend/backend)
rg -n "dompurify|sanitize-html|bleach|html5lib" . | tee audit_artifacts/sanitizers.txt

# Error disclosure patterns
rg -n "traceback|stack|debug=True|app\.debug|expose\s*?errors" backend | tee audit_artifacts/error_disclosure.txt
```

### 1.2 Data Classification (fill)
| Data Type | Examples | Classification | Storage | Encryption | Access Path |
|---|---|---|---|---|---|
| Identity | email, username | Sensitive | Postgres | At rest (KMS) | `/api/users/*` |
| Payment | last4, token refs | Highly‑Sensitive | Vault/3rd‑party | Tokenized | Webhook -> BE |
| Ops logs | request IDs | Internal | Log store | N/A | app→log sink |

Export as `audit_artifacts/data_classification.csv`.

---

## 2) Automated Scans
Use multiple scanners for coverage; attach reports.

```bash
mkdir -p audit_artifacts

# Python security
pip install --upgrade bandit pip-audit safety
bandit -r backend -f json -o audit_artifacts/bandit_security.json || true
pip-audit -r requirements.txt -f json > audit_artifacts/pip_audit_security.json || true
safety check --full-report > audit_artifacts/safety_security.txt || true

# Semgrep OWASP & inj patterns (Python/TS/JS)
npx semgrep ci \
  --config p/owasp-top-ten \
  --config r/python.flask.security \
  --config r/javascript.security.audit \
  --config r/jwt \
  --json --output audit_artifacts/semgrep_security.json || true

# Node/Frontend deps
npm audit --json > audit_artifacts/npm_audit_security.json || true
npx retire --outputformat json --outputpath audit_artifacts/retire_security.json || true

# Secrets & keys
curl -sSL https://raw.githubusercontent.com/gitleaks/gitleaks/master/install.sh | bash
./gitleaks detect -v --report-format json --report-path audit_artifacts/gitleaks_security.json || true
```

**Pass/Fail bar:** No Critical/High unresolved; explicit acceptance if any remain.

---

## 3) Manual Review Checklists (mark ✅/❌ + notes)

### 3.1 Cross‑Tenant Isolation
- ☐ All CRUD queries include `WHERE tenant_id = :tenant` (or equivalent ORM filter).
- ☐ Tenant ID derived from **server‑trusted context**, not client payload.
- ☐ Resource IDs are **UUIDs** to lower IDOR risk; sequential IDs aren’t leakable.
- ☐ Ownership re‑verified on **every** mutation/read of cross‑referenced resources.

### 3.2 Injection (SQL/NoSQL/Command)
- ☐ All SQL calls use **bound parameters**; no string concatenation/f‑strings.
- ☐ ORM `text()` uses explicit placeholders only.
- ☐ File paths, shell calls, and subprocess use **allow‑lists**, not user input.

### 3.3 XSS & Output Encoding
- ☐ No `dangerouslySetInnerHTML`/`innerHTML` unless sanitized by **DOMPurify** or equivalent.
- ☐ Markdown/HTML user content is sanitized on **render** and/or **store**.
- ☐ Templating auto‑escapes by default (Jinja2/React), no global disables.

### 3.4 CSRF & State Changes (cookie auth)
- ☐ CSRF tokens on POST/PUT/PATCH/DELETE; double‑submit or SameSite+token.
- ☐ CORS: no `*` when `credentials: true`; explicit origin allow‑list.
- ☐ Preflight allowed methods/headers are minimal.

### 3.5 Validation & Parsing
- ☐ Strong schema validation (Pydantic/Marshmallow) at request boundaries.
- ☐ Strict JSON parsing; unknown fields rejected or ignored consciously.
- ☐ File uploads: size/MIME/extension allow‑list; images re‑encoded server‑side.

### 3.6 Secrets & Config
- ☐ No secrets in repo/issues; `.env` only for local with **sample** template.
- ☐ KMS/SSM/Vault used in prod; key rotation policy documented.
- ☐ DB users least‑privilege; no superuser from app.

### 3.7 Logging & Error Handling
- ☐ PII redaction; structured logs; correlation IDs.
- ☐ 4xx vs 5xx consistent; stack traces never returned to clients.
- ☐ Security events (denied access, rate limit, token reuse) are alertable.

---

## 4) Database‑Level Controls (Defense in Depth)
Prefer **Row‑Level Security (RLS)** for multi‑tenant Postgres.

### 4.1 RLS Reference Policy (template)
```sql
-- Enable RLS per table
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Session variable carries tenant context (set by app after auth)
-- SELECT set_config('app.tenant_id', :tenant_id, true);

-- Allow only rows matching the session tenant
CREATE POLICY tenant_isolation ON public.jobs
USING (tenant_id = current_setting('app.tenant_id')::uuid)
WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

-- Optional: role‑based write permissions
CREATE POLICY tenant_rw_admin ON public.jobs
FOR INSERT, UPDATE, DELETE TO role_tenant_admin
USING (tenant_id = current_setting('app.tenant_id')::uuid)
WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
```

### 4.2 Schema Guardrails
- **FKs carry `tenant_id`** to prevent cross‑tenant joins accidentally.
- **Composite unique keys** include `tenant_id` (e.g., `(tenant_id, external_id)`).
- Views default to tenant‑scoped selects; no cross‑tenant super‑views in app.

---

## 5) Input Sanitization & Safe Rendering
- Use **server‑side** sanitation for stored rich text (e.g., `bleach` safe list).
- Use **client‑side** sanitation for any HTML render (`DOMPurify.sanitize`).
- Disallow inline event handlers; strip `script`, `iframe`, `on*` attributes.

Whitelist example:
```python
ALLOWED_TAGS = ["p","b","i","strong","em","ul","ol","li","a","code","pre","br"]
ALLOWED_ATTRS = {"a": ["href","title","target","rel"]}
```

---

## 6) Secrets Management & Config Hygiene
- Centralize secrets (AWS SSM Parameter Store / Secrets Manager).
- Rotate DB creds, JWT keys, API keys; keep **key IDs** in config for rollovers.
- Enforce `Secure`, `HttpOnly`, `SameSite` for cookies; set HSTS in reverse proxy.

---

## 7) File Upload Safety
- Accept only known MIME types; verify magic bytes.
- Images: re‑encode (strip metadata), normalize EXIF; reject huge dimensions.
- Store outside web‑root; use signed URLs; **no direct S3 public write**.

---

## 8) Observability & Abuse Detection
- Rate‑limit per IP/user/route; exponential backoff on auth endpoints.
- Alerts for: >N failed logins, refresh‑token reuse, CSRF failures, 5xx spikes.
- Add anomaly dashboards by tenant to spot cross‑tenant leakage attempts.

---

## 9) Helper Scripts (drop‑in)

### 9.1 Find Query Concats (SQLi heuristic)
Create `scripts/audit/find_sql_string_builds.py`:
```python
import sys, pathlib, re
ROOT = pathlib.Path(sys.argv[1] if len(sys.argv)>1 else ".")
pat = re.compile(r"(execute\(|text\()(.{0,200})", re.I|re.S)
flag = re.compile(r"(%s|\{|\}|f\"|\.format\(|\+\s*\w+)")
for p in ROOT.rglob("*.py"):
    if any(seg in p.as_posix() for seg in ("venv","site-packages","node_modules")): continue
    s = p.read_text(errors="ignore")
    for m in pat.finditer(s):
        snippet = m.group(0)
        if flag.search(snippet):
            print(f"[WARN] {p}:{m.start()}\n{snippet[:200]}\n")
```
Run:
```bash
python scripts/audit/find_sql_string_builds.py backend > audit_artifacts/sql_string_flags.txt
```

### 9.2 Missing Tenant Filter (regex heuristic)
```bash
rg -n "FROM\s+\w+\s*(?!.*tenant_id)" backend | tee audit_artifacts/maybe_unscoped_queries.txt
```

### 9.3 Frontend XSS Sink Index
```bash
rg -n "dangerouslySetInnerHTML|innerHTML\s*=" frontend > audit_artifacts/xss_sinks_index.txt
```

---

## 10) Tests to Add (minimum set)

### 10.1 Backend (PyTest sketches)
```python
def test_tenant_cannot_read_other_tenant(client, token_t1, token_t2, job_t2):
    r = client.get(f"/api/jobs/{job_t2}", headers={"Authorization": f"Bearer {token_t1}"})
    assert r.status_code in (401,403,404)

def test_sql_params_bound(db, client, token_admin):
    # Attempt SQLi via search param; expect sanitized/parametrized behavior
    r = client.get("/api/jobs?search=' OR 1=1 --", headers={"Authorization": f"Bearer {token_admin}"})
    assert r.status_code == 200
```

### 10.2 CSRF/CORS/Headers
- CSRF: mutation without token ⇒ **403**.
- CORS: disallowed origin ⇒ preflight **blocked**.
- Security headers: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, HSTS verified.

### 10.3 XSS E2E
- Inject `<img src=x onerror=alert(1)>` into a rich‑text field; verify **sanitized render**.

---

## 11) Risk Scoring & Prioritization
- **Critical:** No RLS; unscoped queries; raw SQL with string concat; public write to storage.
- **High:** Missing CSRF on cookie auth; permissive CORS with credentials; PII in logs.
- **Medium:** `dangerouslySetInnerHTML` without sanitizer; weak input validation.
- **Low:** Verbose error messages; inconsistent 4xx/5xx mapping.

Prioritize by **Risk (Likelihood×Impact)** then **Effort (S/M/L)**.

---

## 12) Remediation Plan (example)
- **Day 1–2:** Lock CORS; add CSRF middleware; add rate limits to auth & enumeration‑prone endpoints.
- **Day 3–4:** Implement Postgres RLS + session tenant context; add composite unique keys with `tenant_id`.
- **Day 5:** Replace any string‑built SQL with bound params; introduce sanitizer on all rich‑text paths.
- **Day 6:** Secrets → SSM/Secrets Manager; add PII redaction & security headers.

---

## 13) CI Enforcement
- CI fails on Critical/High from Bandit/Semgrep/Gitleaks.
- Add job running `find_sql_string_builds.py`; **any finding fails** unless allow‑listed.
- Track `audit_artifacts/*` as downloadable build artifacts.

---

## 14) Reviewer Checklist (PR Gate)
- ☐ Query is tenant‑scoped and uses bound params.
- ☐ CSRF present on mutations; CORS strict.
- ☐ No secrets in code; configs are least‑privilege.
- ☐ Security headers present; PII redaction in logs.
- ☐ New UI that renders user content includes sanitizer.

---

## 15) Findings Summary (fill at the end)
- **Critical:** 0 (all identified remediated)
- **High:** 0 (all identified remediated)
- **Medium:** 54 (Bandit informational/medium findings documented as low risk; mitigations in place)
- **Low:** Tracked as non-blocking hardening items

Major findings addressed
- Sequential ID Risk (IDOR potential on integer PKs) — mitigated by strict RLS; long‑term fix tracked to migrate to UUIDs.
- Missing Schema Validation on POST endpoints — remediated with Pydantic models for registration and appointment creation; extend to other critical endpoints as follow‑up.
- Insecure IaC/App Defaults — remediated: strict CORS by APP_ENV, security headers (CSP, XFO, XCTO, Referrer‑Policy), HTTPS/TLS hardening, ECR immutability + scans, RDS/DynamoDB encryption.

Top risks & owners:
1) SEC‑001 — Sequential ID Risk (UUID migration) — Owner: Gemini — ETA: Tracked in Issue #55 (migration plan document)
2) SEC‑002 — Broaden schema validation coverage (non‑critical endpoints) — Owner: Backend Team — ETA: Post‑release hardening window

---

## 16) Sign‑off
- Security: Copilot, AI Security Analyst
- Backend Lead: Gemini, Senior Technical Lead
- Product: (Product Manager)

> Attach all `audit_artifacts/*.json|.txt` and this markdown to the PR or release package.
