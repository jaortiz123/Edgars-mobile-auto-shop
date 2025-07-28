# SECURITY.md — Edgar’s Mobile Auto Shop

**Date:** 2025‑07‑25
**Owner:** Jesus
**Scope:** Admin + API security baseline for Sprints 1–3. This document is practical and testable. Where choices are TBD, defaults are proposed.

> **Principle:** Minimize blast radius. Appoint → Board → Drawer runs on least privilege, short‑lived tokens, signed links, strict rate limits, and auditable changes.

---

## 1. Threat Model (high level)

**Actors**

* **Authenticated staff**: Owner, Advisor, Tech, Accountant
* **Customers**: receive links (authorization, payments—future)
* **External providers**: SMS/email webhook caller
* **Adversaries**: password spray, token theft, CSRF/XSS, API brute force, leaked links, insider misuse

**Crown jewels**

* Customer PII (names, phones, emails, VINs)
* Appointment data (dates, statuses, totals)
* Messages content
* Payment records (amounts, method — no PAN storage)

**Primary risks**

* Unauthorized access to appointments/messages
* SMS consent violations (TCPA)
* Link sharing without expiry
* Excessive messaging/DoS
* SQLi/XSS/IDOR

Mitigations throughout this doc map to these risks.

---

## 2. Authentication & Session

### 2.1 JWT sessions

* **JWT** signed with HS256 or RS256.
* **Expiration:** 30 minutes access token; optional refresh token 7 days.
* **Rotation:** refresh rotates on use; revoke on password change.
* **Storage:** HTTP‑only, Secure, SameSite=Lax cookies preferred. If using `Authorization: Bearer`, store tokens **in memory only**.

### 2.2 Passwords / MFA

* Passwords hashed with **bcrypt** (`work factor ≥ 12`) or argon2id.
* Admin/Owner accounts require **MFA** (TOTP) once implemented.

### 2.3 Login hardening

* Rate limit: **5 attempts / 15m / IP** with exponential backoff.
* Lock account for 15m after 10 consecutive failures.
* Generic error messages: “Invalid credentials”.

---

## 3. Authorization (RBAC)

Roles: **Owner, Advisor, Tech, Accountant**.

Enforce in API middleware; never trust the client. Summary:

| Capability          | Owner | Advisor | Tech *(no complete)* | Accountant |
| ------------------- | :---: | :-----: | :------------------: | :--------: |
| View calendar/board |   ✅   |    ✅    |           ✅          |      ➖     |
| Move status         |   ✅   |    ✅    |           ✅          |      ➖     |
| Complete job        |   ✅   |    ✅    |           ➖          |      ➖     |
| Record payment      |   ✅   |    ✅    |           ➖          |      ✅     |
| Void payment        |   ✅   |    ➖    |           ➖          |      ✅     |
| Send SMS/email      |   ✅   |    ✅    |           ➖          |      ➖     |
| Export CSV          |   ✅   |    ✅    |           ➖          |      ✅     |
| Manage users/roles  |   ✅   |    ➖    |           ➖          |      ➖     |

**Audit every privileged mutation** (see §8).

---

## 4. API Surface Hardening

* **TLS everywhere.** HTTP → HTTPS redirect.
* **Strict JSON**: `Content‑Type: application/json`; reject others for mutating routes.
* **CORS**: allow only app origins, `credentials: true` if cookies used.
* **CSRF**: if cookies are used, require **double‑submit token** or SameSite=Lax + custom header token (`X-CSRF-Token`).
* **Rate limits** (see §9). Distinct buckets per user/IP/route.
* **Pagination** on list routes; cap `limit ≤ 200`.
* **Validation** with pydantic/marshmallow; reject unknown fields.
* **Error model**: no stack traces to clients in prod; log correlation id.

---

## 5. Customer Links (Signed URLs)

Customer‑facing links (authorization, payment, future portal) must be **signed**.

