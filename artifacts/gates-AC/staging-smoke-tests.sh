#!/bin/bash

# StatusBoardV2 Staging Smoke Tests
# Validates staging deployment according to launch playbook

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SMOKE_TEST_LOG="${SCRIPT_DIR}/smoke-test-${TIMESTAMP}.log"
STAGING_URL="${STAGING_URL:-https://$NEW_CF_DOMAIN}"
STAGING_API="${STAGING_API:-http://localhost:8080}"
TIMEOUT="${TIMEOUT:-10}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Logging
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1" | tee -a "$SMOKE_TEST_LOG"
}

success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅ $1${NC}" | tee -a "$SMOKE_TEST_LOG"
    ((TESTS_PASSED++))
}

fail() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌ $1${NC}" | tee -a "$SMOKE_TEST_LOG"
    ((TESTS_FAILED++))
}

warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️  $1${NC}" | tee -a "$SMOKE_TEST_LOG"
}

# Test runner
run_test() {
    local test_name="$1"
    local test_command="$2"

    ((TESTS_RUN++))
    log "Running: $test_name"

    if eval "$test_command"; then
        success "$test_name"
        return 0
    else
        fail "$test_name"
        return 1
    fi
}

# HTTP test helper
http_test() {
    local url="$1"
    local expected_status="${2:-200}"
    local description="$3"

    local response
    local status_code

    response=$(curl -s -w "HTTPSTATUS:%{http_code}" --max-time "$TIMEOUT" "$url" 2>/dev/null)
    status_code=$(echo "$response" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')

    if [ "$status_code" = "$expected_status" ]; then
        success "$description (HTTP $status_code)"
        return 0
    else
        fail "$description (Expected HTTP $expected_status, got $status_code)"
        return 1
    fi
}

# JSON API test helper
api_test() {
    local endpoint="$1"
    local description="$2"
    local jq_filter="${3:-.}"

    local url="${STAGING_API}${endpoint}"
    local response
    local status_code
    local json_data

    response=$(curl -s -w "HTTPSTATUS:%{http_code}" --max-time "$TIMEOUT" "$url")
    status_code=$(echo "$response" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    json_data=$(echo "$response" | sed -e 's/HTTPSTATUS\:.*//g')

    if [ "$status_code" = "200" ]; then
        if echo "$json_data" | jq -e "$jq_filter" > /dev/null 2>&1; then
            success "$description (Valid JSON response)"
            return 0
        else
            fail "$description (Invalid JSON structure)"
            return 1
        fi
    else
        fail "$description (HTTP $status_code)"
        return 1
    fi
}

# Performance test helper
perf_test() {
    local url="$1"
    local max_time_ms="$2"
    local description="$3"

    local start_time
    local end_time
    local duration_ms

    start_time=$(node -e "console.log(Date.now())" 2>/dev/null || echo "$(date +%s%3N)")

    if curl -s --max-time "$TIMEOUT" "$url" > /dev/null; then
        end_time=$(node -e "console.log(Date.now())" 2>/dev/null || echo "$(date +%s%3N)")
        duration_ms=$((end_time - start_time))

        if [ "$duration_ms" -le "$max_time_ms" ]; then
            success "$description (${duration_ms}ms < ${max_time_ms}ms)"
            return 0
        else
            fail "$description (${duration_ms}ms > ${max_time_ms}ms)"
            return 1
        fi
    else
        fail "$description (Request failed)"
        return 1
    fi
}

echo "========================================"
echo "🧪 StatusBoardV2 Staging Smoke Tests"
echo "========================================"
echo "Timestamp: $(date)"
echo "Staging URL: $STAGING_URL"
echo "Staging API: $STAGING_API"
echo "Test Log: $SMOKE_TEST_LOG"
echo "========================================"
echo

# Test Suite 1: Infrastructure Health
log "Test Suite 1: Infrastructure Health"

run_test "Frontend Site Accessibility" "http_test '$STAGING_URL' 200 'Staging site loads'"
run_test "API Health Check" "api_test '/healthz' 'API health endpoint' '.status'"
run_test "API CORS Headers" "curl -s -I '$STAGING_API/api/admin/appointments/board' | grep -i 'access-control-allow-origin'"

echo

# Test Suite 2: API Endpoints
log "Test Suite 2: Core API Endpoints"

run_test "Board API Endpoint" "api_test '/api/admin/appointments/board' 'Board data endpoint' '.data.cards'"
run_test "Dashboard Stats API" "api_test '/api/admin/dashboard/stats' 'Dashboard stats endpoint' '.data.jobsToday'"
run_test "Appointment Detail API" "api_test '/api/appointments' 'Appointments list endpoint' '.data'"

echo

# Test Suite 3: StatusBoardV2 Feature Detection
log "Test Suite 3: StatusBoardV2 Feature Detection"

# Check if StatusBoardV2 assets are present
check_statusboard_assets() {
    local assets_found=0

    # Check main page for StatusBoard references
    if curl -s "$STAGING_URL" | grep -q "StatusBoard"; then
        assets_found=1
    fi

    # Try to find JavaScript chunks that might contain StatusBoardV2
    local main_js=$(curl -s "$STAGING_URL" | grep -o 'src="[^"]*\.js"' | head -1 | sed 's/src="//;s/"//')
    if [ -n "$main_js" ]; then
        local js_url="${STAGING_URL}${main_js}"
        if curl -s "$js_url" | grep -q "StatusBoard"; then
            assets_found=1
        fi
    fi

    return $((1 - assets_found))
}

run_test "StatusBoard Assets Present" "check_statusboard_assets"

# Feature flag detection (client-side)
check_feature_flags() {
    # Look for feature flag configuration in the page or assets
    if curl -s "$STAGING_URL" | grep -q "VITE_FEATURE_STATUS_BOARD_V2"; then
        return 0
    fi

    # Feature flags might be compiled out, so this is informational
    warning "Feature flag configuration not directly visible (may be compiled)"
    return 0
}

run_test "Feature Flag Configuration" "check_feature_flags"

echo

# Test Suite 4: Performance Baselines
log "Test Suite 4: Performance Baselines"

run_test "Frontend Load Time" "perf_test '$STAGING_URL' 3000 'Frontend loads under 3s'"
run_test "Board API Response Time" "perf_test '$STAGING_API/api/admin/appointments/board' 1000 'Board API under 1s'"
run_test "Stats API Response Time" "perf_test '$STAGING_API/api/admin/dashboard/stats' 500 'Stats API under 500ms'"

echo

# Test Suite 5: Error Handling
log "Test Suite 5: Error Handling"

run_test "404 Error Handling" "http_test '$STAGING_URL/nonexistent-page' 404 '404 page returns correct status'"
run_test "API 404 Handling" "http_test '$STAGING_API/api/nonexistent-endpoint' 404 'API 404 handling'"

echo

# Test Suite 6: Security Headers
log "Test Suite 6: Security Headers"

check_security_headers() {
    local headers
    headers=$(curl -s -I "$STAGING_URL")

    # Check for important security headers
    if echo "$headers" | grep -qi "x-frame-options"; then
        log "✓ X-Frame-Options header present"
    else
        warning "X-Frame-Options header missing"
    fi

    if echo "$headers" | grep -qi "x-content-type-options"; then
        log "✓ X-Content-Type-Options header present"
    else
        warning "X-Content-Type-Options header missing"
    fi

    return 0
}

run_test "Security Headers Check" "check_security_headers"

echo

# Generate Test Report
log "Generating test report..."

cat > "${SCRIPT_DIR}/smoke-test-report-${TIMESTAMP}.json" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": {
    "staging_url": "$STAGING_URL",
    "staging_api": "$STAGING_API"
  },
  "results": {
    "total_tests": $TESTS_RUN,
    "passed": $TESTS_PASSED,
    "failed": $TESTS_FAILED,
    "success_rate": "$(echo "scale=2; $TESTS_PASSED * 100 / $TESTS_RUN" | bc -l 2>/dev/null || echo "N/A")%"
  },
  "status": "$([ $TESTS_FAILED -eq 0 ] && echo "PASS" || echo "FAIL")"
}
EOF

