# Auth & Tenant Audit Artifacts

This folder contains outputs from Phase 1 (Discovery) of the Authentication & Authorization Audit.

Contents:

- inventory_auth_matches.txt — Raw grep inventory of auth-/tenant-related references across .py/.ts/.tsx/.js files.
- flask_guard_scan.json — Static map of Flask routes to detected direct guards and effective guards (after alias propagation).
- endpoint_auth_matrix.csv — CSV version of the guard scan (rule, methods, direct/effective guards, function, file, line).
- unguarded_admin_routes.csv — Filter of /api/admin routes lacking effective auth guards; use as triage list.

Re-run the scan:

- python3 scripts/audit/auth_guard_scan.py

Notes:

- Login endpoints are expected to be unguarded (e.g., /api/admin/login). Alias routes without /api are propagated to their underlying handlers when they simply return another function call.


---

## Test Coverage Inventory (Audit #5 - Phase 1)

This section tracks outputs from the Test Coverage Gaps audit inventory.

Artifacts:

- js_test_files.txt — Deduplicated list of all JS/TS unit/integration/E2E test files discovered under `frontend/`, `e2e/`, and top-level `tests/`.
- py_test_functions.txt — List of Python test function definitions (with file:line) discovered under `backend/`.

Re-generate locally:

- JS/TS files (zsh):
	- find frontend -type f \( -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" -o -name "*.spec.tsx" -o -name "*.test.js" -o -name "*.test.jsx" -o -name "*.spec.js" -o -name "*.spec.jsx" \)
	- find e2e -type f \( -name "*.spec.ts" -o -name "*.spec.tsx" -o -name "*.test.ts" -o -name "*.test.tsx" \)
	- find tests -type f \( -name "*.test.js" -o -name "*.test.ts" -o -name "*.spec.ts" \)
- Python functions:
	- grep -R --line-number -E '^[[:space:]]*def[[:space:]]+test_[A-Za-z0-9_]+' backend

Notes:

- Node modules are not included when re-generating via the above commands (paths are scoped to project folders).
