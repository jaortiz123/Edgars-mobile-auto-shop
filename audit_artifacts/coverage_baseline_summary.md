# Test Coverage Baseline Report
*Generated: $(date)*

## Executive Summary
**Status**: Baseline coverage analysis complete with Docker connectivity issues requiring alternative approaches.

### Frontend Coverage Analysis
- **Test Runner**: Vitest with coverage enabled
- **Total Test Files**: 183 JS/TS files across frontend, e2e, tests directories
- **Test Status**: 29 failed | 492 passed | 4 skipped (525 total)
- **Key Issues Identified**:
  - AccessibilityProvider context errors in 10 test files
  - MSW (Mock Service Worker) unmatched requests
  - UI state coverage gaps requiring landmark/ARIA improvements
  - Multiple navigation roles causing accessibility test failures

### Backend Coverage Analysis
- **Test Runner**: pytest with pytest-cov
- **Status**: BLOCKED - Docker daemon connectivity timeout
- **Root Cause**: testcontainers PostgreSQL setup requires Docker daemon
- **Test Function Inventory**: 395 Python test functions cataloged
- **Alternative Needed**: Mock database approach or Docker fix required

## Detailed Findings

### Frontend Test Results
```
Test Files  6 failed | 89 passed | 1 skipped (96)
Tests       29 failed | 492 passed | 4 skipped (525)
Duration    23.10s
```

**Critical Issues**:
1. **Accessibility Provider Context**: 10 InvoiceDetailPage tests failing due to missing AccessibilityProvider wrapper
2. **MSW Configuration**: Unmatched API requests suggesting mock setup issues
3. **Component State Coverage**: UI state tests revealing accessibility violations:
   - Missing landmark regions for page content
   - Loading states without screen reader announcements
   - Error states missing ARIA live regions

### Backend Analysis Constraints
- **Docker Dependency**: All backend tests require PostgreSQL testcontainer
- **Timeout Error**: `docker.errors.DockerException: Read timed out (60s)`
- **Test Infrastructure**: Hardcoded session-level PostgreSQL container startup in conftest.py
- **Impact**: Cannot generate baseline backend coverage metrics

## Coverage Configuration Status
✅ **Backend .coveragerc**: Created with 85% threshold, branch coverage, XML/HTML/JSON outputs
✅ **Python Environment**: Configured with pytest-cov, pytest-xdist, pytest-randomly
✅ **Frontend Integration**: Vitest coverage enabled and executed
❌ **Backend Execution**: Blocked by Docker connectivity

## Next Steps Priority

### Immediate (Task 1 Completion)
1. **Fix Docker Issue**: Investigate Docker daemon connectivity or implement alternative
2. **Mock Database Approach**: Consider pytest fixtures with in-memory database
3. **Generate Backend Coverage**: Execute pytest coverage once Docker resolved

### Phase 2 Tasks (Pending Task 1)
1. **Diff Coverage Setup**: Configure diff-cover for ≥90% PR coverage gating
2. **Mutation Testing**: Implement mutmut POC for test quality measurement
3. **Flake Detection**: Set up pytest-rerunfailures for consistency validation

## Configuration Artifacts
- ✅ `.coveragerc`: Backend coverage configuration
- ✅ `audit_artifacts/htmlcov/`: Coverage HTML output directory
- ✅ Coverage thresholds: 85% global, branch coverage enabled
- ✅ Test inventory: Complete catalog of 183 JS/TS + 395 Python tests

## Risk Assessment
- **High**: Backend coverage unavailable due to Docker dependency
- **Medium**: Frontend test failures indicate quality issues needing attention
- **Low**: Configuration and environment setup complete and validated

---
*Report generated as part of Audit #5 Phase 2 Task 1 - Generate Baseline Coverage Reports*
