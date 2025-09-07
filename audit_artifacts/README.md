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
