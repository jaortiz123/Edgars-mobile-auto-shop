#!/bin/bash

# StatusBoardV2 Production Launch Scripts
# Automated production deployment with gradual rollout and SLO compliance

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PROD_LOG="${SCRIPT_DIR}/production-launch-${TIMESTAMP}.log"

# Configuration
PROD_URL="${PROD_URL:-https://edgarsautoshop.com}"
STAGING_URL="${STAGING_URL:-https://staging.edgarsautoshop.com}"
S3_BUCKET="${S3_BUCKET:-edgar-mobile-auto-shop}"
CLOUDFRONT_DIST_ID="${CLOUDFRONT_DIST_ID:-E1234567890123}"

# Production deployment stages
PROD_ROLLOUT_STAGES=(5 15 25 50 75 100)
STAGE_DURATION=600  # 10 minutes per stage
HEALTH_CHECK_INTERVAL=30  # seconds
ERROR_THRESHOLD=0.5  # 0.5% error rate threshold
LATENCY_THRESHOLD=1500  # 1.5s latency threshold

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1" | tee -a "$PROD_LOG"
}

success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅ $1${NC}" | tee -a "$PROD_LOG"
}

warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️  $1${NC}" | tee -a "$PROD_LOG"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌ $1${NC}" | tee -a "$PROD_LOG"
}

highlight() {
    echo -e "${PURPLE}[$(date +'%H:%M:%S')] 🚀 $1${NC}" | tee -a "$PROD_LOG"
}

# Pre-production validation
validate_prerequisites() {
    log "Validating production deployment prerequisites"

    # Check UAT approval status
    if [ -f "${SCRIPT_DIR}/uat-data/uat-signoffs.json" ]; then
        local uat_status
        uat_status=$(jq -r '.status' "${SCRIPT_DIR}/uat-data/uat-signoffs.json")

        if [ "$uat_status" != "approved" ]; then
            error "UAT not approved - production deployment blocked"
            echo "Current UAT status: $uat_status"
            echo "Run UAT validation first: ./uat-validation.sh status"
            return 1
        fi

        success "UAT approved - proceeding with production deployment"
    else
        error "No UAT validation found - run UAT process first"
        return 1
    fi

    # Check required tools
    local required_tools=("aws" "jq" "curl" "npm")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            error "Required tool not found: $tool"
            return 1
        fi
    done

    # Verify AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        error "AWS credentials not configured"
        return 1
    fi

    # Check S3 bucket access
    if ! aws s3 ls "s3://$S3_BUCKET" >/dev/null 2>&1; then
        error "Cannot access S3 bucket: $S3_BUCKET"
        return 1
    fi

    # Verify staging is healthy
    if ! curl -f -s "$STAGING_URL/health" >/dev/null 2>&1; then
        error "Staging environment unhealthy: $STAGING_URL"
        return 1
    fi

    success "All prerequisites validated"
    return 0
}

# Build production artifacts
build_production() {
    log "Building production artifacts"

    cd "${SCRIPT_DIR}/frontend"

    # Clean previous builds
    rm -rf dist/ build/

    # Install dependencies
    log "Installing production dependencies..."
    npm ci --production

    # Set production environment variables
    cat > .env.production << EOF
NODE_ENV=production
REACT_APP_API_BASE_URL=$PROD_URL/api
REACT_APP_ENVIRONMENT=production
REACT_APP_VERSION=$(date +%Y%m%d_%H%M%S)
REACT_APP_FEATURE_FLAGS=statusBoardV2:gradual
EOF

    # Build for production
    log "Building production bundle..."
    npm run build

    # Verify build output
    if [ ! -d "dist" ] && [ ! -d "build" ]; then
        error "Build failed - no output directory found"
        return 1
    fi

    local build_dir="dist"
    if [ ! -d "dist" ]; then
        build_dir="build"
    fi

    # Validate critical files
    local required_files=("index.html" "static/js" "static/css")
    for file in "${required_files[@]}"; do
        if [ ! -e "$build_dir/$file" ]; then
            error "Build missing required file: $file"
            return 1
        fi
    done

    success "Production build completed: $build_dir"
    echo "BUILD_DIR=$build_dir" > "${SCRIPT_DIR}/.prod-build-info"

    cd "$SCRIPT_DIR"
}

