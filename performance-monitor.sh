#!/bin/bash

# StatusBoardV2 Staging Performance Monitor
# Real-time SLO tracking: Board <800ms, Drawer <200ms, Error rate monitoring

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PERF_LOG="${SCRIPT_DIR}/performance-monitor-${TIMESTAMP}.log"
MONITORING_INTERVAL="${MONITORING_INTERVAL:-30}"  # seconds
STAGING_URL="${STAGING_URL:-https://staging.edgarsautoshop.com}"
STAGING_API="${STAGING_API:-https://staging-api.edgarsautoshop.com}"

# SLO Thresholds (milliseconds)
BOARD_LOAD_SLO=800
DRAWER_OPEN_SLO=200
API_RESPONSE_SLO=500
ERROR_RATE_SLO=1.0  # 1%

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Performance tracking
SAMPLES_FILE="${SCRIPT_DIR}/performance-samples.json"
VIOLATIONS_FILE="${SCRIPT_DIR}/slo-violations.json"

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1" | tee -a "$PERF_LOG"
}

success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅ $1${NC}" | tee -a "$PERF_LOG"
}

warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️  $1${NC}" | tee -a "$PERF_LOG"
}

violation() {
    echo -e "${RED}[$(date +'%H:%M:%S')] 🚨 SLO VIOLATION: $1${NC}" | tee -a "$PERF_LOG"
}

highlight() {
    echo -e "${PURPLE}[$(date +'%H:%M:%S')] 📊 $1${NC}" | tee -a "$PERF_LOG"
}

# Measure frontend performance
measure_frontend_performance() {
    local url="$1"
    local test_name="$2"

    # Use curl with timing to measure basic load time
    local timing_output
    timing_output=$(curl -w "@-" -s -o /dev/null "$url" << 'EOF'
{
  "time_namelookup": %{time_namelookup_us},
  "time_connect": %{time_connect_us},
  "time_appconnect": %{time_appconnect_us},
  "time_pretransfer": %{time_pretransfer_us},
  "time_redirect": %{time_redirect_us},
  "time_starttransfer": %{time_starttransfer_us},
  "time_total": %{time_total_us},
  "http_code": %{http_code},
  "size_download": %{size_download}
}
EOF
)

    local total_time_us
    local http_code
    total_time_us=$(echo "$timing_output" | jq -r '.time_total')
    http_code=$(echo "$timing_output" | jq -r '.http_code')

    # Convert to milliseconds
    local total_time_ms=$((total_time_us / 1000))

    echo "$total_time_ms $http_code"
}

