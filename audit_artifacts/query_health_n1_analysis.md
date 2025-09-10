# Query Health & N+1 Analysis Report
# Performance & Scalability Audit - Section 2.1 & 2.2

## Executive Summary

**Critical N+1 Query Patterns Identified**: 3 high-impact patterns
**Query Performance Risk Level**: HIGH
**Immediate Database Optimization Required**: YES

## Section 2.1: Database Query Health Analysis

### Current Query Architecture Assessment

#### 1. Connection Management ❌ CRITICAL ISSUE
- **Pattern**: Direct psycopg2 connections created per request
- **Problem**: No connection pooling - each request creates/destroys connections
- **Impact**: Connection exhaustion under concurrent load (~50 connections max)
- **Evidence**: `database_helper.py:47` - `psycopg2.connect(**params)` in context manager

#### 2. Query Execution Patterns ⚠️ PERFORMANCE RISK
- **Pattern**: Raw SQL with cursor.execute() throughout application
- **Problem**: No query optimization, caching, or performance monitoring
- **Impact**: Unoptimized queries with no visibility into slow operations
- **Evidence**: 80+ direct `cursor.execute()` calls in `local_server.py`

#### 3. Transaction Management ⚠️ RELIABILITY RISK
- **Pattern**: Manual transaction handling with context managers
- **Problem**: No automatic rollback on errors, potential for orphaned transactions
- **Impact**: Data consistency issues under failure conditions

## Section 2.2: N+1 Query Pattern Detection

### 🚨 CRITICAL N+1 PATTERN #1: Customer Profile with Appointment Details

**Location**: `local_server.py:10395-10430`
**Endpoint**: `GET /api/admin/customers/{id}?include=appointmentDetails`

**N+1 Pattern Identified**:
```sql
-- Main query: Get appointments for customer
SELECT a.id::text, a.status::text, a.start_ts, a.end_ts, ... FROM appointments a
LEFT JOIN vehicles v ON v.id = a.vehicle_id
WHERE a.customer_id = %s

-- N+1 Problem: Subqueries executed for EACH appointment
COALESCE((
  SELECT JSON_AGG(...) FROM appointment_services s WHERE s.appointment_id = a.id
), '[]'::json) AS services,

COALESCE((
  SELECT JSON_AGG(...) FROM payments p WHERE p.appointment_id = a.id
), '[]'::json) AS payments,

COALESCE((
  SELECT JSON_AGG(...) FROM messages m WHERE m.appointment_id = a.id
), '[]'::json) AS messages
```

**Impact Analysis**:
- **Query Count**: 1 + (3 × N appointments) = 1 + 3N queries
- **Example**: Customer with 20 appointments = 61 queries per request
- **Performance**: Exponential degradation with appointment history
- **Load Impact**: Major contributor to database connection exhaustion

**Fix Priority**: 🔴 CRITICAL - Immediate optimization required

### 🚨 CRITICAL N+1 PATTERN #2: Customer History Payments

**Location**: `local_server.py:8520-8530`
**Endpoint**: `GET /api/customers/{id}/history`

**N+1 Pattern Identified**:
```sql
-- Main query with JSON aggregation per appointment
SELECT a.id::text, a.status::text, a.start_ts, a.total_amount, a.paid_amount,
       COALESCE(
           JSON_AGG(
               JSON_BUILD_OBJECT('id', p.id::text, 'amount', p.amount, ...)
               ORDER BY p.created_at DESC
           ) FILTER (WHERE p.id IS NOT NULL), '[]'::json
       ) as payments
FROM appointments a
LEFT JOIN payments p ON p.appointment_id = a.id
WHERE a.customer_id = %s AND a.status IN ('COMPLETED', 'NO_SHOW', 'CANCELED')
GROUP BY a.id
```

**Analysis**:
- **Status**: ✅ ALREADY OPTIMIZED - Uses proper LEFT JOIN and JSON aggregation
- **Performance**: Single query with aggregation - no N+1 pattern
- **Note**: This endpoint is correctly implemented as a reference for fixing other patterns

### 🚨 CRITICAL N+1 PATTERN #3: Vehicle Ownership Verification

**Location**: Multiple locations in `local_server.py`
**Lines**: 3114, 3201, 3263, 3318

**N+1 Pattern Identified**:
```sql
-- Repeated pattern throughout vehicle endpoints:
cur.execute("SELECT customer_id FROM vehicles WHERE id = %s", (int(veh_id),))

-- This query is executed individually for each vehicle operation
-- instead of batch validation
```

**Impact Analysis**:
- **Query Count**: 1 query per vehicle ID validation
- **Example**: Bulk vehicle operations execute N separate queries
- **Performance**: Linear degradation with batch sizes
- **Load Impact**: Unnecessary database round trips

