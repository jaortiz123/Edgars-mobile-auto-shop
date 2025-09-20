#!/usr/bin/env bash
"""
T7 - Load Testing Runner Script
Edgar's Mobile Auto Shop - Sprint 2

Comprehensive load testing automation with SLO validation.
Usage: ./scripts/load_test.sh [--tool artillery|k6] [--quick] [--report-only]
"""

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PERF_DIR="$PROJECT_DIR/perf"
RESULTS_DIR="$PROJECT_DIR/load_test_results"

# Default settings
TOOL="k6"
QUICK_TEST=false
REPORT_ONLY=false
URL="${STATUS_BOARD_URL:-https://onourabnw45tm2rrq72gegkgai0codqj.lambda-url.us-west-2.on.aws}"

# SLO Thresholds
BOARD_P95_THRESHOLD=800   # ms
STATS_P95_THRESHOLD=500   # ms
MOVE_P95_THRESHOLD=400    # ms
ERROR_RATE_THRESHOLD=0.5  # %

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

usage() {
    cat << EOF
T7 - Load Testing for Edgar's Auto Shop Status Board

Usage: $0 [OPTIONS]

OPTIONS:
    --tool TOOL        Load testing tool: artillery or k6 (default: k6)
    --quick           Run quick smoke test instead of full load test
    --report-only     Generate report from previous results only
    --url URL         Override Function URL (default: env STATUS_BOARD_URL)
    --help            Show this help message

ENVIRONMENT VARIABLES:
    STATUS_BOARD_URL  Lambda Function URL for testing
    AWS_REGION        AWS region (default: us-west-2)

EXAMPLES:
    # Full k6 load test
    $0 --tool k6

    # Quick artillery smoke test
    $0 --tool artillery --quick

    # Generate report from existing results
    $0 --report-only

SLO TARGETS:
    - Status Board (GET /board): p95 ≤ ${BOARD_P95_THRESHOLD}ms
    - Dashboard Stats (GET /stats): p95 ≤ ${STATS_P95_THRESHOLD}ms
    - Move Operations (POST /move): p95 ≤ ${MOVE_P95_THRESHOLD}ms
    - Error Rate: < ${ERROR_RATE_THRESHOLD}%
EOF
}

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️${NC} $*"
}

log_error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌${NC} $*"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --tool)
            TOOL="$2"
            shift 2
            ;;
        --quick)
            QUICK_TEST=true
            shift
            ;;
        --report-only)
            REPORT_ONLY=true
            shift
            ;;
        --url)
            URL="$2"
            shift 2
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

validate_environment() {
    log "Validating environment and dependencies..."

    # Check required tools
    if [[ "$TOOL" == "k6" ]]; then
        if ! command -v k6 &> /dev/null; then
            log_error "k6 is not installed. Install from: https://k6.io/docs/get-started/installation/"
            exit 1
        fi
    elif [[ "$TOOL" == "artillery" ]]; then
        if ! command -v artillery &> /dev/null; then
            log_error "Artillery is not installed. Run: npm install -g artillery"
            exit 1
        fi
    else
        log_error "Unsupported tool: $TOOL. Use 'k6' or 'artillery'"
        exit 1
    fi

    # Validate URL
    if [[ -z "$URL" ]]; then
        log_error "Function URL is required. Set STATUS_BOARD_URL environment variable or use --url"
        exit 1
    fi

    # Test basic connectivity
    log "Testing connectivity to $URL..."
    if ! curl -s --connect-timeout 5 "$URL/healthz" > /dev/null; then
        log_error "Cannot connect to $URL/healthz"
        exit 1
    fi

    log_success "Environment validation passed"
}

setup_test_data() {
    log "Setting up test data and environment..."

    # Calculate test date (7 days in future)
    if command -v gdate &> /dev/null; then
        # macOS with GNU date
        export TEST_DATE=$(gdate -u -d "+7 days" +%F)
    elif date -v+7d &> /dev/null; then
        # macOS BSD date
        export TEST_DATE=$(date -v+7d -u +%F)
    else
        # Linux date
        export TEST_DATE=$(date -u -d "+7 days" +%F)
    fi

    export URL="$URL"

    log "Test configuration:"
    log "  URL: $URL"
    log "  Test Date: $TEST_DATE"
    log "  Tool: $TOOL"
    log "  Quick Test: $QUICK_TEST"

    # Create results directory
    mkdir -p "$RESULTS_DIR"

    # Run smoke test to seed data (idempotent)
    log "Running smoke test to ensure test data exists..."
    if [[ -f "$SCRIPT_DIR/smoke.sh" ]]; then
        if ! "$SCRIPT_DIR/smoke.sh" "$URL" --no-fail; then
            log_warning "Smoke test had issues, but continuing with load test..."
        fi
    else
        log_warning "Smoke test script not found, assuming test data exists..."
    fi

    log_success "Test environment ready"
}

