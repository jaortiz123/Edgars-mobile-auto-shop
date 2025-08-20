# Technical Debt Log

This document tracks known technical debt in the project to be addressed in future sprints.

## Backend

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