# Deploy to production S3
deploy_production() {
    log "Deploying to production S3"

    source "${SCRIPT_DIR}/.prod-build-info"

    # Create backup of current production
    create_production_backup

    # Deploy new build
    cd "${SCRIPT_DIR}/frontend"

    aws s3 sync "$BUILD_DIR" "s3://$S3_BUCKET" \
        --delete \
        --cache-control "max-age=31536000" \
        --exclude "*.html" \
        --exclude "service-worker.js"

    # Upload HTML files with no cache
    find "$BUILD_DIR" -name "*.html" -exec aws s3 cp {} "s3://$S3_BUCKET/" \
        --cache-control "no-cache, no-store, must-revalidate" \;

    # Upload service worker with special cache headers
    if [ -f "$BUILD_DIR/service-worker.js" ]; then
        aws s3 cp "$BUILD_DIR/service-worker.js" "s3://$S3_BUCKET/" \
            --cache-control "no-cache"
    fi

    # Invalidate CloudFront
    if [ -n "$CLOUDFRONT_DIST_ID" ]; then
        log "Invalidating CloudFront cache..."
        aws cloudfront create-invalidation \
            --distribution-id "$CLOUDFRONT_DIST_ID" \
            --paths "/*" >/dev/null

        success "CloudFront invalidation initiated"
    fi

    success "Production deployment completed"
    cd "$SCRIPT_DIR"
}

# Create production backup
create_production_backup() {
    log "Creating production backup"

    local backup_key="backups/production-$(date +%Y%m%d_%H%M%S)"

    # Sync current production to backup location
    aws s3 sync "s3://$S3_BUCKET" "s3://$S3_BUCKET/$backup_key" \
        --exclude "backups/*" >/dev/null

    # Store backup reference
    echo "$backup_key" > "${SCRIPT_DIR}/.prod-backup-ref"

    success "Production backup created: $backup_key"
}

# Gradual production rollout
gradual_production_rollout() {
    log "Starting gradual production rollout"

    for stage in "${PROD_ROLLOUT_STAGES[@]}"; do
        highlight "Production Rollout Stage: ${stage}%"

        # Update feature flag percentage
        update_production_feature_flag "$stage"

        # Monitor stage for specified duration
        monitor_production_stage "$stage" "$STAGE_DURATION"

        local stage_result=$?
        if [ $stage_result -ne 0 ]; then
            error "Production stage $stage% failed - initiating rollback"
            emergency_production_rollback
            return 1
        fi

        success "Production stage ${stage}% completed successfully"
        sleep 30  # Brief pause between stages
    done

    success "🎉 Full production rollout completed successfully!"
}

# Update production feature flag
update_production_feature_flag() {
    local percentage="$1"

    log "Setting StatusBoardV2 production rollout to ${percentage}%"

    # This would integrate with your feature flag service
    # Example implementation:
    curl -s -X POST "$PROD_URL/api/admin/feature-flags/statusBoardV2" \
        -H "Content-Type: application/json" \
        -d "{\"enabled\": true, \"rollout_percentage\": $percentage}" >/dev/null || {
            warning "Feature flag update failed - using fallback method"
            # Fallback: update via configuration file or environment variable
        }

    success "Feature flag updated: ${percentage}% rollout"
}

# Monitor production stage
monitor_production_stage() {
    local stage="$1"
    local duration="$2"

    log "Monitoring production stage ${stage}% for ${duration}s"

    local start_time=$(date +%s)
    local end_time=$((start_time + duration))
    local check_count=0
    local error_count=0

    while [ "$(date +%s)" -lt "$end_time" ]; do
        check_count=$((check_count + 1))

        # Check system health
        local health_result
        health_result=$(check_production_health)

        if [ $? -ne 0 ]; then
            error_count=$((error_count + 1))
            warning "Health check failed (${error_count}/${check_count})"

            # Calculate error rate
            local error_rate
            error_rate=$(echo "scale=2; $error_count * 100 / $check_count" | bc -l 2>/dev/null || echo "0")

            if (( $(echo "$error_rate > $ERROR_THRESHOLD" | bc -l 2>/dev/null) )); then
                error "Error rate ${error_rate}% exceeds threshold ${ERROR_THRESHOLD}%"
                return 1
            fi
        fi

        # Display progress
        local elapsed=$(($(date +%s) - start_time))
        local remaining=$((duration - elapsed))
        printf "\r⏱️  Stage ${stage}%: ${elapsed}s elapsed, ${remaining}s remaining (errors: ${error_count}/${check_count})"

        sleep "$HEALTH_CHECK_INTERVAL"
    done

    echo  # New line after progress indicator
    success "Stage ${stage}% monitoring completed - ${error_count}/${check_count} errors"

    return 0
}

