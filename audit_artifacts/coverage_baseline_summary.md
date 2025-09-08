# Coverage Baseline Summary (Phase 2 - Task 1)

This document summarizes baseline coverage results for frontend (Vitest) and backend (pytest-cov).

To reproduce locally:

Frontend:

- cd frontend && npm ci && npx vitest run --coverage --maxConcurrency=2
- Artifacts: frontend/coverage/coverage-summary.json, frontend/coverage/lcov.info, frontend/coverage/lcov-report/
- Baseline (from 2025-09-08 run):

	- Lines: 27.24%
	- Statements: 27.24%
	- Functions: 60.00%
	- Branches: 66.56%
		- Note: global thresholds are currently set to 80% and will fail the run; this is expected for the baseline capture.

Backend:

- source .venv/bin/activate
- pip install -U pytest pytest-cov
- pytest -q \
	--cov=backend --cov-branch \\
	--cov-report=xml:audit_artifacts/coverage_backend.xml \\
	--cov-report=json:audit_artifacts/coverage_backend.json \\
	--cov-report=term-missing

Artifacts checklist:

- audit_artifacts/coverage_backend.xml
- audit_artifacts/coverage_backend.json
- frontend/coverage/coverage-summary.json
- frontend/coverage/lcov.info
- audit_artifacts/coverage_frontend_summary.json (copied)
- audit_artifacts/coverage_frontend_lcov.info (copied)

Delta notes (2025-09-08):

- Full frontend suite stabilized at 0 failures prior to coverage run.
- Coverage artifacts updated after stabilization; coverage remains below 60% target, next step is uplift.
- Enforced thresholds (80%) caused exit code 1, as expected during baseline capture.

- Tightened coverage excludes to focus on product code (mocks, stories, e2e harness, test helpers excluded).
- Added focused unit tests (utils.parseDurationToMinutes, lib/vehicleApi) to begin coverage uplift.

Latest run details (2025-09-08 #2):

- After adding tests for lib/customerProfileApi and lib/availabilityService, re-ran with coverage.
- Test summary: 100 files passed | 1 skipped; 551 tests passed | 4 skipped.
- Coverage improved slightly: Lines 27.24%, Statements 27.24%, Functions 60.00%, Branches 66.56%.

Latest run details (2025-09-08 #3):

- Added small unit test covering lib index exports (prefs/timezone).
- Test summary: 101 files passed | 1 skipped; 553 tests passed | 4 skipped.
- Coverage nudged again: Lines 27.32%, Statements 27.32%, Functions 60.04%, Branches 66.80%.

Delta vs previous baseline:

- Prior delta: Lines +0.93pp (26.20% -> 27.13%), Statements +0.93pp (26.20% -> 27.13%), Functions +2.27pp (57.50% -> 59.77%), Branches -0.48pp (66.90% -> 66.42%)
- Latest delta vs prior run: Lines +0.11pp (27.13% -> 27.24%), Statements +0.11pp (27.13% -> 27.24%), Functions +0.23pp (59.77% -> 60.00%), Branches +0.14pp (66.42% -> 66.56%)
- Delta vs #2: Lines +0.08pp (27.24% -> 27.32%), Statements +0.08pp (27.24% -> 27.32%), Functions +0.04pp (60.00% -> 60.04%), Branches +0.24pp (66.56% -> 66.80%)

Latest run details (2025-09-08 #4):

- CustomersPage navigation test selector updated to use accessible role+name; reran full suite with coverage.
- Test summary: 101 files passed | 1 skipped; 553 tests passed | 4 skipped.
- Coverage unchanged from #3 due to selector-only change: Lines 27.32%, Statements 27.32%, Functions 60.04%, Branches 66.80%.

Latest run details (2025-09-08 #5):

- Regenerated coverage artifacts after stabilization verification on current working tree.
- Test summary: 101 files passed | 1 skipped; 553 tests passed | 4 skipped.
- Coverage: Lines 27.32%, Statements 27.32%, Functions 60.04%, Branches 66.80% (threshold 80% expected to fail).

Next steps:

- Raise FE coverage toward ≥60% by targeting low-covered high-impact files (e.g., src/lib/api.ts, admin pages/components with 0%).
- Temporarily set NO_COVERAGE=1 for stabilization runs; re-enable enforcement after uplift.

Note: If backend tests cannot run due to Docker/testcontainers, use audit_artifacts/backend_coverage_alternative.sh to gather proxy metrics and proceed with frontend coverage. Then re-run backend coverage after Docker is available.