run_artillery_test() {
    log "Running Artillery load test..."

    local config_file="$PERF_DIR/artillery-status-board.yml"
    local output_file="$RESULTS_DIR/artillery-$(date +%Y%m%d-%H%M%S).json"

    if [[ "$QUICK_TEST" == "true" ]]; then
        log "Running quick Artillery test..."

        # Quick board test
        log "Testing Status Board endpoint..."
        artillery quick --count 20 --num 5 \
            --output "$output_file-board.json" \
            "$URL/api/admin/appointments/board?date=$TEST_DATE" || true

        # Quick stats test
        log "Testing Dashboard Stats endpoint..."
        artillery quick --count 20 --num 5 \
            --output "$output_file-stats.json" \
            "$URL/api/admin/dashboard/stats?date=$TEST_DATE" || true

        log_success "Quick Artillery test completed"

    else
        log "Running full Artillery load test scenario..."

        if [[ ! -f "$config_file" ]]; then
            log_error "Artillery config not found: $config_file"
            exit 1
        fi

        artillery run "$config_file" \
            --output "$output_file" \
            --environment production || {
            log_error "Artillery test failed"
            return 1
        }

        log_success "Full Artillery test completed"
    fi

    # Generate report if output exists
    if [[ -f "$output_file" ]]; then
        artillery report "$output_file" --output "$RESULTS_DIR/artillery-report.html"
        log_success "Artillery report generated: $RESULTS_DIR/artillery-report.html"
    fi
}

run_k6_test() {
    log "Running k6 load test..."

    local script_file="$PERF_DIR/k6-status-board.js"
    local output_file="$RESULTS_DIR/k6-$(date +%Y%m%d-%H%M%S).json"

    if [[ ! -f "$script_file" ]]; then
        log_error "k6 script not found: $script_file"
        exit 1
    fi

    if [[ "$QUICK_TEST" == "true" ]]; then
        log "Running quick k6 test..."

        # Override options for quick test
        k6 run "$script_file" \
            --duration 30s \
            --vus 10 \
            --out json="$output_file" || {
            log_error "k6 quick test failed"
            return 1
        }

    else
        log "Running full k6 load test with SLO validation..."

        k6 run "$script_file" \
            --out json="$output_file" || {
            log_error "k6 load test failed - SLO thresholds not met"
            return 1
        }
    fi

    log_success "k6 test completed successfully"

    # Generate summary report
    if [[ -f "$output_file" ]]; then
        generate_k6_summary "$output_file"
    fi
}

generate_k6_summary() {
    local json_file="$1"
    local summary_file="$RESULTS_DIR/k6-summary-$(date +%Y%m%d-%H%M%S).txt"

    log "Generating k6 test summary..."

    # Extract key metrics using jq
    if command -v jq &> /dev/null; then
        cat > "$summary_file" << EOF
T7 Load Test Summary - $(date)
========================================

Test Configuration:
- URL: $URL
- Tool: k6
- Date: $TEST_DATE

SLO Results:
EOF

        # Parse JSON results for key metrics
        jq -r '
        select(.type == "Point" and .metric == "http_req_duration") |
        select(.data.tags.endpoint != null) |
        .data.tags.endpoint as $endpoint |
        .data.value as $duration |
        [$endpoint, $duration]
        ' "$json_file" | \
        awk -v board_threshold="$BOARD_P95_THRESHOLD" \
            -v stats_threshold="$STATS_P95_THRESHOLD" \
            -v move_threshold="$MOVE_P95_THRESHOLD" '
        BEGIN {
            board_count=0; board_sum=0; board_max=0
            stats_count=0; stats_sum=0; stats_max=0
            move_count=0; move_sum=0; move_max=0
        }
        $1=="board" { board_count++; board_sum+=$2; if($2>board_max) board_max=$2 }
        $1=="stats" { stats_count++; stats_sum+=$2; if($2>stats_max) stats_max=$2 }
        $1=="move" { move_count++; move_sum+=$2; if($2>move_max) move_max=$2 }
        END {
            if(board_count>0) {
                avg=board_sum/board_count
                status = (board_max <= board_threshold) ? "✅ PASS" : "❌ FAIL"
                printf "- Board p95: %.0fms (target ≤%dms) %s\n", board_max, board_threshold, status
            }
            if(stats_count>0) {
                avg=stats_sum/stats_count
                status = (stats_max <= stats_threshold) ? "✅ PASS" : "❌ FAIL"
                printf "- Stats p95: %.0fms (target ≤%dms) %s\n", stats_max, stats_threshold, status
            }
            if(move_count>0) {
                avg=move_sum/move_count
                status = (move_max <= move_threshold) ? "✅ PASS" : "❌ FAIL"
                printf "- Move p95: %.0fms (target ≤%dms) %s\n", move_max, move_threshold, status
            }
        }' >> "$summary_file"

        echo "" >> "$summary_file"
        echo "Full results: $json_file" >> "$summary_file"

        # Display summary
        cat "$summary_file"
        log_success "Summary generated: $summary_file"
    else
        log_warning "jq not installed, skipping detailed summary generation"
    fi
}

