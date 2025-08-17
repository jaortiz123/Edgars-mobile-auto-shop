# Test Pyramid Strategy

Phase 4 established a lean, fast, and maintainable test stack replacing a brittle
2+ minute UI invoice lifecycle test with a layered approach that runs in ~10 seconds total.

## Layers

1. Domain (Pure Business Logic)
	- Location: `backend/domain/` (e.g. `invoice_logic.py`)
	- Fast unit tests validate generation, payment transitions, void semantics, edge cases.
	- Deterministic: no DB, network, or Flask context. Execution time: a few milliseconds.

2. API Workflow (Integration Safety Net)
	- Single end-to-end Python test exercising: appointment -> service -> invoice -> payment -> PAID.
	- Ensures adapter layer + persistence + data shapes remain consistent after refactors.

3. Slim E2E UI (Critical User Path Only)
	- Spec: `e2e/user_pays_invoice.spec.ts`
	- Seeds data exclusively through public admin APIs, navigates directly to invoice, records payment.
	- Runtime ~2.5s (Chromium). Provides confidence the UI wiring reflects backend state transitions.

## Removed / Deprecated

- The legacy heavy Playwright spec (`invoice-lifecycle.spec.ts`) that navigated boards, drawers,
  and skeleton states was deleted. It provided overlapping coverage at 50x the cost.
- A test-only seed endpoint (`/api/test/seed_completed_appointment`) was removed to eliminate
  production attack surface; seeding now uses first-class admin endpoints.

## Guidelines

- Add new domain rules -> write/extend a domain test first.
- Modify DB/service orchestration -> ensure API workflow test stays green; add targeted integration test only if a new cross-module contract is introduced.
- Add new critical UI user journeys -> prefer API seeding + minimal UI hops; keep under ~5s.
- Avoid reintroducing broad UI flows that assert internal intermediate states; reserve E2E for user-visible outcomes.

## Performance Snapshot (Post-Cleanup)

- Domain tests: O(ms)
- API workflow: ~4s
- Slim E2E UI test: ~2.5s
- Total relevant invoice path confidence: <10s vs ~120s pre-refactor (~98% reduction)

## Future Enhancements (Deferred)

- Tagging tests by layer (`@domain`, `@api`, `@e2e`) for selective CI matrices.
- Address React act() warnings (cosmetic) in a separate PR.
- Introduce tax/discount domain logic with accompanying domain tests.

This document should be updated whenever a new layer or strategy change is introduced.