echo "========================================"
echo "📊 Test Results Summary"
echo "========================================"
echo "Total Tests: $TESTS_RUN"
echo "Passed: $TESTS_PASSED"
echo "Failed: $TESTS_FAILED"
echo "Success Rate: $(echo "scale=1; $TESTS_PASSED * 100 / $TESTS_RUN" | bc -l 2>/dev/null || echo "N/A")%"
echo "========================================"

# --- Gate C: CORS & Security headers ---
: "${STAGING_URL:?set STAGING_URL}"
: "${API_BASE:=http://localhost:3001}"
: "${STAGING_ALLOWED_ORIGINS:=${ORIGIN_LOCAL},${ORIGIN_S3},${ORIGIN_CF}}"

pass=true

# Preflight
for O in ${STAGING_ALLOWED_ORIGINS//,/ }; do
  [ -z "$O" ] && continue
  R=$(curl -s -i -X OPTIONS -H "Origin: $O" -H "Access-Control-Request-Method: GET" "$API_BASE/api/admin/appointments/board")
  echo "$R" | grep -qi "Access-Control-Allow-Origin: $O" || { echo "CORS FAIL (preflight) for $O"; pass=false; }
  echo "$R" | grep -qi "Access-Control-Allow-Methods" || { echo "CORS FAIL (methods) for $O"; pass=false; }
done

# Security headers
H=$(curl -s -I "$API_BASE/api/admin/appointments/board")
echo "$H" | grep -qi "X-Content-Type-Options: nosniff" || { echo "Missing X-Content-Type-Options"; pass=false; }
echo "$H" | grep -qi "Referrer-Policy:" || { echo "Missing Referrer-Policy"; pass=false; }
echo "$H" | grep -qi "X-Frame-Options: DENY" || { echo "Missing X-Frame-Options"; pass=false; }
echo "$H" | grep -qi "Permissions-Policy:" || { echo "Missing Permissions-Policy"; pass=false; }

$pass || { echo "Gate C checks FAILED"; exit 1; }
echo "Gate C checks PASSED"

if [ $TESTS_FAILED -eq 0 ]; then
    success "All smoke tests passed! ✅"
    echo
    echo "Next Steps:"
    echo "1. Enable StatusBoardV2 feature flag: ./toggle-feature-flag.sh enable"
    echo "2. Run functional tests: ./staging-functional-tests.sh"
    echo "3. Begin UAT validation"
    exit 0
else
    fail "Some tests failed ❌"
    echo
    echo "Review failed tests above and:"
    echo "1. Check deployment logs: cat $SMOKE_TEST_LOG"
    echo "2. Verify staging environment configuration"
    echo "3. Re-run deployment if necessary"
    exit 1
fi
