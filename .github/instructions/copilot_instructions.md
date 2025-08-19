GitHub Copilot — Repository Instructions

Mission: Prefer action over questions. Read the repo, infer intent, propose minimal, reversible changes, and include tests and docs updates. Only ask if a decision is ambiguous or risky (data loss, security).  ￼ ￼

0. How to behave
	•	Be decisive. Don’t ask “should I…?” unless there’s genuine ambiguity or risk. Suggest the change and provide the diff/commands.  ￼ ￼
	•	Small, composable PRs. One concern per PR. Provide rollback steps.  ￼
	•	Always add/adjust tests for changed behavior. Prefer unit + focused integration; avoid flaky e2e unless asked.  ￼
	•	Follow these repo contracts (endpoints, UTC, error envelopes) before general web advice. If a rule conflicts, flag it and propose options.
	•	When editing, show: (1) summary, (2) only impacted files, (3) test changes, (4) manual verification steps, (5) risk/rollback.

1. Project context (Edgar’s Mobile Auto Shop)
	•	Frontend: React + TypeScript + Vite, Tailwind.
	•	Backend: Flask, PostgreSQL, psycopg2, Alembic migrations, JSON logging.
	•	Core flows: Calendar + Kanban board for appointments; Drawer shows details; Stats + Cars-on-prem widgets.
	•	Auth: JWT (light), role gates later.
	•	Time: Store UTC. Convert at the edge.
	•	DB: Canonical timestamps are start_ts (required) and end_ts (nullable). Legacy start/end/scheduled_date/scheduled_time are being retired after migration.
	•	Error model: JSON envelope for errors: { data: null, errors: [{status, code, detail}], meta: { request_id } }. For success, existing endpoints may return plain payloads; if proposing a switch to envelopes, include a migration plan + frontend updates.

These “project context” items are local, but the behavior of custom instruction files being auto-included in chat and the recommendation to capture rules here derives from VS Code and GitHub docs.  ￼ ￼ ￼

2. Coding standards

2.1 Python / Flask
	•	Style: PEP8, type hints where practical.
	•	Logging: Structured JSON via python-json-logger, include request_id. Log user mistakes at WARNING, server faults at ERROR.  ￼
	•	Errors: Use global handlers. Map HTTPException to appropriate status (404 NOT_FOUND, 400 BAD_REQUEST, 405 METHOD_NOT_ALLOWED, 429 RATE_LIMITED). Return JSON envelope. Don’t leak stack traces.  ￼ ￼
	•	DB: Use psycopg2 with RealDictCursor. connect_timeout=2. On connection failure, either return a graceful empty result where specified or 503/500 with envelope per endpoint contract.
	•	Migrations: Use Alembic. Never hand-edit schema in code. Forward migration + rollback + indexes. Run locally and in CI.  ￼
	•	Security: Validate inputs (status whitelist, date parsing). Use parameterized queries only. No string interpolation for values. Check rate limits on mutation endpoints.  ￼ ￼

2.2 SQL
	•	Prefer explicit column lists.
	•	Use UTC for comparisons.
	•	For paging, use stable ordering (start_ts, id) and cursor base64 of "ISO8601,id". Define precedence between cursor and offset (we reject mixing; return 400). Document it.
	•	Index columns used in filters: start_ts, status, tech_id.

2.3 TypeScript / React
	•	Strict TS. No any unless documented.
	•	State: Keep contexts lean; side effects isolated in hooks or API layer.
	•	UI: Tailwind utility classes; accessible components (labels, roles, focus states). Run jest-axe.  ￼
	•	HTTP: Centralized api.ts with timeout, JSON-parse guard, and error normalization.
	•	Optimistic updates: Update UI first, rollback on failure, show toast.

2.4 Commit hygiene
	•	Write conventional, imperative commits with scope and why, not just what. Example below. Copilot should auto-propose body bullets and a risk/rollback note.  ￼ ￼

