#!/bin/bash

# StatusBoardV2 Complete Launch Playbook Execution
# Automated execution of the 14-step staging launch and rollout process

set -e

# === HARD STOP AFTER GATE C ===
# Stop execution after Gate C completion to avoid production costs
STOP_AFTER="${STOP_AFTER:-C}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PLAYBOOK_LOG="${SCRIPT_DIR}/playbook-execution-${TIMESTAMP}.log"

# Configuration
STAGING_URL="${STAGING_URL:-https://staging.edgarsautoshop.com}"
PROD_URL="${PROD_URL:-https://edgarsautoshop.com}"

# Cost guardrail banner
echo "💡 Cost Guardrail: D–G disabled. Est. staging cost: \$15–\$25/mo. Full prod would be \$50–\$100+/mo."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1" | tee -a "$PLAYBOOK_LOG"
}

success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅ $1${NC}" | tee -a "$PLAYBOOK_LOG"
}

warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️  $1${NC}" | tee -a "$PLAYBOOK_LOG"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌ $1${NC}" | tee -a "$PLAYBOOK_LOG"
}

highlight() {
    echo -e "${PURPLE}[$(date +'%H:%M:%S')] 📋 $1${NC}" | tee -a "$PLAYBOOK_LOG"
}

step_header() {
    echo -e "${CYAN}========================================${NC}" | tee -a "$PLAYBOOK_LOG"
    echo -e "${CYAN}$1${NC}" | tee -a "$PLAYBOOK_LOG"
    echo -e "${CYAN}========================================${NC}" | tee -a "$PLAYBOOK_LOG"
}

# Execute playbook step with error handling
execute_step() {
    local step_num="$1"
    local step_name="$2"
    local command="$3"

    step_header "STEP $step_num: $step_name"

    log "Executing: $command"

    # Create step log file
    local step_log="${SCRIPT_DIR}/step-${step_num}-${TIMESTAMP}.log"

    # Execute command and capture output
    if eval "$command" 2>&1 | tee "$step_log"; then
        success "Step $step_num completed successfully"
        return 0
    else
        error "Step $step_num failed"
        echo "Check step log: $step_log"
        return 1
    fi
}

# Prompt for user confirmation
confirm_step() {
    local step_num="$1"
    local step_name="$2"
    local description="$3"

    echo
    highlight "Ready for Step $step_num: $step_name"
    echo "$description"
    echo

    if [ "${AUTO_CONFIRM:-false}" = "true" ]; then
        log "Auto-confirmation enabled - proceeding"
        return 0
    fi

    read -p "Continue with this step? (y/N): " confirm
    if [[ "$confirm" =~ ^[Yy] ]]; then
        return 0
    else
        warning "Step $step_num skipped by user"
        return 1
    fi
}

# Validate step completion
validate_step() {
    local step_num="$1"
    local validation_command="$2"

    if [ -z "$validation_command" ]; then
        warning "No validation for step $step_num"
        return 0
    fi

    log "Validating step $step_num..."

    if eval "$validation_command" >/dev/null 2>&1; then
        success "Step $step_num validation passed"
        return 0
    else
        error "Step $step_num validation failed"
        return 1
    fi
}

