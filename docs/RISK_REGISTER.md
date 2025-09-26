# RISK_REGISTER.md

| ID | Category | Risk | Impact | Likelihood | Mitigation | Owner | Due | Status |
|---:|---|---|---|---|---|---|---|---|
| 1 | Compliance | TCPA consent missing for SMS | High | Med | Add `sms_consent_status`, STOP handler, quiet-hours guard | Jesus | 2025-08-05 | Open |
| 2 | RBAC | Tech can complete jobs | High | Low | Enforce role checks server-side + UI guards | Jesus | 2025-08-01 | Open |
| 3 | Perf | Board N+1 queries | Med | Med | Pre-join queries; add query-count test | Jesus | 2025-08-08 | Open |
| 4 | Observability | No SLO alerts | Med | Med | Instrument p95, error budgets; weekly report | Jesus | 2025-08-12 | Open |
| 5 | Data safety | No reversible migrations tested | High | Low | Write `0001–0003` with down paths; test restore | Jesus | 2025-08-02 | Open |
| 6 | Messaging | Provider throttling | Med | Med | Queue + retry with backoff; track error codes | Jesus | 2025-08-15 | Open |
| 7 | A11y | No keyboard DnD alt | Med | Med | Implement “Move to…” menu; test with screen reader | Jesus | 2025-08-06 | Open |
| 8 | Security | Customer links not signed | Med | Low | Signed URLs with 7-day TTL | Jesus | 2025-08-20 | Planned |
| 9 | Tech Debt | Flask JSON serializer deprecation warnings | Low | Med | Migrate to Flask 2.3+ JSON provider or custom encoder; track warning removal | Jesus | 2025-10-10 | Open |
