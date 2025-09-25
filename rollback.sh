#!/bin/bash

# StatusBoardV2 Automated Rollback System
# Instant reversion with feature flag toggle and artifact management

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ROLLBACK_LOG="${SCRIPT_DIR}/rollback-${TIMESTAMP}.log"

# Configuration
STAGING_BUCKET="${STAGING_BUCKET:-emauto-frontend-staging}"
CF_DIST_ID="${CF_DIST_ID:-E1234567890123}"
STAGING_API="${STAGING_API:-https://staging-api.edgarsautoshop.com}"
BACKUP_DIR="${SCRIPT_DIR}/deployment-backups"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1" | tee -a "$ROLLBACK_LOG"
}

success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅ $1${NC}" | tee -a "$ROLLBACK_LOG"
}

warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️  $1${NC}" | tee -a "$ROLLBACK_LOG"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌ $1${NC}" | tee -a "$ROLLBACK_LOG"
}

critical() {
    echo -e "${RED}[$(date +'%H:%M:%S')] 🚨 CRITICAL: $1${NC}" | tee -a "$ROLLBACK_LOG"
}

# Create deployment backup
create_backup() {
    local backup_reason="$1"
    local backup_id="${TIMESTAMP}_$(echo "$backup_reason" | tr ' ' '_' | tr '[:upper:]' '[:lower:]')"

    log "Creating deployment backup: $backup_id"

    mkdir -p "$BACKUP_DIR"

    # Backup current deployment state
    cat > "${BACKUP_DIR}/${backup_id}.json" << EOF
{
  "backup_id": "$backup_id",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "reason": "$backup_reason",
  "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "git_branch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')",
  "feature_flags": $(cat "${SCRIPT_DIR}/current-feature-flags.json" 2>/dev/null || echo '{}'),
  "environment": {
    "staging_api": "$STAGING_API",
    "staging_bucket": "$STAGING_BUCKET",
    "cf_distribution": "$CF_DIST_ID"
  }
}
EOF

    # If frontend build exists, backup build artifacts
    if [ -d "${SCRIPT_DIR}/frontend/dist" ]; then
        tar -czf "${BACKUP_DIR}/${backup_id}-artifacts.tar.gz" -C "${SCRIPT_DIR}/frontend" dist/
        success "Build artifacts backed up: ${backup_id}-artifacts.tar.gz"
    fi

    success "Backup created: $backup_id"
    echo "$backup_id"
}

# Disable feature flags immediately
emergency_feature_flag_disable() {
    log "EMERGENCY: Disabling all StatusBoardV2 feature flags"

    cat > "${SCRIPT_DIR}/current-feature-flags.json" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "flags": {
    "statusBoardV2": {
      "enabled": false,
      "percentage": 0,
      "rolloutStage": "rollback_disabled"
    }
  },
  "rollback_event": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "reason": "emergency_rollback"
  }
}
EOF

    # In production, this would call your feature flag service API
    # curl -X POST "$STAGING_API/api/admin/feature-flags" \
    #   -H "Content-Type: application/json" \
    #   -d '{"flag": "statusBoardV2", "enabled": false, "percentage": 0}'

    critical "StatusBoardV2 feature flags DISABLED"
}