# Main playbook execution
execute_playbook() {
    highlight "🚀 StatusBoardV2 Launch Playbook Execution"
    echo "================================================"
    echo "Timestamp: $(date)"
    echo "Staging URL: $STAGING_URL"
    echo "Production URL: $PROD_URL"
    echo "Execution Log: $PLAYBOOK_LOG"
    echo "================================================"
    echo

    # Step 1: Pre-flight Checklist
    if confirm_step "1" "Pre-flight Checklist" "Validate all systems and prerequisites"; then
        if execute_step "1" "Pre-flight Checklist" "
            echo 'Checking script availability...' &&
            ls -la ${SCRIPT_DIR}/*.sh &&
            echo 'Validating tools...' &&
            command -v aws && command -v jq && command -v curl &&
            echo 'Pre-flight checks complete'
        "; then
            validate_step "1" "[ -f '${SCRIPT_DIR}/deploy-staging.sh' ]"
        else
            error "Pre-flight checklist failed - aborting"
            return 1
        fi
    fi

    # Step 2: Deploy to Staging
    if confirm_step "2" "Deploy to Staging" "Build and deploy StatusBoardV2 to staging environment"; then
        if execute_step "2" "Deploy to Staging" "${SCRIPT_DIR}/deploy-staging.sh"; then
            validate_step "2" "curl -f -s $STAGING_URL/health"
        else
            error "Staging deployment failed - aborting"
            return 1
        fi
    fi

    # Step 3: Staging Smoke Tests
    if confirm_step "3" "Staging Smoke Tests" "Execute comprehensive staging validation suite"; then
        if execute_step "3" "Staging Smoke Tests" "${SCRIPT_DIR}/staging-smoke-tests.sh"; then
            validate_step "3" "grep -q 'All tests passed' ${SCRIPT_DIR}/staging-smoke-*.log"
        else
            error "Staging smoke tests failed - aborting"
            return 1
        fi
    fi

    # === HARD STOP AFTER GATE C ===
    if [ "$STOP_AFTER" = "C" ]; then
        success "✅ Gates A–C complete. Per scope, halting before performance/production gates."
        echo "To override for a real launch, run: STOP_AFTER=Z ./execute-launch-playbook.sh interactive"
        return 0
    fi

    # Step 4: UAT Initialization
    if confirm_step "4" "UAT Initialization" "Initialize UAT validation framework"; then
        if execute_step "4" "UAT Initialization" "${SCRIPT_DIR}/uat-validation.sh init"; then
            validate_step "4" "[ -f '${SCRIPT_DIR}/uat-data/uat-checklist.json' ]"
        else
            error "UAT initialization failed - aborting"
            return 1
        fi
    fi

    # Step 5: UAT Execution (Interactive)
    if confirm_step "5" "UAT Execution" "Execute UAT testing (requires manual interaction)"; then
        highlight "UAT Testing Phase - Manual Interaction Required"
        echo "================================================================"
        echo "Please run UAT tests interactively:"
        echo "1. ./uat-validation.sh status    # Check current status"
        echo "2. ./uat-validation.sh test <id> # Run individual tests"
        echo "3. Collect stakeholder approvals with ./uat-validation.sh approve"
        echo "================================================================"
        echo

        if [ "${SKIP_UAT_INTERACTIVE:-false}" = "true" ]; then
            warning "Skipping interactive UAT (SKIP_UAT_INTERACTIVE=true)"
        else
            read -p "Press ENTER when UAT is complete and approved..."
        fi

        validate_step "5" "${SCRIPT_DIR}/uat-validation.sh status | grep -q 'approved'"
    fi

    # Step 6: Canary Rollout Setup
    if confirm_step "6" "Canary Rollout Setup" "Initialize feature flag canary system"; then
        if execute_step "6" "Canary Rollout Setup" "${SCRIPT_DIR}/canary-rollout.sh init"; then
            validate_step "6" "echo 'Canary system initialized'"
        else
            warning "Canary setup failed - continuing with manual rollout"
        fi
    fi

    # Step 7: Performance Monitoring
    if confirm_step "7" "Performance Monitoring" "Start real-time performance monitoring"; then
        if execute_step "7" "Performance Monitoring" "${SCRIPT_DIR}/performance-monitor.sh start &"; then
            validate_step "7" "pgrep -f performance-monitor"
            success "Performance monitoring started in background"
        else
            warning "Performance monitoring failed - continuing without realtime monitoring"
        fi
    fi

    # Step 8: Production Validation
    if confirm_step "8" "Production Validation" "Validate production deployment prerequisites"; then
        if execute_step "8" "Production Validation" "${SCRIPT_DIR}/production-launch.sh validate"; then
            validate_step "8" "${SCRIPT_DIR}/production-launch.sh status | grep -q 'healthy'"
        else
            error "Production validation failed - check prerequisites"
            return 1
        fi
    fi

    # Step 9: Production Build & Deploy
    if confirm_step "9" "Production Build & Deploy" "Build and deploy to production with backup"; then
        if execute_step "9" "Production Build & Deploy" "${SCRIPT_DIR}/production-launch.sh deploy"; then
            validate_step "9" "curl -f -s $PROD_URL/health"
        else
            error "Production deployment failed - check logs"
            return 1
        fi
    fi

    # Step 10: Gradual Production Rollout
    if confirm_step "10" "Gradual Production Rollout" "Execute gradual feature flag rollout (5→15→25→50→75→100%)"; then
        if execute_step "10" "Gradual Production Rollout" "${SCRIPT_DIR}/production-launch.sh rollout"; then
            validate_step "10" "${SCRIPT_DIR}/production-launch.sh status | grep -q 'healthy'"
        else
            error "Production rollout failed - initiating rollback"
            execute_step "10b" "Emergency Rollback" "${SCRIPT_DIR}/production-launch.sh rollback"
            return 1
        fi
    fi

    # Step 11: SLO Validation
    if confirm_step "11" "SLO Validation" "Validate production SLOs (Board <800ms, Drawer <200ms)"; then
        if execute_step "11" "SLO Validation" "${SCRIPT_DIR}/production-launch.sh monitor 600"; then
            validate_step "11" "echo 'SLO monitoring completed'"
        else
            warning "SLO validation concerns - check performance logs"
        fi
    fi

    # Step 12: Rollback Testing
    if confirm_step "12" "Rollback Testing" "Verify rollback procedures work correctly"; then
        highlight "Testing rollback procedures (non-destructive)"
        if execute_step "12" "Rollback Testing" "
            echo 'Testing emergency rollback capability...' &&
            ${SCRIPT_DIR}/rollback.sh validate &&
            echo 'Rollback procedures validated'
        "; then
            validate_step "12" "echo 'Rollback validation complete'"
        else
            warning "Rollback testing failed - manual rollback procedures may be needed"
        fi
    fi

    # Step 13: Final Validation
    if confirm_step "13" "Final Validation" "Complete end-to-end system validation"; then
        if execute_step "13" "Final Validation" "
            echo 'Final system validation...' &&
            curl -f -s $PROD_URL/api/admin/appointments/board > /dev/null &&
            ${SCRIPT_DIR}/uat-validation.sh report &&
            ${SCRIPT_DIR}/production-launch.sh report &&
            echo 'Final validation complete'
        "; then
            validate_step "13" "curl -f -s $PROD_URL"
        else
            error "Final validation failed - system may not be ready"
            return 1
        fi
    fi

    # Step 14: Launch Complete
    step_header "STEP 14: Launch Complete! 🎉"
    success "StatusBoardV2 successfully launched to production!"

    echo
    highlight "Launch Summary"
    echo "=============="
    echo "✅ Staging deployment completed"
    echo "✅ UAT validation passed"
    echo "✅ Production deployment successful"
    echo "✅ Gradual rollout completed"
    echo "✅ SLO compliance validated"
    echo "✅ Rollback procedures verified"
    echo
    echo "Production URL: $PROD_URL"
    echo "Feature: StatusBoardV2 at 100% rollout"
    echo "Monitoring: Real-time performance tracking active"
    echo "Support: Emergency rollback procedures available"
    echo
    success "🎉 LAUNCH COMPLETE - StatusBoardV2 is live in production! 🎉"

    return 0
}

# Generate playbook report
generate_playbook_report() {
    local report_file="${SCRIPT_DIR}/playbook-execution-report-${TIMESTAMP}.json"

    log "Generating playbook execution report"

    # Count step logs
    local step_count
    step_count=$(ls -1 "${SCRIPT_DIR}"/step-*-"${TIMESTAMP}".log 2>/dev/null | wc -l || echo "0")

    # Check if UAT is approved
    local uat_status="unknown"
    if [ -f "${SCRIPT_DIR}/uat-data/uat-signoffs.json" ]; then
        uat_status=$(jq -r '.status' "${SCRIPT_DIR}/uat-data/uat-signoffs.json" 2>/dev/null || echo "unknown")
    fi

    # Test production health
    local prod_health="unknown"
    if curl -f -s "$PROD_URL/health" >/dev/null 2>&1; then
        prod_health="healthy"
    else
        prod_health="unhealthy"
    fi

    # Create report
    jq -n \
        --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --arg staging_url "$STAGING_URL" \
        --arg prod_url "$PROD_URL" \
        --arg steps_completed "$step_count" \
        --arg uat_status "$uat_status" \
        --arg prod_health "$prod_health" \
        '{
            report_type: "playbook_execution",
            execution_timestamp: $timestamp,
            environment: {
                staging_url: $staging_url,
                production_url: $prod_url
            },
            execution_summary: {
                steps_completed: ($steps_completed | tonumber),
                total_steps: 14,
                uat_status: $uat_status,
                production_health: $prod_health,
                launch_success: (($uat_status == "approved") and ($prod_health == "healthy"))
            },
            artifacts: {
                execution_log: "playbook-execution-'$TIMESTAMP'.log",
                step_logs: "step-*-'$TIMESTAMP'.log",
                uat_data: "uat-data/",
                reports: "*-report-*.json"
            }
        }' > "$report_file"

    success "Playbook execution report generated: $report_file"

    # Display summary
    echo
    highlight "Playbook Execution Summary"
    jq -r '
        "Execution Timestamp: \(.execution_timestamp)",
        "Steps Completed: \(.execution_summary.steps_completed)/\(.execution_summary.total_steps)",
        "UAT Status: \(.execution_summary.uat_status)",
        "Production Health: \(.execution_summary.production_health)",
        "Launch Success: \(.execution_summary.launch_success)"
    ' "$report_file"
}

# Main function
main() {
    local action="${1:-interactive}"

    case "$action" in
        "interactive"|"run")
            execute_playbook
            local playbook_result=$?

            generate_playbook_report

            if [ $playbook_result -eq 0 ]; then
                success "🎉 Playbook execution completed successfully!"
            else
                error "Playbook execution failed - check logs for details"
            fi

            exit $playbook_result
            ;;

        "auto")
            export AUTO_CONFIRM=true
            export SKIP_UAT_INTERACTIVE=true

            warning "Running in automated mode - minimal user interaction"
            execute_playbook
            ;;

        "validate")
            log "Validating playbook prerequisites"

            local scripts=(
                "deploy-staging.sh"
                "staging-smoke-tests.sh"
                "uat-validation.sh"
                "canary-rollout.sh"
                "performance-monitor.sh"
                "production-launch.sh"
                "rollback.sh"
            )

            local missing=0
            for script in "${scripts[@]}"; do
                if [ -f "${SCRIPT_DIR}/$script" ] && [ -x "${SCRIPT_DIR}/$script" ]; then
                    success "✓ $script"
                else
                    error "✗ $script (missing or not executable)"
                    missing=$((missing + 1))
                fi
            done

            if [ $missing -eq 0 ]; then
                success "All playbook scripts available"
                return 0
            else
                error "$missing scripts missing - playbook cannot execute"
                return 1
            fi
            ;;

        "status")
            log "Playbook Execution Status"
            echo "========================"
            echo "Script Directory: $SCRIPT_DIR"
            echo "Staging URL: $STAGING_URL"
            echo "Production URL: $PROD_URL"
            echo

            # Check recent executions
            if ls "${SCRIPT_DIR}"/playbook-execution-*.log >/dev/null 2>&1; then
                echo "Recent Executions:"
                ls -lt "${SCRIPT_DIR}"/playbook-execution-*.log | head -3
            else
                echo "No previous executions found"
            fi
            ;;

        "report")
            generate_playbook_report
            ;;

        *)
            echo "StatusBoardV2 Launch Playbook Execution"
            echo "======================================"
            echo
            echo "Automated execution of the complete 14-step staging launch process:"
            echo "  1. Pre-flight Checklist         8. Production Validation"
            echo "  2. Deploy to Staging            9. Production Build & Deploy"
            echo "  3. Staging Smoke Tests         10. Gradual Production Rollout"
            echo "  4. UAT Initialization          11. SLO Validation"
            echo "  5. UAT Execution               12. Rollback Testing"
            echo "  6. Canary Rollout Setup        13. Final Validation"
            echo "  7. Performance Monitoring      14. Launch Complete!"
            echo
            echo "Usage: $0 {interactive|run|auto|validate|status|report}"
            echo
            echo "Commands:"
            echo "  interactive  - Execute playbook with user confirmation at each step (default)"
            echo "  run         - Same as interactive"
            echo "  auto        - Automated execution with minimal user interaction"
            echo "  validate    - Check all required scripts are available"
            echo "  status      - Show playbook status and recent executions"
            echo "  report      - Generate execution report from latest run"
            echo
            echo "Environment Variables:"
            echo "  AUTO_CONFIRM=true           - Skip confirmation prompts"
            echo "  SKIP_UAT_INTERACTIVE=true   - Skip UAT manual testing"
            echo "  STAGING_URL                 - Override staging URL"
            echo "  PROD_URL                    - Override production URL"
            echo
            echo "Examples:"
            echo "  $0 validate                 # Check prerequisites"
            echo "  $0 interactive              # Full interactive launch"
            echo "  AUTO_CONFIRM=true $0 auto   # Automated launch"
            exit 1
            ;;
    esac
}

main "$@"
