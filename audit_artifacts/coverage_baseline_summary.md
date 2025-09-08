# Coverage Baseline Summary (Phase 2 - Task 1)

This document summarizes baseline coverage results for frontend (Vitest) and backend (pytest-cov).

To reproduce locally:

Frontend:

- cd frontend && npm ci && npx vitest run --coverage --maxConcurrency=2
- Artifacts: frontend/coverage/coverage-summary.json, frontend/coverage/lcov.info, frontend/coverage/lcov-report/
- Baseline (from latest run):
	- Lines: 24.07%
	- Statements: 24.07%
	- Functions: 54.36%
	- Branches: 67.17%
	- Note: global thresholds are currently set to 80% and will fail the run; this is expected for the baseline capture.

Backend:

- source .venv/bin/activate
- pip install -U pytest pytest-cov
- pytest -q \
	--cov=backend --cov-branch \
	--cov-report=xml:audit_artifacts/coverage_backend.xml \
	--cov-report=json:audit_artifacts/coverage_backend.json \
	--cov-report=term-missing

Artifacts checklist:

- audit_artifacts/coverage_backend.xml
- audit_artifacts/coverage_backend.json
- frontend/coverage/coverage-summary.json
- frontend/coverage/lcov.info
- audit_artifacts/coverage_frontend_summary.json (copied)
- audit_artifacts/coverage_frontend_lcov.info (copied)

Note: If backend tests cannot run due to Docker/testcontainers, use audit_artifacts/backend_coverage_alternative.sh to gather proxy metrics and proceed with frontend coverage. Then re-run backend coverage after Docker is available.
