# Technical Debt Log

This document tracks known technical debt in the project to be addressed in future sprints.

## Backend

### 0. Implement Role-Aware Admin vs. Customer Authentication

* **Issue**: Frontend currently always calls `/api/customers/profile` using a token obtained from an advisor/admin login during E2E setup. The backend `legacy_customer_profile` endpoint is customer-centric; admin/advisor tokens do not map cleanly to a customer identity, causing either misleading 404s (before) or token-clearing 401s (after attempted hardening). This mismatch cascades into test flakiness when authService interprets 401 as session expiry and clears the token, breaking subsequent protected UI flows.
* **Proposed Changes**:
  1. Introduce `/api/admin/profile` returning administrator identity & role claims (id/email/permissions) without requiring a customer record.
  2. Update `authService.getProfile()` to:
     * Parse JWT role; if role != `customer`, call `/api/admin/profile` instead of `/api/customers/profile`.
     * Only clear token on 401 if the request was made to its role-appropriate profile endpoint (avoid clearing on role mismatch).
     * Treat 404 from the customer endpoint (legacy tokens) as soft-miss and retain token, logging a warning.
  3. Add lightweight backend handler `@app.route('/api/admin/profile')` that validates token, returns `{ id, email, role, issuedAt, expiresAt }` and 401 on invalid/expired token.
  4. Adjust E2E global setup to assert the correct profile endpoint based on role to tighten readiness (admin tokens -> admin endpoint; customer tokens -> customer endpoint).
  5. Add Playwright regression test ensuring admin dashboard initialization never triggers token clear due to calling the wrong profile endpoint.
* **Benefits**: Eliminates ambiguous 404/401 noise, prevents unnecessary token clearing, simplifies readiness logic, and sets foundation for future RBAC enhancements (e.g., technician limited UI).
* **Risks / Mitigations**: Minor addition of new endpoint—guard with existing auth validation; ensure no PII leakage; add unit test for role branch logic in `authService`.
* **Success Criteria**: E2E suite runs without any `/api/customers/profile` calls when using admin token; no token-clear warnings; dedicated admin profile test passes.


### 1. Batch Endpoint for Adding Appointment Services

* **Issue**: The current implementation for adding services to an appointment (`AppointmentDrawer.tsx`) sends one `POST` request per new service sequentially.
* **Desired State**: The backend should expose a single, atomic batch endpoint, such as `POST /api/appointments/{id}/services`, that accepts an array of service objects to create.
* **Reasoning**: A batch endpoint would be more performant, reduce network overhead, and ensure that adding multiple services is an atomic transaction, simplifying error handling on the client.

### 2. Batch Endpoint for Deleting Appointment Services

* **Issue**: Current deletion flow issues one `DELETE /api/appointments/{id}/services/{serviceId}` request per removed service sequentially.
* **Desired State**: Provide a single endpoint such as `DELETE /api/appointments/{id}/services` (body: list of service IDs) or `POST /api/appointments/{id}/services:batch-delete` to remove multiple services atomically.
* **Reasoning**: Reduces network chatter, shortens total deletion latency, and allows atomic rollback semantics (all-or-nothing) simplifying client error handling.

### 3. Epic G (Performance Hardening) Deferred Items

The following tasks were explicitly deferred during Epic G and should be tracked for future prioritization (candidate for an aggregated Jira ticket "EPIC-G-DEBT-CLEANUP"):

* **Database Write Amplification Integration**: Automate persistence + historical tracking for `measure_write_amp.py` (currently console-only). Add daily job + dashboard.
* **Bloat Check Enhancements**: Add structured JSON output + GitHub Action artifact; consider alert channel integration and index-level detailed reporting (per-index pct + size bytes). Add retry logic when pgstattuple unavailable momentarily.
* **Simulation Fallback Policy**: Decide whether `check_db_bloat.py` should fail (vs warn) when stats cannot be collected; currently returns 0 on collection failure.
* **Redundant Validation Blocks**: Consolidate duplicate request validation (notably in messaging + appointments routes) into shared helper to reduce drift.
* **Test Warning Cleanup**: Resolve `PytestReturnNotNoneWarning` in `backend/tests/test_container_setup.py` (replace `return` with assertions). Address React `act()` warnings surfaced in some frontend console output (wrap state-changing async operations in `act`).
* **Makefile Targets**: Add standardized targets: `make test-backend`, `make test-frontend`, `make write-amp`, `make db-bloat-check`, `make lint` to simplify developer workflow (presently ad‑hoc shell scripts / npm scripts).
* **Coverage Threshold Rationalization**: Unify frontend dual-threshold system (Vitest targets vs CI minimums) by externalizing config to single JSON consumed by both vitest and CI step script.
* **Critical Module Coverage Gaps**: Some non-critical but high-churn frontend modules below aspirational target; produce differential coverage trend report (extend `scripts/coverage/check.js`).
* **Telemetry Persistence**: Current backend telemetry counters in-memory; persist to Redis / Postgres for durability and restart resilience.
* **PII Redaction Regex Review**: Schedule periodic audit of redaction logic (email + E.164 substring detection) to ensure no regression and expand to additional identifier patterns (license plates / VIN partials) if needed.
* **Index Maintenance Automation**: Add scheduled REINDEX / VACUUM (FULL when needed) recommendation generator fed by bloat + write amplification metrics.
* **Plan Baseline Snapshot Evolution**: Enrich plan hashing scripts with normalized cost components and store deltas per deploy for regression tracking.
* **Consolidate Module Aliasing Logic**: Move Flask app dual-import aliasing into a tiny utility module to avoid repeating logic if new service entrypoints are added.
* **Structured Logging Upgrade**: Migrate ad-hoc log formatting to consistent JSON logger (python-json-logger already dependency) including request_id, latency, bloat/write_amp metrics.
* **Retry / Circuit Metrics Export**: Expose `_AsyncLogWorker` breaker stats via `/health` or metrics endpoint for observability.
* **Frontend Test Artifacts Noise**: Trim verbose MSW logs in normal runs; provide `LOG_LEVEL=warn` default for local to reduce console clutter.
* **CI Optimization**: Potential matrix splitting for backend tests (unit vs integration) to reduce critical path time; cache wheels for psycopg2.
* **Security Audits**: Automate `safety` + `npm audit` summary ingestion into a single consolidated report artifact.
* **DB Metrics Sampling Interval**: Introduce sampling window or delta computation for write amplification instead of absolute cumulative counters to improve signal for short intervals.
* **Alert Routing Implementation**: Wire RACI-defined routing (docs/raci_and_alerting.md) into actual notification/monitoring system once channel credentials approved.
* **Documentation Gaps**: Add README section illustrating interpreting write amplification ratios with examples (high vs low) and remediation playbook.