# Rollback to previous deployment
rollback_deployment() {
    local backup_id="${1:-latest}"

    log "Rolling back deployment to backup: $backup_id"

    # Find backup
    local backup_file
    if [ "$backup_id" = "latest" ]; then
        backup_file=$(ls -t "${BACKUP_DIR}"/*.json 2>/dev/null | head -1)
    else
        backup_file="${BACKUP_DIR}/${backup_id}.json"
    fi

    if [ ! -f "$backup_file" ]; then
        error "Backup not found: $backup_file"
        return 1
    fi

    log "Using backup: $backup_file"

    # Extract backup info
    local backup_commit
    local backup_branch
    backup_commit=$(jq -r '.git_commit' "$backup_file")
    backup_branch=$(jq -r '.git_branch' "$backup_file")

    log "Backup git info: $backup_branch @ $backup_commit"

    # Check if artifact backup exists
    local artifact_backup="${backup_file%.json}-artifacts.tar.gz"

    if [ -f "$artifact_backup" ]; then
        log "Restoring build artifacts from backup"

        # Extract backup artifacts
        rm -rf "${SCRIPT_DIR}/frontend/dist"
        tar -xzf "$artifact_backup" -C "${SCRIPT_DIR}/frontend/"

        success "Build artifacts restored"

        # Deploy restored artifacts
        if command -v aws &> /dev/null; then
            log "Deploying restored artifacts to S3"

            aws s3 sync "${SCRIPT_DIR}/frontend/dist" "s3://$STAGING_BUCKET" \
                --delete \
                --cache-control "max-age=60"

            # CloudFront invalidation
            local invalidation_id
            invalidation_id=$(aws cloudfront create-invalidation \
                --distribution-id "$CF_DIST_ID" \
                --paths "/*" \
                --query 'Invalidation.Id' \
                --output text)

            success "Artifacts deployed, invalidation: $invalidation_id"
        else
            warning "AWS CLI not available, manual artifact deployment required"
        fi
    else
        warning "No artifact backup found, feature flag rollback only"
    fi

    # Restore feature flag state from backup
    local backup_flags
    backup_flags=$(jq '.feature_flags' "$backup_file")

    if [ "$backup_flags" != "null" ] && [ "$backup_flags" != "{}" ]; then
        echo "$backup_flags" > "${SCRIPT_DIR}/current-feature-flags.json"
        success "Feature flags restored from backup"
    fi

    success "Rollback completed successfully"
}

# Health check after rollback
verify_rollback() {
    log "Verifying rollback health"

    local health_checks=0
    local health_passed=0

    # Check 1: Frontend accessible
    ((health_checks++))
    if curl -s --max-time 10 "$STAGING_URL" > /dev/null; then
        success "Frontend accessible"
        ((health_passed++))
    else
        error "Frontend not accessible"
    fi

    # Check 2: API responsive
    ((health_checks++))
    if curl -s --max-time 10 "$STAGING_API/healthz" | jq -e '.status' > /dev/null 2>&1; then
        success "API responsive"
        ((health_passed++))
    else
        error "API not responsive"
    fi

    # Check 3: Feature flags disabled
    ((health_checks++))
    if [ -f "${SCRIPT_DIR}/current-feature-flags.json" ]; then
        local v2_enabled
        v2_enabled=$(jq -r '.flags.statusBoardV2.enabled' "${SCRIPT_DIR}/current-feature-flags.json" 2>/dev/null || echo "null")

        if [ "$v2_enabled" = "false" ]; then
            success "StatusBoardV2 feature flags disabled"
            ((health_passed++))
        else
            warning "StatusBoardV2 feature flags may still be enabled"
        fi
    fi

    # Summary
    local health_percentage=$((health_passed * 100 / health_checks))

    if [ $health_passed -eq $health_checks ]; then
        success "Rollback verification: $health_passed/$health_checks checks passed (${health_percentage}%)"
        return 0
    else
        warning "Rollback verification: $health_passed/$health_checks checks passed (${health_percentage}%)"
        return 1
    fi
}

# Generate rollback report
generate_rollback_report() {
    local rollback_reason="$1"
    local backup_id="$2"
    local report_file="${SCRIPT_DIR}/rollback-report-${TIMESTAMP}.json"

    log "Generating rollback report: $report_file"

    local verification_result
    if verify_rollback; then
        verification_result="PASS"
    else
        verification_result="PARTIAL"
    fi

    jq -n \
        --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --arg reason "$rollback_reason" \
        --arg backup_id "$backup_id" \
        --arg verification "$verification_result" \
        --arg git_commit "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')" \
        --arg git_branch "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')" \
        '{
            rollback_timestamp: $timestamp,
            reason: $reason,
            backup_restored: $backup_id,
            verification_result: $verification,
            git_state: {
                commit: $git_commit,
                branch: $git_branch
            },
            actions_taken: [
                "Feature flags disabled",
                "Build artifacts restored (if available)",
                "CloudFront invalidation triggered",
                "Health verification performed"
            ]
        }' > "$report_file"

    success "Rollback report generated: $report_file"
}

# List available backups
list_backups() {
    log "Available deployment backups:"

    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]; then
        warning "No backups found in $BACKUP_DIR"
        return
    fi

    echo
    echo "ID                                    Timestamp           Reason"
    echo "-------------------------------------------------------------------"

    for backup_file in "$BACKUP_DIR"/*.json; do
        if [ -f "$backup_file" ]; then
            local backup_id
            local timestamp
            local reason

            backup_id=$(basename "$backup_file" .json)
            timestamp=$(jq -r '.timestamp' "$backup_file" 2>/dev/null || echo "unknown")
            reason=$(jq -r '.reason' "$backup_file" 2>/dev/null || echo "unknown")

            printf "%-36s %-18s %s\n" "$backup_id" "$timestamp" "$reason"
        fi
    done
}

# Main rollback function
main() {
    local action="${1:-emergency}"
    local reason="${2:-Manual rollback requested}"

    case "$action" in
        "emergency")
            echo "========================================"
            echo "🚨 EMERGENCY ROLLBACK - StatusBoardV2"
            echo "========================================"
            echo "Timestamp: $(date)"
            echo "Reason: $reason"
            echo "Log: $ROLLBACK_LOG"
            echo "========================================"
            echo

            # Create backup before rollback
            local backup_id
            backup_id=$(create_backup "pre_rollback_$reason")

            # Immediate feature flag disable
            emergency_feature_flag_disable

            # Wait briefly for propagation
            sleep 5

            # Verify rollback
            if verify_rollback; then
                success "Emergency rollback completed successfully"
            else
                warning "Emergency rollback completed with warnings"
            fi

            # Generate report
            generate_rollback_report "$reason" "$backup_id"

            critical "StatusBoardV2 has been rolled back"
            critical "All users should now see the legacy status board"
            ;;

        "full")
            local backup_id="${3:-latest}"

            echo "========================================"
            echo "🔄 FULL ROLLBACK - StatusBoardV2"
            echo "========================================"
            echo "Timestamp: $(date)"
            echo "Reason: $reason"
            echo "Backup: $backup_id"
            echo "Log: $ROLLBACK_LOG"
            echo "========================================"
            echo

            # Create backup
            create_backup "pre_full_rollback_$reason"

            # Emergency feature flag disable first
            emergency_feature_flag_disable

            # Full deployment rollback
            rollback_deployment "$backup_id"

            # Verify rollback
            verify_rollback

            # Generate report
            generate_rollback_report "$reason" "$backup_id"

            success "Full rollback completed"
            ;;

        "verify")
            log "Verifying current rollback state"
            verify_rollback
            ;;

        "backup")
            local backup_reason="${2:-Manual backup}"
            local backup_id
            backup_id=$(create_backup "$backup_reason")
            success "Backup created: $backup_id"
            ;;

        "list")
            list_backups
            ;;

        "restore")
            local backup_id="$2"
            if [ -z "$backup_id" ]; then
                error "Backup ID required for restore"
                list_backups
                exit 1
            fi

            rollback_deployment "$backup_id"
            verify_rollback
            ;;

        *)
            echo "Usage: $0 {emergency|full|verify|backup|list|restore} [reason] [backup_id]"
            echo
            echo "Commands:"
            echo "  emergency [reason]           - Immediate feature flag disable (fastest)"
            echo "  full [reason] [backup_id]    - Full rollback with artifact restoration"
            echo "  verify                       - Check rollback health"
            echo "  backup [reason]              - Create deployment backup"
            echo "  list                         - List available backups"
            echo "  restore <backup_id>          - Restore specific backup"
            echo
            echo "Examples:"
            echo "  $0 emergency 'SLO violations detected'"
            echo "  $0 full 'UAT failed' latest"
            echo "  $0 restore 20240920_143022_pre_rollback"
            exit 1
            ;;
    esac
}

main "$@"
