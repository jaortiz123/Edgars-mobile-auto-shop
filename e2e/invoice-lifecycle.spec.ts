// File intentionally left minimal.
// Historical context: This file previously contained a 2+ minute heavy UI invoice lifecycle test
// plus an inline slim variant. Phase 4 cleanup removed both in favor of the single
// canonical fast spec `user_pays_invoice.spec.ts` (~2.5s) to enforce the test pyramid:
//   - Pure domain tests for business rules
//   - Single API workflow test as integration safety net
//   - One minimal E2E UI test asserting critical user interaction (pay invoice -> PAID)
// The legacy implementation is deleted to avoid drift & maintenance cost. Keeping this
// comment (and filename) for one release cycle to aid discoverability; may be deleted later.