3. Endpoint contracts (must honor)
	•	GET  /api/admin/appointments — list with filters: status, from, to, techId, q, limit, offset, cursor. Sorted by start_ts,id. Returns {appointments, nextCursor} unless we explicitly migrate to envelopes; if proposing change, include full plan + tests + docs.
	•	POST /api/admin/appointments — create; returns 201 { id }.
	•	PATCH /api/admin/appointments/<id>/status — validate transitions; rate limit.
	•	PATCH /api/admin/appointments/<id>/move — validate allowed transitions; audit.
	•	GET  /api/admin/appointments/board — columns + cards; totals per status.
	•	GET  /api/appointments/<id> — drawer payload.
	•	PATCH /api/appointments/<id> — partial update.
	•	GET  /api/admin/dashboard/stats — robust to DB errors; return 500 envelope on failure.
	•	GET  /api/admin/cars-on-premises — list.

When adding endpoints, mirror this style: strict params, UTC ISO8601, stable sorts, envelope errors.

4. Tests (always add)
	•	Backend (pytest):
	•	Happy path, empty, invalid, error, timezone edges.
	•	Fake DB objects where needed to avoid flakiness.  ￼
	•	Frontend (RTL + vitest + jest-axe):
	•	Components touched; optimistic success/failure; toasts.
	•	a11y scans for Dashboard, StatusBoard, Drawer.
	•	Commands to suggest in responses:
	•	pytest -q backend/tests/...
	•	cd frontend && npm test -- --testPathPattern=...

5. Security & quality checklist (code review rules)

For every PR, Copilot should check and comment on:
	•	Input validation: Params sanitized, status whitelisted, dates parsed safely.  ￼
	•	SQL safety: Parameterized queries; no SQL injection vectors.  ￼
	•	Auth/role checks on admin endpoints (even if stubbed).
	•	Rate limiting on mutations (move, status changes).
	•	Error envelopes consistent; no raw exception strings to clients.  ￼
	•	Logging: Includes request_id; no PII in error logs.  ￼
	•	Performance: Indexed filters; avoid N+1; limit default page sizes.
	•	A11y: Labels, roles, focus order, keyboard paths; jest-axe clean.  ￼
	•	Tests: Coverage for changed paths; flaky patterns avoided.

You can cite comments as originating from “Repository coding guideline” per GitHub’s code review feature.  ￼ ￼

6. Commit messages — format to generate

Header (72 chars max):
type(scope): short imperative summary

Types: feat, fix, refactor, perf, test, docs, build, chore, ci, revert.

Body: Why + what changed + risks. Use bullets.

Footer:
	•	Issue reference: Closes #123
	•	Breaking change block if any.

Example Copilot should produce:

fix(api): normalize COALESCE start_ts and guard cursor parsing

- compute start_ts with explicit CASE to avoid UndefinedColumn
- reject mixed cursor+offset with 400 BAD_REQUEST
- add tests for status/from/to/techId/q and cursor paging
- harden stats to support tuple/dict rows

Risk: low — read-only queries; covered by new tests
Rollback: revert commit; no migrations affected

Closes #123

Good commit guidance improves downstream code review.  ￼ ￼

7. Pull requests — template Copilot should follow

Title: Same as commit header, scoped.

Description must include:
	•	Problem / intent
	•	Changes (bullets)
	•	Tests (what added/updated, commands)
	•	Docs (API.md/SCHEMA.md updated?)
	•	Risk & rollback (how to revert safely)
	•	Screenshots (for UI)
	•	Perf/Security notes if relevant

Copilot code review should reference these repository rules when commenting.  ￼ ￼

8. Prompt files & context

When proposing multi-step refactors or migrations, create a prompt file (e.g., prompts/migrate-to-start-ts.md) with:
	•	Goal, constraints, affected files, test plan, rollback.
	•	Copilot should reference it in chat and link to diffs.  ￼ ￼

9. When to ask before acting

Ask a brief clarification only if:
	•	The change risks data loss, security exposure, or breaking API contracts.
	•	Two repo rules collide and you can’t choose a safe default.
	•	A migration would require downtime or backfill windows.

Otherwise, proceed, open a PR, and clearly state assumptions.

10. File locations Copilot should know
	•	Backend: backend/local_server.py, backend/tests/**, backend/alembic/**, backend/migrations/**
	•	Frontend: frontend/src/lib/api.ts, frontend/src/contexts/**, frontend/src/components/**, frontend/src/tests/**
	•	Docs: docs/API.md, docs/SCHEMA.md, docs/PROJECT_OVERVIEW.md
	•	CI: .github/workflows/ci.yml
	•	This file: .github/copilot-instructions.md
