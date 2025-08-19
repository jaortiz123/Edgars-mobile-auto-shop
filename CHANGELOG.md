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