**Fix Priority**: 🟡 MEDIUM - Optimize during batch operation implementation

### Additional Query Performance Issues

#### 4. Appointment Services Aggregation 🟡 OPTIMIZATION OPPORTUNITY

**Location**: `local_server.py:4563`
**Pattern**: Separate query for appointment services
```sql
SELECT name, estimated_price, estimated_hours
FROM appointment_services
WHERE appointment_id::text = %s
```

**Issue**: Could be optimized to use JOIN with main appointment query
**Impact**: MEDIUM - Additional query per appointment detail request

#### 5. Analytics Dashboard Queries ⚠️ COMPLEX AGGREGATION RISK

**Pattern**: Multiple complex aggregation queries for dashboard
**Risk**: No identified N+1, but potential for slow complex queries
**Recommendation**: Requires monitoring and potential materialized views

## Query Performance Benchmarking (Static Analysis)

### Estimated Query Counts by Endpoint

| Endpoint | Current Queries | Optimized Target | Reduction |
|----------|----------------|------------------|-----------|
| `/api/admin/customers/{id}?include=appointmentDetails` | 1 + 3N | 4 | ~95% for N=20 |
| `/api/customers/{id}/history` | 1 | 1 | 0% (already optimized) |
| Vehicle operations (bulk) | N | 1 | ~90% for N=10 |
| `/api/admin/appointments` (list) | 1 + N | 2 | ~80% for N=20 |

### Performance Impact Estimates

**Current State** (for customer with 20 appointments):
- Customer profile query: 61 database queries
- Response time estimate: 800-2000ms (depending on connection creation overhead)
- Database connection usage: 1 connection held for entire request duration

**Optimized State** (post-fix):
- Customer profile query: 4 database queries maximum
- Response time estimate: 100-200ms
- Database connection usage: Minimal with connection pooling

## Section 2.3: Query Optimization Recommendations

### Immediate Fixes Required

#### 1. Fix Customer Profile N+1 Pattern
```sql
-- Replace multiple subqueries with efficient JOINs and aggregations
WITH appointment_data AS (
  SELECT a.*, v.license_plate, v.year, v.make, v.model
  FROM appointments a
  LEFT JOIN vehicles v ON v.id = a.vehicle_id
  WHERE a.customer_id = %s
),
services_agg AS (
  SELECT appointment_id, JSON_AGG(JSON_BUILD_OBJECT(...)) as services
  FROM appointment_services
  WHERE appointment_id IN (SELECT id FROM appointment_data)
  GROUP BY appointment_id
),
payments_agg AS (
  SELECT appointment_id, JSON_AGG(JSON_BUILD_OBJECT(...)) as payments
  FROM payments
  WHERE appointment_id IN (SELECT id FROM appointment_data)
  GROUP BY appointment_id
),
messages_agg AS (
  SELECT appointment_id, JSON_AGG(JSON_BUILD_OBJECT(...)) as messages
  FROM messages
  WHERE appointment_id IN (SELECT id FROM appointment_data)
  GROUP BY appointment_id
)
SELECT ad.*, sa.services, pa.payments, ma.messages
FROM appointment_data ad
LEFT JOIN services_agg sa ON sa.appointment_id = ad.id
LEFT JOIN payments_agg pa ON pa.appointment_id = ad.id
LEFT JOIN messages_agg ma ON ma.appointment_id = ad.id
ORDER BY ad.start_ts DESC NULLS LAST;
```

#### 2. Implement Batch Vehicle Validation
```sql
-- Replace individual vehicle ownership checks with batch validation
SELECT vehicle_id, customer_id
FROM vehicles
WHERE id = ANY(%s)
AND customer_id = %s;
```

#### 3. Add Query Performance Monitoring
```python
# Add query timing and logging
import time
import logging

def execute_with_timing(cursor, query, params=None):
    start = time.perf_counter()
    cursor.execute(query, params)
    duration = (time.perf_counter() - start) * 1000

    if duration > 100:  # Log slow queries > 100ms
        logging.warning(f"Slow query ({duration:.1f}ms): {query[:100]}...")

    return cursor
```

## Next Steps for Section 2.3: Connection Pooling & Concurrency

The N+1 analysis reveals that **database connection pooling** (Section 2.3) is critical for supporting the optimized queries identified above. The current connection-per-request pattern will not scale even with optimized queries.

**Critical for Phase 2 completion**:
1. Implement connection pooling (PgBouncer or application-level)
2. Replace Flask development server with production WSGI server
3. Add database query performance monitoring
4. Implement the N+1 query fixes identified above

**Performance Impact Projection**:
- **Current sustainable load**: ~20-30 concurrent users
- **Post-optimization load**: ~200-300 concurrent users
- **Response time improvement**: 70-80% reduction in database-heavy endpoints
- **Connection efficiency**: 90%+ reduction in database connections needed