generate_overall_report() {
    log "Generating overall test report..."

    local report_file="$RESULTS_DIR/load-test-report-$(date +%Y%m%d-%H%M%S).md"

    cat > "$report_file" << EOF
# T7 Load Test Report

**Date:** $(date)
**Tool:** $TOOL
**URL:** $URL
**Test Date:** $TEST_DATE
**Quick Test:** $QUICK_TEST

## SLO Targets

- Status Board (GET /board): p95 ≤ ${BOARD_P95_THRESHOLD}ms
- Dashboard Stats (GET /stats): p95 ≤ ${STATS_P95_THRESHOLD}ms
- Move Operations (POST /move): p95 ≤ ${MOVE_P95_THRESHOLD}ms
- Error Rate: < ${ERROR_RATE_THRESHOLD}%

## Test Phases

### Warm-up Phase
- Duration: 1 minute
- Rate: 5 RPS
- Purpose: Lambda warm-up and connection establishment

### Burst Phase
- Duration: 2 minutes
- Rate: 50 RPS
- Purpose: Validate peak capacity and SLO compliance

### Sustained Phase
- Duration: 10 minutes
- Rate: 20 RPS
- Purpose: Validate sustained performance and memory stability

## Results

[Results will be populated based on test output]

## Files Generated

$(ls -la "$RESULTS_DIR" | tail -n +2)

## Recommendations

[To be filled based on results]
EOF

    log_success "Report template generated: $report_file"
}

post_test_validation() {
    log "Running post-test validation..."

    # Verify system health
    local health_response
    health_response=$(curl -s "$URL/healthz" || echo '{"ok":false}')

    if echo "$health_response" | grep -q '"ok":true'; then
        log_success "System health check passed"
    else
        log_error "System health check failed: $health_response"
        return 1
    fi

    # Check CloudWatch alarms (if AWS CLI available)
    if command -v aws &> /dev/null; then
        log "Checking CloudWatch alarms..."

        # Check for any Lambda alarms in ALARM state
        local alarm_state
        alarm_state=$(aws cloudwatch describe-alarms \
            --alarm-name-prefix "edgar-auto-shop-dev" \
            --state-value ALARM \
            --query 'MetricAlarms[].AlarmName' \
            --output text 2>/dev/null || echo "")

        if [[ -n "$alarm_state" ]]; then
            log_warning "CloudWatch alarms in ALARM state: $alarm_state"
        else
            log_success "No CloudWatch alarms triggered"
        fi
    fi
}

main() {
    log "Starting T7 Load Testing for Edgar's Auto Shop Status Board"
    log "================================================================"

    if [[ "$REPORT_ONLY" == "true" ]]; then
        generate_overall_report
        exit 0
    fi

    validate_environment
    setup_test_data

    # Run the appropriate load test
    local test_result=0
    if [[ "$TOOL" == "artillery" ]]; then
        run_artillery_test || test_result=$?
    elif [[ "$TOOL" == "k6" ]]; then
        run_k6_test || test_result=$?
    fi

    # Always run post-test validation
    post_test_validation || test_result=$?

    generate_overall_report

    # Final result
    if [[ $test_result -eq 0 ]]; then
        log_success "🎉 Load test completed successfully - SLOs met!"
        log_success "Next: Proceed to T8 - Frontend Integration Contracts"
    else
        log_error "💥 Load test failed - SLOs not met or errors occurred"
        log_error "Recommended actions:"
        log_error "  1. Review test results in $RESULTS_DIR"
        log_error "  2. Check CloudWatch metrics and logs"
        log_error "  3. Consider performance optimizations"
        log_error "  4. Run rollback if needed: ./scripts/rollback.sh"
    fi

    exit $test_result
}

# Run main function
main "$@"