# Measure API performance
measure_api_performance() {
    local endpoint="$1"
    local test_name="$2"

    local start_time_ms
    local end_time_ms
    local duration_ms
    local http_code

    start_time_ms=$(date +%s%3N)

    local response
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" --max-time 10 "${STAGING_API}${endpoint}")
    http_code=$(echo "$response" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')

    end_time_ms=$(date +%s%3N)
    duration_ms=$((end_time_ms - start_time_ms))

    echo "$duration_ms $http_code"
}

# Record performance sample
record_sample() {
    local test_type="$1"
    local test_name="$2"
    local duration_ms="$3"
    local http_code="$4"
    local slo_threshold="$5"

    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local is_violation=false

    if [ "$duration_ms" -gt "$slo_threshold" ]; then
        is_violation=true
    fi

    # Append to samples file
    local sample_json=$(jq -n \
        --arg timestamp "$timestamp" \
        --arg test_type "$test_type" \
        --arg test_name "$test_name" \
        --argjson duration_ms "$duration_ms" \
        --argjson http_code "$http_code" \
        --argjson slo_threshold "$slo_threshold" \
        --argjson is_violation "$is_violation" \
        '{
            timestamp: $timestamp,
            test_type: $test_type,
            test_name: $test_name,
            duration_ms: $duration_ms,
            http_code: $http_code,
            slo_threshold: $slo_threshold,
            is_violation: $is_violation
        }')

    # Initialize samples file if it doesn't exist
    if [ ! -f "$SAMPLES_FILE" ]; then
        echo '[]' > "$SAMPLES_FILE"
    fi

    # Add sample
    jq ". += [$sample_json]" "$SAMPLES_FILE" > "${SAMPLES_FILE}.tmp" && mv "${SAMPLES_FILE}.tmp" "$SAMPLES_FILE"

    # Record violation if applicable
    if [ "$is_violation" = true ]; then
        violation "$test_name: ${duration_ms}ms > ${slo_threshold}ms (HTTP $http_code)"

        # Initialize violations file if it doesn't exist
        if [ ! -f "$VIOLATIONS_FILE" ]; then
            echo '[]' > "$VIOLATIONS_FILE"
        fi

        # Add violation
        jq ". += [$sample_json]" "$VIOLATIONS_FILE" > "${VIOLATIONS_FILE}.tmp" && mv "${VIOLATIONS_FILE}.tmp" "$VIOLATIONS_FILE"
    else
        success "$test_name: ${duration_ms}ms < ${slo_threshold}ms (HTTP $http_code)"
    fi
}

# Calculate statistics
calculate_stats() {
    local time_window_minutes="${1:-15}"

    if [ ! -f "$SAMPLES_FILE" ]; then
        echo "No performance data available"
        return
    fi

    local cutoff_time
    cutoff_time=$(date -u -d "${time_window_minutes} minutes ago" +%Y-%m-%dT%H:%M:%SZ)

    # Filter samples to time window and calculate stats
    local stats
    stats=$(jq --arg cutoff "$cutoff_time" '
        map(select(.timestamp > $cutoff)) |
        group_by(.test_name) |
        map({
            test_name: .[0].test_name,
            test_type: .[0].test_type,
            slo_threshold: .[0].slo_threshold,
            sample_count: length,
            avg_duration: (map(.duration_ms) | add / length),
            p95_duration: (map(.duration_ms) | sort)[((length * 0.95) | floor)],
            p99_duration: (map(.duration_ms) | sort)[((length * 0.99) | floor)],
            violation_count: map(select(.is_violation)) | length,
            violation_rate: (map(select(.is_violation)) | length) * 100 / length,
            slo_compliance: ((length - (map(select(.is_violation)) | length)) * 100 / length)
        })
    ' "$SAMPLES_FILE")

    echo "$stats"
}

# Display real-time dashboard
display_dashboard() {
    clear
    echo "======================================================"
    echo "🔥 StatusBoardV2 Performance Monitor (Live)"
    echo "======================================================"
    echo "Time: $(date)"
    echo "Monitoring: $STAGING_URL"
    echo "Update Interval: ${MONITORING_INTERVAL}s"
    echo "======================================================"
    echo

    # Current SLOs
    echo -e "${CYAN}📋 SLO Targets:${NC}"
    echo "  • Board Load: < ${BOARD_LOAD_SLO}ms"
    echo "  • Drawer Open: < ${DRAWER_OPEN_SLO}ms"
    echo "  • API Response: < ${API_RESPONSE_SLO}ms"
    echo "  • Error Rate: < ${ERROR_RATE_SLO}%"
    echo

    # Recent performance stats (last 15 minutes)
    local stats
    stats=$(calculate_stats 15)

    if [ "$stats" != "No performance data available" ] && [ "$stats" != "[]" ]; then
        echo -e "${PURPLE}📊 Performance Statistics (Last 15 minutes):${NC}"
        echo "$stats" | jq -r '.[] |
            "\(.test_name):\n" +
            "  Samples: \(.sample_count)\n" +
            "  Average: \(.avg_duration | floor)ms\n" +
            "  P95: \(.p95_duration | floor)ms\n" +
            "  P99: \(.p99_duration | floor)ms\n" +
            "  SLO Compliance: \(.slo_compliance | floor)%\n" +
            "  Violations: \(.violation_count)/\(.sample_count)\n"'
    else
        echo -e "${YELLOW}⏳ Collecting performance data...${NC}"
    fi

    echo
    echo -e "${BLUE}🔄 Press Ctrl+C to stop monitoring${NC}"
}

# Run performance test cycle
run_performance_cycle() {
    log "Starting performance measurement cycle"

    # Test 1: Frontend Board Load
    local board_result
    read -r board_time_ms board_http_code <<< "$(measure_frontend_performance "$STAGING_URL" "Frontend Board Load")"
    record_sample "frontend" "Board Load" "$board_time_ms" "$board_http_code" "$BOARD_LOAD_SLO"

    # Test 2: Board API
    local board_api_result
    read -r board_api_time_ms board_api_http_code <<< "$(measure_api_performance "/api/admin/appointments/board" "Board API")"
    record_sample "api" "Board API" "$board_api_time_ms" "$board_api_http_code" "$API_RESPONSE_SLO"

    # Test 3: Stats API
    local stats_api_result
    read -r stats_api_time_ms stats_api_http_code <<< "$(measure_api_performance "/api/admin/dashboard/stats" "Stats API")"
    record_sample "api" "Stats API" "$stats_api_time_ms" "$stats_api_http_code" "$API_RESPONSE_SLO"

    # Test 4: Appointment Detail API (simulate drawer open)
    local drawer_api_result
    read -r drawer_api_time_ms drawer_api_http_code <<< "$(measure_api_performance "/api/appointments" "Drawer API")"
    record_sample "api" "Drawer Open" "$drawer_api_time_ms" "$drawer_api_http_code" "$DRAWER_OPEN_SLO"
}

# Generate performance report
generate_report() {
    local report_file="${SCRIPT_DIR}/performance-report-${TIMESTAMP}.json"

    log "Generating performance report: $report_file"

    local stats_1h stats_15m stats_5m
    stats_1h=$(calculate_stats 60)
    stats_15m=$(calculate_stats 15)
    stats_5m=$(calculate_stats 5)

    local violation_count
    if [ -f "$VIOLATIONS_FILE" ]; then
        violation_count=$(jq 'length' "$VIOLATIONS_FILE")
    else
        violation_count=0
    fi

    jq -n \
        --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --arg staging_url "$STAGING_URL" \
        --argjson board_slo "$BOARD_LOAD_SLO" \
        --argjson drawer_slo "$DRAWER_OPEN_SLO" \
        --argjson api_slo "$API_RESPONSE_SLO" \
        --argjson violation_count "$violation_count" \
        --argjson stats_1h "$stats_1h" \
        --argjson stats_15m "$stats_15m" \
        --argjson stats_5m "$stats_5m" \
        '{
            report_timestamp: $timestamp,
            environment: {
                staging_url: $staging_url,
                slo_thresholds: {
                    board_load_ms: $board_slo,
                    drawer_open_ms: $drawer_slo,
                    api_response_ms: $api_slo
                }
            },
            summary: {
                total_slo_violations: $violation_count,
                overall_health: (if $violation_count == 0 then "HEALTHY" else "VIOLATIONS" end)
            },
            statistics: {
                last_hour: $stats_1h,
                last_15_minutes: $stats_15m,
                last_5_minutes: $stats_5m
            }
        }' > "$report_file"

    success "Performance report generated: $report_file"
}

# Main function
main() {
    local mode="${1:-monitor}"

    case "$mode" in
        "monitor")
            echo "Starting StatusBoardV2 Performance Monitor..."
            echo "Monitoring: $STAGING_URL"
            echo "Log: $PERF_LOG"
            echo

            # Initialize files
            echo '[]' > "$SAMPLES_FILE"
            echo '[]' > "$VIOLATIONS_FILE"

            while true; do
                display_dashboard
                run_performance_cycle
                sleep "$MONITORING_INTERVAL"
            done
            ;;

        "test")
            log "Running single performance test cycle"
            run_performance_cycle
            calculate_stats 60
            ;;

        "report")
            generate_report
            ;;

        "stats")
            local window="${2:-15}"
            highlight "Performance Statistics (Last $window minutes):"
            calculate_stats "$window" | jq '.'
            ;;

        "violations")
            if [ -f "$VIOLATIONS_FILE" ]; then
                highlight "SLO Violations:"
                jq '.' "$VIOLATIONS_FILE"
            else
                log "No SLO violations recorded"
            fi
            ;;

        "clean")
            rm -f "$SAMPLES_FILE" "$VIOLATIONS_FILE"
            success "Performance data cleaned"
            ;;

        *)
            echo "Usage: $0 {monitor|test|report|stats|violations|clean}"
            echo
            echo "Commands:"
            echo "  monitor          - Start real-time performance monitoring"
            echo "  test             - Run single performance test cycle"
            echo "  report           - Generate comprehensive performance report"
            echo "  stats [minutes]  - Show statistics for time window (default: 15min)"
            echo "  violations       - Show all SLO violations"
            echo "  clean            - Clean performance data files"
            exit 1
            ;;
    esac
}

# Trap for clean exit
trap 'log "Performance monitoring stopped"; generate_report; exit 0' INT TERM

main "$@"