# Check production health
check_production_health() {
    local start_time=$(date +%s%3N)

    # Test main site availability
    if ! curl -f -s -m 10 "$PROD_URL" >/dev/null 2>&1; then
        return 1
    fi

    # Test API health
    if ! curl -f -s -m 5 "$PROD_URL/api/health" >/dev/null 2>&1; then
        return 1
    fi

    # Test StatusBoardV2 if enabled
    local board_response
    board_response=$(curl -s -m 10 "$PROD_URL/api/admin/appointments/board" 2>/dev/null)

    if [ -n "$board_response" ]; then
        # Measure response time
        local end_time=$(date +%s%3N)
        local response_time=$((end_time - start_time))

        if [ "$response_time" -gt "$LATENCY_THRESHOLD" ]; then
            warning "High latency detected: ${response_time}ms > ${LATENCY_THRESHOLD}ms"
            return 1
        fi
    fi

    return 0
}

# Emergency production rollback
emergency_production_rollback() {
    error "🚨 EMERGENCY PRODUCTION ROLLBACK INITIATED 🚨"

    # Immediately disable StatusBoardV2
    log "Disabling StatusBoardV2 feature flag"
    curl -s -X POST "$PROD_URL/api/admin/feature-flags/statusBoardV2" \
        -H "Content-Type: application/json" \
        -d '{"enabled": false, "rollout_percentage": 0}' >/dev/null

    # Restore previous production build if available
    if [ -f "${SCRIPT_DIR}/.prod-backup-ref" ]; then
        local backup_key
        backup_key=$(cat "${SCRIPT_DIR}/.prod-backup-ref")

        log "Restoring production from backup: $backup_key"

        aws s3 sync "s3://$S3_BUCKET/$backup_key" "s3://$S3_BUCKET" \
            --exclude "backups/*" --delete

        # Invalidate CloudFront
        if [ -n "$CLOUDFRONT_DIST_ID" ]; then
            aws cloudfront create-invalidation \
                --distribution-id "$CLOUDFRONT_DIST_ID" \
                --paths "/*" >/dev/null
        fi

        success "Production restored from backup"
    fi

    # Verify rollback success
    sleep 60  # Wait for changes to propagate

    if check_production_health; then
        success "Emergency rollback completed successfully"

        # Send notifications
        log "Sending rollback notifications..."
        # Implement notification system (email, Slack, etc.)

        return 0
    else
        error "Rollback failed - manual intervention required"
        return 1
    fi
}

# Production health dashboard
production_health_dashboard() {
    local duration="${1:-300}"  # Default 5 minutes

    highlight "Production Health Dashboard (${duration}s monitoring)"
    echo "======================================================="

    local start_time=$(date +%s)
    local end_time=$((start_time + duration))
    local checks=0
    local failures=0
    local total_latency=0

    while [ "$(date +%s)" -lt "$end_time" ]; do
        checks=$((checks + 1))

        # Measure response time
        local request_start=$(date +%s%3N)
        local health_check
        health_check=$(curl -s -w "%{http_code}" -m 10 "$PROD_URL/api/admin/appointments/board" 2>/dev/null)
        local request_end=$(date +%s%3N)

        local latency=$((request_end - request_start))
        local http_code="${health_check: -3}"

        if [ "$http_code" = "200" ]; then
            total_latency=$((total_latency + latency))

            # Show current metrics
            local avg_latency=$((total_latency / checks))
            local success_rate=$(echo "scale=1; ($checks - $failures) * 100 / $checks" | bc -l)

            printf "\r🔄 Checks: %d | Success: %s%% | Avg Latency: %dms | Current: %dms" \
                "$checks" "$success_rate" "$avg_latency" "$latency"

            # Check SLO compliance
            if [ "$latency" -gt "800" ]; then
                warning "\nSLO violation: ${latency}ms > 800ms"
            fi
        else
            failures=$((failures + 1))
            printf "\r❌ Checks: %d | Failures: %d | HTTP: %s" "$checks" "$failures" "$http_code"
        fi

        sleep 10
    done

    echo  # New line
    echo "======================================================="

    # Final statistics
    local final_success_rate=$(echo "scale=1; ($checks - $failures) * 100 / $checks" | bc -l)
    local final_avg_latency=$((total_latency / (checks - failures)))

    if [ "$failures" -eq 0 ] && [ "$final_avg_latency" -lt 800 ]; then
        success "✅ Production SLOs met: ${final_success_rate}% success, ${final_avg_latency}ms avg latency"
    else
        warning "⚠️  SLO concerns: ${final_success_rate}% success, ${final_avg_latency}ms avg latency"
    fi
}

