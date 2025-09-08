# Changelog

## Unreleased

### Added

- Admin Customers Search: Secure smart sorting (relevance default, name asc/desc, last visit desc, lifetime spend desc) via server whitelist (avoids SQL injection) and new VIP flag (lifetime spend ≥ $5,000) now exposed to frontend.
- Frontend Customers Page: Sort dropdown UI wired to backend, persists selection during session, integrates with existing filter chips (VIP / Overdue) and grouping logic.
- Test Coverage: Backend parametrized tests for each sort mode plus invalid fallback. Frontend tests for sorting interaction, navigation, grouping, and filter chips; stabilized board filtering tests with isolated persisted state reset.
- F1 Telemetry Plumbing: Backend canonical lowercase Request-Id middleware, async buffered logger with circuit breaker & metrics; frontend hardened telemetry client (track() enrichment, queue persistence, exponential backoff, deterministic recursive PII redaction for keys & values, payload size guards); comprehensive unit + integration tests.

### Changed

- Customer search endpoint now derives and returns `vip: boolean` for each customer record.

### Internal / Tooling

- Implemented ORDER BY whitelist (SORT_MAP) for safe dynamic ordering and added placeholder skipped legacy duplicate test to ensure clean frontend suite.

### Next Steps

- Triage existing unrelated backend test failures (baseline indicates pre-existing issues) and prioritize DB connectivity & CSV export errors.
- Consider documenting VIP threshold and possible configuration in README.


## 2025-09-07 — API Consistency & Resilience

### New

- Standardized JSON response envelope across API responses. All JSON responses now conform to `{ ok, data, error, correlation_id, meta? }`. Error responses include a unified structure with HTTP code and message; correlation IDs are returned via header (`X-Correlation-Id`) and echoed in the body.
- API-level pagination for list responses. Middleware automatically paginates top-level arrays and common object-with-list shapes (e.g., `{ "technicians": [...] }`) using query params `page` and `page_size` (bounded with sensible defaults). Paginated responses include `meta.pagination` with `page`, `page_size`, `total`, and `total_pages`.
- Idempotency-Key support for critical POST endpoints (appointments, payments, vehicles, invoices, and service-operations). Replaying the same request body+path+tenant with the same key within TTL returns the original response and sets `X-Idempotency-Status: replayed`.

### Improved

- Unified error handling with consistent envelope and correlation IDs.
- Single CORS initialization and duplicate-route silencer to stabilize local reloads and testing.
- Hardened endpoints for test/dev: safe DB connection helper with memory-mode fallbacks for selected list endpoints (e.g., technicians) to enable offline smoke tests.

### Notes for Integrators

- Consumers should be tolerant of envelope-wrapped responses; `data` contains the payload previously returned at the top level. During migration, clients that already accept both shapes are unaffected.
- For list endpoints, prefer reading pagination details from `meta.pagination` and passing `page`/`page_size`.
- For POST operations that could be retried, set an `Idempotency-Key` header to avoid duplicate effects on transient failures.

### Issues

- Resolves #59 — Implement standardized pagination metadata for list endpoints.
- Resolves #60 — Add Idempotency-Key support and replay semantics for critical POST routes.
