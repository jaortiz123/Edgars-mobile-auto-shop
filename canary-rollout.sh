#!/bin/bash

# StatusBoardV2 Feature Flag Canary Rollout System
# Implements gradual rollout with monitoring and automated rollback

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CANARY_LOG="${SCRIPT_DIR}/canary-rollout-${TIMESTAMP}.log"

# Rollout stages (percentage of users)
ROLLOUT_STAGES=(10 30 50 100)
STAGE_DURATION=900  # 15 minutes per stage
MONITORING_INTERVAL=60  # Check metrics every 60 seconds

# Thresholds for automatic rollback
ERROR_RATE_THRESHOLD=1.0    # 1% error rate
LATENCY_P95_THRESHOLD=2000  # 2000ms p95 latency
MIN_REQUESTS_FOR_ROLLBACK=10 # Minimum requests before considering rollback

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Environment
STAGING_API="${STAGING_API:-https://staging-api.edgarsautoshop.com}"
FEATURE_FLAG_ENDPOINT="${STAGING_API}/api/admin/feature-flags"
METRICS_ENDPOINT="${STAGING_API}/api/admin/metrics"

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1" | tee -a "$CANARY_LOG"
}

success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅ $1${NC}" | tee -a "$CANARY_LOG"
}

warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️  $1${NC}" | tee -a "$CANARY_LOG"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌ $1${NC}" | tee -a "$CANARY_LOG"
}

# Feature flag control
set_feature_flag() {
    local percentage="$1"
    local enabled="$2"

    log "Setting StatusBoardV2 feature flag: ${percentage}% enabled=${enabled}"

    # In a real implementation, this would call your feature flag service
    # For now, we'll simulate by creating a config file
    cat > "${SCRIPT_DIR}/current-feature-flags.json" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "flags": {
    "statusBoardV2": {
      "enabled": $enabled,
      "percentage": $percentage,
      "rolloutStage": "canary"
    }
  }
}
EOF

    # In production, you would update environment variables or call API:
    # curl -X POST "$FEATURE_FLAG_ENDPOINT" \
    #   -H "Content-Type: application/json" \
    #   -d '{"flag": "statusBoardV2", "enabled": '$enabled', "percentage": '$percentage'}'

    success "Feature flag updated: ${percentage}% rollout"
}

# Metrics collection
get_metrics() {
    local start_time="$1"
    local end_time="$2"

    # Simulate metrics collection (in production, this would query your monitoring system)
    local error_rate=$(echo "scale=2; $(shuf -i 0-200 -n 1) / 100" | bc -l)
    local p95_latency=$(shuf -i 200-1500 -n 1)
    local request_count=$(shuf -i 50-500 -n 1)
    local success_rate=$(echo "scale=2; 100 - $error_rate" | bc -l)

    cat > "${SCRIPT_DIR}/current-metrics.json" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "timeRange": {
    "start": "$start_time",
    "end": "$end_time"
  },
  "statusBoardV2": {
    "errorRate": $error_rate,
    "successRate": $success_rate,
    "p95Latency": $p95_latency,
    "requestCount": $request_count,
    "boardLoadTime": $(shuf -i 300-1200 -n 1),
    "drawerOpenTime": $(shuf -i 50-400 -n 1)
  }
}
EOF

    echo "$error_rate $p95_latency $request_count"
}

# Health check
check_rollout_health() {
    local error_rate="$1"
    local p95_latency="$2"
    local request_count="$3"

    local is_healthy=true
    local issues=()

    # Check error rate
    if (( $(echo "$error_rate > $ERROR_RATE_THRESHOLD" | bc -l) )); then
        is_healthy=false
        issues+=("Error rate ${error_rate}% > ${ERROR_RATE_THRESHOLD}%")
    fi

    # Check latency
    if (( p95_latency > LATENCY_P95_THRESHOLD )); then
        is_healthy=false
        issues+=("P95 latency ${p95_latency}ms > ${LATENCY_P95_THRESHOLD}ms")
    fi

    # Check sufficient traffic
    if (( request_count < MIN_REQUESTS_FOR_ROLLBACK )); then
        warning "Low traffic: ${request_count} requests (min: ${MIN_REQUESTS_FOR_ROLLBACK})"
    fi

    if [ "$is_healthy" = true ]; then
        success "Health check passed: ${error_rate}% errors, ${p95_latency}ms p95"
        return 0
    else
        error "Health check failed: ${issues[*]}"
        return 1
    fi
}

# Rollback function
rollback() {
    local reason="$1"

    error "INITIATING ROLLBACK: $reason"

    # Disable feature flag immediately
    set_feature_flag 0 false

    # Record rollback event
    cat > "${SCRIPT_DIR}/rollback-event-${TIMESTAMP}.json" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "reason": "$reason",
  "previousStage": "$current_stage",
  "rollbackInitiator": "automated-canary-system"
}
EOF

    error "StatusBoardV2 rolled back successfully"
    error "Rollback reason: $reason"

    exit 1
}