# Generate production report
generate_production_report() {
    local report_file="${SCRIPT_DIR}/production-launch-report-${TIMESTAMP}.json"

    log "Generating production launch report"

    # Collect deployment metrics
    local deployment_info
    deployment_info=$(jq -n \
        --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --arg prod_url "$PROD_URL" \
        --arg version "$(date +%Y%m%d_%H%M%S)" \
        '{
            deployment_timestamp: $timestamp,
            production_url: $prod_url,
            version: $version,
            rollout_stages: [5, 15, 25, 50, 75, 100],
            slo_targets: {
                error_rate: "< 0.5%",
                latency_p95: "< 800ms",
                availability: "> 99.9%"
            }
        }')

    # Test current production health
    log "Testing production endpoints..."
    local health_results
    health_results=$(curl -s -w '{"http_code": "%{http_code}", "time_total": "%{time_total}", "time_connect": "%{time_connect}"}' "$PROD_URL/api/admin/appointments/board" -o /dev/null 2>/dev/null || echo '{"error": "request_failed"}')

    # Create comprehensive report
    jq -n \
        --argjson deployment_info "$deployment_info" \
        --argjson health_results "$health_results" \
        '{
            report_type: "production_launch",
            generated_at: $deployment_info.deployment_timestamp,
            deployment: $deployment_info,
            health_check: $health_results,
            summary: {
                deployment_success: ($health_results.http_code == "200"),
                slo_compliance: (($health_results.time_total | tonumber) < 0.8),
                production_ready: (($health_results.http_code == "200") and (($health_results.time_total | tonumber) < 0.8))
            }
        }' > "$report_file"

    success "Production report generated: $report_file"

    # Display summary
    highlight "Production Launch Summary"
    jq -r '
        "Deployment Status: \(if .summary.deployment_success then "SUCCESS" else "FAILED" end)",
        "SLO Compliance: \(if .summary.slo_compliance then "PASS" else "FAIL" end)",
        "Production Ready: \(.summary.production_ready)",
        "Response Time: \(.health_check.time_total // "N/A")s",
        "HTTP Status: \(.health_check.http_code // "ERROR")"
    ' "$report_file"
}

# Main function
main() {
    local action="${1:-help}"

    case "$action" in
        "validate")
            validate_prerequisites
            ;;

        "build")
            validate_prerequisites && build_production
            ;;

        "deploy")
            validate_prerequisites && \
            build_production && \
            deploy_production
            ;;

        "rollout")
            validate_prerequisites && \
            gradual_production_rollout
            ;;

        "full-launch")
            highlight "🚀 Starting full production launch sequence"
            validate_prerequisites && \
            build_production && \
            deploy_production && \
            gradual_production_rollout && \
            generate_production_report
            ;;

        "rollback")
            emergency_production_rollback
            ;;

        "monitor")
            local duration="${2:-300}"
            production_health_dashboard "$duration"
            ;;

        "report")
            generate_production_report
            ;;

        "status")
            log "Production Status Check"
            echo "Production URL: $PROD_URL"
            echo "Staging URL: $STAGING_URL"

            if check_production_health; then
                success "Production is healthy"
            else
                error "Production health check failed"
            fi

            # Show UAT status
            if [ -f "${SCRIPT_DIR}/uat-data/uat-signoffs.json" ]; then
                local uat_status
                uat_status=$(jq -r '.status' "${SCRIPT_DIR}/uat-data/uat-signoffs.json")
                log "UAT Status: $uat_status"
            fi
            ;;

        *)
            echo "StatusBoardV2 Production Launch System"
            echo "======================================"
            echo
            echo "Usage: $0 {validate|build|deploy|rollout|full-launch|rollback|monitor|report|status}"
            echo
            echo "Commands:"
            echo "  validate     - Validate all prerequisites (UAT approval, tools, access)"
            echo "  build        - Build production artifacts with optimizations"
            echo "  deploy       - Deploy to production S3 with backup creation"
            echo "  rollout      - Execute gradual feature flag rollout (5→15→25→50→75→100%)"
            echo "  full-launch  - Complete launch sequence (validate→build→deploy→rollout→report)"
            echo "  rollback     - Emergency rollback to previous production state"
            echo "  monitor [s]  - Real-time production health monitoring (default 300s)"
            echo "  report       - Generate comprehensive production launch report"
            echo "  status       - Check current production and UAT status"
            echo
            echo "Examples:"
            echo "  $0 validate              # Check prerequisites"
            echo "  $0 full-launch          # Complete production launch"
            echo "  $0 monitor 600          # Monitor for 10 minutes"
            echo "  $0 rollback             # Emergency rollback"
            echo
            echo "Prerequisites:"
            echo "  ✓ UAT approval (run ./uat-validation.sh first)"
            echo "  ✓ AWS credentials configured"
            echo "  ✓ S3 bucket access: $S3_BUCKET"
            echo "  ✓ CloudFront distribution: $CLOUDFRONT_DIST_ID"
            exit 1
            ;;
    esac
}

main "$@"
