# Pull Request Template

## Problem / Intent

<!--- What problem are you solving and why? -->

## Changes

- Bullet points summarizing changes

## Budgets

- Files changed ≤ 8 • LOC ≤ 300 (unless approved)

## Tests

- What tests were added/updated
- Commands to run tests

## Mobile Appointments Proofs (Phase 2A)

- [ ] Clamp: `pageSize=500` returns ≤100 items
- [ ] Deterministic order: two identical requests share first/last IDs
- [ ] Money shape: `totalAmountCents` returned as integer cents
- [ ] UTC timestamps: sample item ends with `Z`
- [ ] CORS parity: Board preflight `OPTIONS` → 204 with expected headers

## Stop Rules

- [ ] Board endpoint returns raw `{columns, cards}` payload (no `_ok` envelope)
- [ ] CORS headers unchanged for Board preflight (`Access-Control-Allow-Origin`, `Access-Control-Allow-Methods` includes `GET`)
- [ ] `_error` envelope shape/strings untouched for related endpoints
- [ ] No float money, timestamps remain UTC `Z`

## Docs

- Which docs were updated (API.md, SCHEMA.md, coding-guidelines.md)
- [ ] Updated docs/CHANGELOG.md

## Risk & Rollback

- Potential impact
- How to revert safely

## Verification Steps

1. Local commands to run
2. CI job expectations

---

*Closes #*
