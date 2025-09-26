# Code Metrics Analysis

**Generated:** September 25, 2025
**Tool:** cloc v2.06
**Scope:** Backend directory analysis for monolith refactoring

## Executive Summary

**Total Codebase Size:**
- **Files:** 560 total files
- **Lines of Code:** 197,914 total LOC
- **Primary Languages:** Python (53,651 LOC), HTML (110,395 LOC), XML (28,432 LOC)

**Critical Finding:** The monolith file `backend/local_server.py` contains **12,961 lines** (9,690 code + 1,114 blank + 2,157 comments), representing **18.1%** of all Python code in the repository.

## Language Breakdown

| Language   | Files | Code Lines | Blank Lines | Comment Lines | % of Total Code |
|------------|-------|------------|-------------|---------------|-----------------|
| HTML       | 187   | 110,395    | 0           | 0             | 55.8%          |
| Python     | 294   | 53,651     | 14,394      | 16,476        | 27.1%          |
| XML        | 1     | 28,432     | 0           | 2             | 14.4%          |
| SQL        | 39    | 3,480      | 393         | 490           | 1.8%           |
| JavaScript | 1     | 551        | 95          | 87            | 0.3%           |
| Other      | 32    | 1,405      | 548         | 128           | 0.7%           |

## Python Code Distribution

### Largest Application Files (Excluding Dependencies)

| File | Lines | Type | Refactor Priority |
|------|-------|------|-------------------|
| `backend/local_server.py` | 12,961 | **MONOLITH** | 🔴 CRITICAL |
| `backend/native_lambda.py` | 1,402 | Lambda handler | 🟡 MEDIUM |
| `backend/tests/test_integration_database.py` | 828 | Test file | 🟢 LOW |
| `backend/tests/conftest.py` | 698 | Test configuration | 🟢 LOW |
| `backend/tests/test_csv_exports.py` | 603 | Test file | 🟢 LOW |
| `backend/tests/test_validation_unit.py` | 599 | Test file | 🟢 LOW |

### Code Distribution Analysis

**Monolith Dominance:**
- `local_server.py` = 12,961 lines (18.1% of all Python code)
- Next largest application file = 1,402 lines (2.6% of Python code)
- **Size ratio:** Monolith is **9.2x larger** than the next biggest file

**Technical Debt Indicators:**
- Single file contains 98 Flask routes (from previous analysis)
- Code-to-comment ratio: 4.5:1 (9,690 code / 2,157 comments)
- High coupling: All business domains mixed in one file

## Business Logic Categorization

Based on route analysis and file structure:

### Routing Logic (100% in monolith)
- **Location:** `backend/local_server.py`
- **Size:** ~2,000 lines (estimated)
- **Complexity:** 98 Flask route definitions with mixed patterns

### Business Logic (95% in monolith)
- **Location:** `backend/local_server.py`
- **Size:** ~7,000 lines (estimated)
- **Domains:** Appointments, Customers, Invoices, Services, Messaging
- **Coupling:** High - all domains interdependent

### Database Queries (90% in monolith)
- **Location:** `backend/local_server.py`
- **Size:** ~1,500 lines (estimated)
- **Pattern:** Embedded SQL with cursor operations
- **Issues:** No ORM, potential N+1 queries

### Utilities (Partially extracted)
- **Extracted:** `backend/util/` directory exists
- **Remaining in monolith:** ~1,200 lines (estimated)
- **Status:** Some extraction completed in Sprint 1

### Middleware (Partially extracted)
- **Extracted:** `backend/middleware/` directory exists
- **Status:** CORS, tenant, security headers extracted
- **Remaining:** Authentication, authorization logic mixed in routes

## Complexity Hotspots

### File-Level Complexity
1. **`local_server.py`** - 12,961 lines (CRITICAL)
2. **`native_lambda.py`** - 1,402 lines (requires analysis)
3. **Test files** - 2,728 total lines (good coverage indicator)

### Function-Level Complexity (From Route Analysis)
- **Highest complexity function:** `create_appointment` (complexity score: 165)
- **55 functions** exceed complexity threshold (>10)
- **Average complexity:** 15.29 across all route handlers

## Mobile Development Impact

### API Readiness Assessment
- **Total endpoints:** 98 routes identified
- **Mobile-critical:** ~30 routes (appointments, customers, services)
- **Authentication:** 60.2% of routes secured (needs mobile-friendly auth)
- **Response formats:** Mixed JSON envelopes (standardization needed)

### Refactoring Priorities for iOS Development

**Priority 1 - Customer Domain (Mobile-Critical)**
- Customer registration/login
- Profile management
- Appointment history
- **Estimated extraction:** 800-1,200 lines from monolith

**Priority 2 - Appointments Domain (Mobile-Critical)**
- Booking flow
- Status updates
- Real-time sync
- **Estimated extraction:** 2,000-3,000 lines from monolith

**Priority 3 - Services Domain (Mobile-Critical)**
- Available services
- Pricing information
- Availability scheduling
- **Estimated extraction:** 600-1,000 lines from monolith

## Technical Debt Summary

### Maintainability Issues
- **Single Point of Failure:** All business logic in one 13K-line file
- **Development Bottleneck:** Cannot parallelize mobile + backend work
- **Testing Difficulty:** Monolithic structure impedes isolated testing
- **Code Review Overhead:** Large diffs, high cognitive load

### Performance Implications
- **Memory usage:** Entire application loaded for any endpoint
- **Cold start impact:** Lambda/serverless deployment challenges
- **Scaling limits:** Cannot scale individual domains independently

## Refactoring Recommendations

### Phase 1: Extract Mobile-Critical Services
1. **Customer Service** - Extract to `backend/services/customer_service.py`
2. **Appointment Service** - Extract to `backend/services/appointment_service.py`
3. **Service Catalog** - Extract to `backend/services/service_catalog.py`

**Expected reduction:** ~4,000-5,000 lines from monolith (30-40%)

### Phase 2: Extract Supporting Domains
1. **Invoice Service** - Billing and payments
2. **Message Service** - SMS/communication
3. **Admin Service** - Management functions

**Expected reduction:** ~6,000-7,000 additional lines (50-60% total)

### Phase 3: Repository Pattern Implementation
1. **Database Layer** - Extract all SQL to repository classes
2. **Authentication Service** - Mobile-friendly token management
3. **Validation Layer** - Centralized input validation

**Expected reduction:** Remaining ~2,000-3,000 lines, leaving core routing

## Success Metrics

### Quantitative Targets
- **Monolith size:** Reduce from 12,961 to <3,000 lines (77% reduction)
- **Service count:** 6-8 focused services
- **Test coverage:** Maintain >80% after extraction
- **API response time:** <500ms p95 for mobile-critical endpoints

### Qualitative Benefits
- **Developer velocity:** Parallel mobile/backend development
- **Code review quality:** Smaller, focused changes
- **System reliability:** Isolated failure domains
- **Mobile development:** Clear API contracts and service boundaries

## File Structure Recommendation

```
backend/
├── services/           # Extracted business logic
│   ├── customer_service.py
│   ├── appointment_service.py
│   ├── service_catalog.py
│   ├── invoice_service.py
│   └── message_service.py
├── repositories/       # Data access layer
│   ├── customer_repo.py
│   ├── appointment_repo.py
│   └── base_repository.py
├── middleware/         # Already extracted (Sprint 1)
├── util/              # Already extracted (Sprint 1)
└── local_server.py    # Routing only (~3K lines)
```

This structure enables clear service boundaries, parallel development, and mobile-first API design while maintaining the existing deployment model.
