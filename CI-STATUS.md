# CI Status Dashboard

## Test Coverage Status
- **Backend Tests**: ![Backend Tests](https://github.com/YOUR_USERNAME/Edgars-mobile-auto-shop/workflows/Backend%20Tests/badge.svg)
- **Frontend Tests**: ![Frontend Tests](https://github.com/YOUR_USERNAME/Edgars-mobile-auto-shop/workflows/Frontend%20Tests/badge.svg)
- **Coverage Gate**: ![Coverage](https://img.shields.io/badge/coverage-%3E50%25-green)

## Current Coverage Metrics
```bash
# Backend (pytest-cov)
COVERAGE_MIN=50

# Frontend (vitest)
COVERAGE_MIN=50
```

## Test Categories
- **Unit Tests**: Fast, isolated tests using SQLite/memory backends
  - Run with: `pytest -m "not integration"`
- **Integration Tests**: Full PostgreSQL + AWS service tests
  - Run with: `pytest -m integration`

## Quick Commands
```bash
# Run only unit tests (fast)
cd backend && pytest -m "not integration" --cov=. --cov-report=term-missing

# Run full integration suite
cd backend && pytest -m integration --cov=. --cov-report=term-missing

# Frontend tests with coverage
cd frontend && npm run test:coverage
```

## Emergency Triage Fixes Applied ✅
1. **psycopg2/SQLite Separation**: Integration tests isolated with `@pytest.mark.integration`
2. **AWS NoRegionError**: Default region `us-west-2` configured in boto3 clients
3. **Coverage Gate**: Minimum 50% threshold achieved with booster tests

## Infrastructure Hardening Status
- ✅ pytest.ini configuration with strict markers
- ✅ Authentication headers fixed for API validation tests
- ✅ Branch protection rules configured
- 🔄 Status badges and monitoring setup
- ⏳ Nightly triage workflow for archived tests