* **Format:** `/c/:token` where token encodes `resource_id`, `exp`, and optional `action`.
* **TTL:** ≤ **7 days** (default 48h). Shorten for high‑risk actions.
* **Binding:** include **shop\_id** and **channel** (sms/email) to limit replay.
* **Revocation:** On completion/void, invalidate server‑side (store `nonce` / `used_at`).

Token payload example:

```json
{
  "rid": "APT-1201",
  "sid": "SHOP-1",
  "act": "authorize",
  "exp": 1754083200,
  "nonce": "2b7f..."
}
```

---

## 6. Webhooks

Providers (e.g., Twilio) must be authenticated.

* **Endpoint:** `POST /api/webhooks/messaging`
* **Auth:** HMAC SHA256 signature header. Reject if missing/invalid or replayed.
* **Body size limit:** 128 KB.
* **Idempotency:** dedupe on provider message id.

Pseudocode verification:

```python
sig  = request.headers['X-Provider-Signature']
body = request.get_data()
calc = hmac.new(SECRET, body, hashlib.sha256).hexdigest()
if not hmac.compare_digest(sig, calc): abort(401)
```

---

## 7. Data Protection

### 7.1 PII handling

* Mask PII in logs: phone/email partially redacted.
* Log **ids**, not payloads, for messages by default.
* Data retention: messages kept **24 months** (TBD). Provide purge job.

### 7.2 Encryption

* **In transit:** TLS 1.2+.
* **At rest:** database volume encryption (cloud default). Backups encrypted.
* Secrets managed via environment manager (e.g., AWS Secrets Manager) with **rotation** every 90 days.

### 7.3 Backups & DR

* Nightly backups; see **DR\_PLAN.md**. Test restore **quarterly**.

---

## 8. Audit Logging

Table: `audit_logs`

```
audit_logs(
  id uuid pk,
  user_id uuid null,
  action text not null,
  entity text not null,
  entity_id uuid not null,
  before jsonb null,
  after  jsonb null,
  ip inet null,
  user_agent text null,
  created_at timestamptz default now()
)
```

Actions to log: `STATUS_CHANGE, PAYMENT_RECORDED, PAYMENT_VOIDED, MESSAGE_SENT, EXPORT_RUN, LOGIN_SUCCESS, LOGIN_FAILURE`.

Access: Owner/Accountant can export audit logs as CSV; protect via RBAC + rate limit.

---

## 9. Rate Limiting

| Route group | Limit                                          | Notes                               |
| ----------- | ---------------------------------------------- | ----------------------------------- |
| Messaging   | **20 / customer / 24h**, **200 / shop / hour** | Prevent spam/TCPA violations        |
| Exports     | **5 / user / hour**                            | Large data protection               |
| Auth login  | **5 / 15m / IP**                               | Backoff then lock window            |
| Webhooks    | **300 / min / IP**                             | Burst control; respond 429 on abuse |

Return `429` with `Retry-After`. Log and alert on sustained throttling.

---

## 10. Input Validation & Safe Queries

* Use parameterized SQL only; never string concatenation.
* Enforce **UUID format** for ids at the boundary.
* Sanitize message bodies for logs; store raw text in DB.
* Validate status transitions server‑side with a finite‑state map.

Example transition guard:

```python
ALLOWED = {
  'SCHEDULED': {'IN_PROGRESS','CANCELED','NO_SHOW'},
  'IN_PROGRESS': {'READY','COMPLETED'},
  'READY': {'COMPLETED'},
}
if new_status not in ALLOWED.get(old_status, set()):
    abort(400, 'Invalid transition')
```

---

## 11. Secure Headers

Apply via Flask‑Talisman or equivalent middleware:

* `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
* `X-Frame-Options: DENY`
* `X-Content-Type-Options: nosniff`
* `Referrer-Policy: no-referrer`
* `Permissions-Policy: camera=(), microphone=(), geolocation=()`
* `Content-Security-Policy` (tight):

  * `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.twilio.com; frame-ancestors 'none'`

Tune CSP once asset hosts are known.

---

## 12. Dependency & Build Security

* Pin versions in `requirements.txt` and `package.json`.
* Enable **Dependabot**/Renovate for updates.
* CI runs **SCA** (pip‑audit, npm audit) and blocks criticals.
* Build artifacts are immutable; include `version` endpoint exposing git SHA.

---

## 13. Environment Segregation

* **dev / staging / prod** isolated. Separate DBs, queues, buckets, secrets.
* Use distinct JWT secrets/keys per environment.
* Disable customer messaging in dev/stage (use sandbox providers).

---

## 14. Network & Cloud (AWS posture — if/when used)

* API behind **ALB/CloudFront**; WAF optional later.
* Private subnets for DB; no public exposure.
* S3 buckets for media (future): **private by default**, access via presigned URLs; lifecycle rules for cost control.
* IAM least privilege: service roles restricted to required actions; no wildcard `*` in prod.

---

## 15. Observability & Alerts

* Structured logs with correlation id `x-request-id`.
* Metrics: request rate, p95 latency, 5xx rate per route, queue latencies, provider error codes.
* **SLOs** (see API.md) with alerting to Slack/page.

---

## 16. TCPA Compliance (messaging)

* `customers.sms_consent_status` with values `granted|denied|unknown`.
* **STOP** inbound auto‑sets `denied`; send confirmation; audit log.
* **Quiet hours** 21:00–08:00 local time; require Owner override to send.
* Message footer: shop name + “Reply STOP to opt out”.

---

## 17. Vulnerability Management

* Monthly **lightweight scans** (SCA + container image scan if used).
* Annual third‑party **penetration test** once paying customers exist.
* Patch cadence: critical within **48h**, high within **7 days**.

---

## 18. Incident Response (minimum viable)

1. **Detect** — alert from SLO/monitoring or report.
2. **Classify** — P0 (customer data at risk) / P1 (service down) / P2 (degraded).
3. **Contain** — disable affected features/rotate keys; block offending accounts/IPs.
4. **Eradicate** — patch, hotfix, or config change.
5. **Recover** — verify, restore data if needed, re‑enable.
6. **Learn** — write post‑mortem with action items and deadlines.

Contacts: add on-call rotation and escalation contacts when team grows.

---

## 19. Sprint Security Gates

### Sprint 1 (must‑have)

* JWT with expiry, RBAC middleware on status changes & exports.
* Signed customer links framework ready (even if not user‑visible yet).
* Rate limits for logins and board/messaging (messaging can be disabled by flag).
* Secure headers enabled; CORS locked down; CSRF token if cookies.
* Audit logs for status changes.

### Sprint 2

* Messaging consent/STOP + webhook HMAC.
* Delivery status updates stored; retries with backoff.
* Export endpoints behind RBAC + rate limit; audit `EXPORT_RUN`.

### Sprint 3

* Payments immutable + void via reversing entry; audit `PAYMENT_RECORDED/VOIDED`.
* Full a11y audit; keyboard alternative to DnD.

---

## 20. Checklists

### 20.1 App hardening checklist

* [ ] HTTPS enforced; HSTS set
* [ ] JWT exp/rotation enforced
* [ ] RBAC on all privileged routes
* [ ] CSRF protection (if cookies)
* [ ] CORS allowlist only
* [ ] Rate limits configured and tested
* [ ] Signed URL helper with TTL
* [ ] Audit logs for critical actions
* [ ] PII masked in logs
* [ ] Backups encrypted + tested restore

### 20.2 Secrets & keys

* [ ] Stored in secret manager
* [ ] Rotated every 90 days
* [ ] Separate per environment
* [ ] Access logged and restricted

---

## 21. Open Decisions

1. HS256 vs RS256 for JWT — RS256 recommended if multiple services are planned.
2. Cookie vs Authorization header — cookie + CSRF for browser app is preferred.
3. WAF adoption timing — defer until external exposure grows.
4. Multi‑tenant RLS — optional now; enable when multiple shops onboard.

---

**This document pairs with:** `API.md` (RBAC & SLOs), `SCHEMA.md` (tables, audit logs), `DR_PLAN.md`, `SECURITY_CHECKLIST.md` (ops), and `PERFORMANCE_METRICS.md`.