# Canary progression
run_canary_stage() {
    local percentage="$1"
    local stage_num="$2"

    log "Starting Stage $stage_num: ${percentage}% rollout for ${STAGE_DURATION}s"

    # Enable feature flag at this percentage
    set_feature_flag "$percentage" true

    local stage_start=$(date +%s)
    local stage_end=$((stage_start + STAGE_DURATION))
    local check_count=0
    local failed_checks=0

    while [ $(date +%s) -lt $stage_end ]; do
        sleep $MONITORING_INTERVAL

        ((check_count++))
        local current_time=$(date +%s)
        local check_start=$((current_time - MONITORING_INTERVAL))

        log "Health check $check_count for ${percentage}% rollout"

        # Get metrics for this interval
        read -r error_rate p95_latency request_count <<< "$(get_metrics "$check_start" "$current_time")"

        # Check health
        if ! check_rollout_health "$error_rate" "$p95_latency" "$request_count"; then
            ((failed_checks++))

            if [ $failed_checks -ge 2 ]; then
                rollback "Multiple consecutive health check failures at ${percentage}% rollout"
            fi

            warning "Health check failed ($failed_checks/2) - continuing monitoring"
        else
            # Reset failed check counter on success
            failed_checks=0
        fi

        # Show remaining time
        local remaining=$((stage_end - current_time))
        log "Stage progress: $((STAGE_DURATION - remaining))/${STAGE_DURATION}s (${remaining}s remaining)"
    done

    success "Stage $stage_num (${percentage}%) completed successfully"
}

# Main canary rollout
main() {
    local command="${1:-start}"

    case "$command" in
        "start")
            echo "========================================"
            echo "🚀 StatusBoardV2 Canary Rollout"
            echo "========================================"
            echo "Timestamp: $(date)"
            echo "Stages: ${ROLLOUT_STAGES[*]}% (${STAGE_DURATION}s each)"
            echo "Monitoring: Every ${MONITORING_INTERVAL}s"
            echo "Log: $CANARY_LOG"
            echo "========================================"
            echo

            # Pre-rollout health check
            log "Pre-rollout baseline check"
            set_feature_flag 0 false
            sleep 30

            read -r baseline_error baseline_latency baseline_requests <<< "$(get_metrics "$(date +%s)" "$(date +%s)")"
            log "Baseline metrics: ${baseline_error}% errors, ${baseline_latency}ms p95, ${baseline_requests} requests"

            # Run canary stages
            for i in "${!ROLLOUT_STAGES[@]}"; do
                local stage=$((i + 1))
                local percentage="${ROLLOUT_STAGES[$i]}"
                current_stage="$percentage"

                run_canary_stage "$percentage" "$stage"

                # Brief pause between stages
                if [ $stage -lt ${#ROLLOUT_STAGES[@]} ]; then
                    log "Pausing 30s before next stage..."
                    sleep 30
                fi
            done

            success "🎉 Canary rollout completed successfully!"
            success "StatusBoardV2 is now at 100% for all users"
            ;;

        "status")
            if [ -f "${SCRIPT_DIR}/current-feature-flags.json" ]; then
                log "Current feature flag status:"
                cat "${SCRIPT_DIR}/current-feature-flags.json" | jq .
            else
                warning "No current feature flag status found"
            fi

            if [ -f "${SCRIPT_DIR}/current-metrics.json" ]; then
                log "Current metrics:"
                cat "${SCRIPT_DIR}/current-metrics.json" | jq .
            else
                warning "No current metrics found"
            fi
            ;;

        "rollback")
            local reason="${2:-Manual rollback requested}"
            rollback "$reason"
            ;;

        "enable")
            local percentage="${2:-100}"
            set_feature_flag "$percentage" true
            success "StatusBoardV2 enabled at ${percentage}%"
            ;;

        "disable")
            set_feature_flag 0 false
            success "StatusBoardV2 disabled"
            ;;

        *)
            echo "Usage: $0 {start|status|rollback|enable|disable}"
            echo
            echo "Commands:"
            echo "  start           - Begin gradual canary rollout"
            echo "  status          - Show current feature flag and metrics"
            echo "  rollback [reason] - Immediately rollback to 0%"
            echo "  enable [%]      - Enable at specific percentage (default: 100%)"
            echo "  disable         - Disable feature flag"
            exit 1
            ;;
    esac
}

# Trap for clean rollback on interruption
trap 'rollback "Script interrupted"' INT TERM

main "$@"
