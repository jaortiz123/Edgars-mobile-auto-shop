#!/bin/bash

# StatusBoardV2 UAT Validation Framework
# Automated checklist and sign-off tracking system for stakeholder approval

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
UAT_LOG="${SCRIPT_DIR}/uat-validation-${TIMESTAMP}.log"
UAT_DATA_DIR="${SCRIPT_DIR}/uat-data"

# Configuration
STAGING_URL="${STAGING_URL:-https://staging.edgarsautoshop.com}"
UAT_CHECKLIST_FILE="${UAT_DATA_DIR}/uat-checklist.json"
SIGNOFFS_FILE="${UAT_DATA_DIR}/uat-signoffs.json"

# Required approvals (minimum 2)
REQUIRED_APPROVERS=("qa_lead" "admin_user" "tech_lead" "product_owner")
MIN_APPROVALS=2

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1" | tee -a "$UAT_LOG"
}

success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅ $1${NC}" | tee -a "$UAT_LOG"
}

warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️  $1${NC}" | tee -a "$UAT_LOG"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌ $1${NC}" | tee -a "$UAT_LOG"
}

highlight() {
    echo -e "${PURPLE}[$(date +'%H:%M:%S')] 📋 $1${NC}" | tee -a "$UAT_LOG"
}

# Initialize UAT framework
initialize_uat() {
    log "Initializing UAT validation framework"

    mkdir -p "$UAT_DATA_DIR"

    # Create comprehensive UAT checklist
    cat > "$UAT_CHECKLIST_FILE" << 'EOF'
{
  "checklist_version": "1.0",
  "created_timestamp": "",
  "staging_environment": {
    "url": "",
    "feature_flags": {
      "statusBoardV2_enabled": false
    }
  },
  "test_categories": {
    "functionality": {
      "name": "Core Functionality",
      "tests": [
        {
          "id": "func_001",
          "name": "Board loads with appointments",
          "description": "StatusBoardV2 displays appointments in correct columns",
          "priority": "critical",
          "status": "pending",
          "tester": "",
          "timestamp": "",
          "notes": ""
        },
        {
          "id": "func_002",
          "name": "Drag and drop between columns",
          "description": "Appointments can be moved between status columns via drag/drop",
          "priority": "critical",
          "status": "pending",
          "tester": "",
          "timestamp": "",
          "notes": ""
        },
        {
          "id": "func_003",
          "name": "Optimistic updates work correctly",
          "description": "UI updates immediately on drag, reverts on error",
          "priority": "critical",
          "status": "pending",
          "tester": "",
          "timestamp": "",
          "notes": ""
        },
        {
          "id": "func_004",
          "name": "Appointment drawer opens",
          "description": "Clicking appointment card opens detailed drawer",
          "priority": "critical",
          "status": "pending",
          "tester": "",
          "timestamp": "",
          "notes": ""
        },
        {
          "id": "func_005",
          "name": "Drawer shows accurate data",
          "description": "Drawer displays complete appointment information",
          "priority": "high",
          "status": "pending",
          "tester": "",
          "timestamp": "",
          "notes": ""
        },
        {
          "id": "func_006",
          "name": "Status changes via drawer",
          "description": "Appointment status can be changed from drawer",
          "priority": "high",
          "status": "pending",
          "tester": "",
          "timestamp": "",
          "notes": ""
        },
        {
          "id": "func_007",
          "name": "Real-time updates",
          "description": "Board refreshes automatically (30s interval)",
          "priority": "medium",
          "status": "pending",
          "tester": "",
          "timestamp": "",
          "notes": ""
        }
      ]
    },
    "performance": {
      "name": "Performance",
      "tests": [
        {
          "id": "perf_001",
          "name": "Board loads under 800ms",
          "description": "Initial board load completes within SLO",
          "priority": "critical",
          "status": "pending",
          "tester": "",
          "timestamp": "",
          "notes": ""
        },
        {
          "id": "perf_002",
          "name": "Drawer opens under 200ms",
          "description": "Appointment drawer opens within SLO",
          "priority": "critical",
          "status": "pending",
          "tester": "",
          "timestamp": "",
          "notes": ""
        },
        {
          "id": "perf_003",
          "name": "Drag operations feel snappy",
          "description": "No noticeable lag during drag and drop",
          "priority": "high",
          "status": "pending",
          "tester": "",
          "timestamp": "",
          "notes": ""
        },
        {
          "id": "perf_004",
          "name": "No memory leaks",
          "description": "Extended use doesn't degrade performance",
          "priority": "medium",
          "status": "pending",
          "tester": "",
          "timestamp": "",
          "notes": ""
        }
      ]
    },
    "usability": {
      "name": "User Experience",
      "tests": [
        {
          "id": "ux_001",
          "name": "Intuitive drag and drop",
          "description": "Drag/drop behavior is clear and intuitive",
          "priority": "critical",
          "status": "pending",
          "tester": "",
          "timestamp": "",
          "notes": ""
        },
        {
          "id": "ux_002",
          "name": "Visual feedback during operations",
          "description": "Clear visual cues during drag, hover, loading",
          "priority": "high",
          "status": "pending",
          "tester": "",
          "timestamp": "",
          "notes": ""
        },
        {
          "id": "ux_003",
          "name": "Error messages are clear",
          "description": "Conflict/error messages are user-friendly",
          "priority": "high",
          "status": "pending",
          "tester": "",
          "timestamp": "",
          "notes": ""
        },
        {
          "id": "ux_004",
          "name": "Mobile responsiveness",
          "description": "Interface works on mobile devices (if applicable)",
          "priority": "medium",
          "status": "pending",
          "tester": "",
          "timestamp": "",
          "notes": ""
        }
      ]
    },
    "reliability": {
      "name": "Reliability",
      "tests": [
        {
          "id": "rel_001",
          "name": "Handles concurrent updates",
          "description": "Multiple users can update appointments simultaneously",
          "priority": "critical",
          "status": "pending",
          "tester": "",
          "timestamp": "",
          "notes": ""
        },
        {
          "id": "rel_002",
          "name": "Recovers from network errors",
          "description": "Graceful handling of network interruptions",
          "priority": "high",
          "status": "pending",
          "tester": "",
          "timestamp": "",
          "notes": ""
        },
        {
          "id": "rel_003",
          "name": "Data consistency maintained",
          "description": "No data loss during operations",
          "priority": "critical",
          "status": "pending",
          "tester": "",
          "timestamp": "",
          "notes": ""
        }
      ]
    },
    "integration": {
      "name": "System Integration",
      "tests": [
        {
          "id": "int_001",
          "name": "Dashboard KPIs update correctly",
          "description": "Status changes reflect in dashboard statistics",
          "priority": "high",
          "status": "pending",
          "tester": "",
          "timestamp": "",
          "notes": ""
        },
        {
          "id": "int_002",
          "name": "Legacy system compatibility",
          "description": "Can fall back to legacy board seamlessly",
          "priority": "critical",
          "status": "pending",
          "tester": "",
          "timestamp": "",
          "notes": ""
        },
        {
          "id": "int_003",
          "name": "Feature flag toggle works",
          "description": "StatusBoardV2 can be enabled/disabled via flags",
          "priority": "critical",
          "status": "pending",
          "tester": "",
          "timestamp": "",
          "notes": ""
        }
      ]
    }
  }
}
EOF

    # Update checklist with current environment info
    jq --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
       --arg staging_url "$STAGING_URL" \
       '.created_timestamp = $timestamp | .staging_environment.url = $staging_url' \
       "$UAT_CHECKLIST_FILE" > "${UAT_CHECKLIST_FILE}.tmp" && mv "${UAT_CHECKLIST_FILE}.tmp" "$UAT_CHECKLIST_FILE"

    # Initialize sign-offs file
    cat > "$SIGNOFFS_FILE" << EOF
{
  "signoff_session": {
    "id": "$TIMESTAMP",
    "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "staging_url": "$STAGING_URL",
    "required_approvers": $(printf '%s\n' "${REQUIRED_APPROVERS[@]}" | jq -R . | jq -s .),
    "min_approvals": $MIN_APPROVALS
  },
  "approvals": [],
  "status": "pending"
}
EOF

    success "UAT framework initialized"
}

# Update test status
update_test() {
    local test_id="$1"
    local status="$2"
    local tester="$3"
    local notes="$4"

    if [ ! -f "$UAT_CHECKLIST_FILE" ]; then
        error "UAT checklist not initialized"
        return 1
    fi

    log "Updating test $test_id: $status"

    # Update the test in the checklist
    jq --arg test_id "$test_id" \
       --arg status "$status" \
       --arg tester "$tester" \
       --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
       --arg notes "$notes" \
       '
       .test_categories[] |= (
         .tests |= map(
           if .id == $test_id then
             .status = $status |
             .tester = $tester |
             .timestamp = $timestamp |
             .notes = $notes
           else . end
         )
       )' \
       "$UAT_CHECKLIST_FILE" > "${UAT_CHECKLIST_FILE}.tmp" && mv "${UAT_CHECKLIST_FILE}.tmp" "$UAT_CHECKLIST_FILE"

    success "Test $test_id updated: $status"
}

# Add stakeholder sign-off
add_signoff() {
    local approver_role="$1"
    local approver_name="$2"
    local decision="$3"
    local comments="$4"

    log "Adding sign-off from $approver_role ($approver_name): $decision"

    # Check if approver role is in required list
    local is_required=false
    for required in "${REQUIRED_APPROVERS[@]}"; do
        if [ "$required" = "$approver_role" ]; then
            is_required=true
            break
        fi
    done

    if [ "$is_required" = false ]; then
        warning "Approver role '$approver_role' not in required list"
    fi

    # Add approval to sign-offs file
    local approval_json
    approval_json=$(jq -n \
        --arg role "$approver_role" \
        --arg name "$approver_name" \
        --arg decision "$decision" \
        --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --arg comments "$comments" \
        '{
            approver_role: $role,
            approver_name: $name,
            decision: $decision,
            timestamp: $timestamp,
            comments: $comments
        }')

    jq --argjson approval "$approval_json" \
       '.approvals += [$approval]' \
       "$SIGNOFFS_FILE" > "${SIGNOFFS_FILE}.tmp" && mv "${SIGNOFFS_FILE}.tmp" "$SIGNOFFS_FILE"

    success "Sign-off recorded: $approver_role -> $decision"

    # Check if we have enough approvals
    check_approval_status
}

# Check approval status
check_approval_status() {
    if [ ! -f "$SIGNOFFS_FILE" ]; then
        warning "No sign-offs file found"
        return 1
    fi

    local approved_count
    local total_approvals
    local required_approvals

    approved_count=$(jq '[.approvals[] | select(.decision == "approved")] | length' "$SIGNOFFS_FILE")
    total_approvals=$(jq '.approvals | length' "$SIGNOFFS_FILE")
    required_approvals=$(jq '.signoff_session.min_approvals' "$SIGNOFFS_FILE")

    highlight "Approval Status: $approved_count approved / $total_approvals total (need $required_approvals)"

    if [ "$approved_count" -ge "$required_approvals" ]; then
        # Update overall status
        jq '.status = "approved"' "$SIGNOFFS_FILE" > "${SIGNOFFS_FILE}.tmp" && mv "${SIGNOFFS_FILE}.tmp" "$SIGNOFFS_FILE"
        success "🎉 UAT APPROVED - Sufficient approvals received!"
        return 0
    else
        local needed=$((required_approvals - approved_count))
        log "Need $needed more approvals for UAT sign-off"
        return 1
    fi
}

# Generate UAT status report
generate_uat_report() {
    local report_file="${SCRIPT_DIR}/uat-report-${TIMESTAMP}.json"

    log "Generating UAT report: $report_file"

    if [ ! -f "$UAT_CHECKLIST_FILE" ] || [ ! -f "$SIGNOFFS_FILE" ]; then
        error "UAT files not found"
        return 1
    fi

    # Calculate test statistics
    local test_stats
    test_stats=$(jq '
        [.test_categories[].tests[]] as $all_tests |
        {
            total_tests: ($all_tests | length),
            passed: ($all_tests | map(select(.status == "passed")) | length),
            failed: ($all_tests | map(select(.status == "failed")) | length),
            pending: ($all_tests | map(select(.status == "pending")) | length),
            critical_tests: ($all_tests | map(select(.priority == "critical")) | length),
            critical_passed: ($all_tests | map(select(.priority == "critical" and .status == "passed")) | length)
        }
    ' "$UAT_CHECKLIST_FILE")

    # Get approval status
    local approval_stats
    approval_stats=$(jq '{
        total_approvals: (.approvals | length),
        approved: ([.approvals[] | select(.decision == "approved")] | length),
        rejected: ([.approvals[] | select(.decision == "rejected")] | length),
        min_required: .signoff_session.min_approvals,
        overall_status: .status
    }' "$SIGNOFFS_FILE")

    # Combine into report
    jq -n \
        --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --arg staging_url "$STAGING_URL" \
        --argjson test_stats "$test_stats" \
        --argjson approval_stats "$approval_stats" \
        --slurpfile checklist "$UAT_CHECKLIST_FILE" \
        --slurpfile signoffs "$SIGNOFFS_FILE" \
        '{
            report_timestamp: $timestamp,
            environment: {
                staging_url: $staging_url
            },
            summary: {
                test_results: $test_stats,
                approvals: $approval_stats,
                ready_for_production: (
                    ($test_stats.critical_passed == $test_stats.critical_tests) and
                    ($approval_stats.overall_status == "approved")
                )
            },
            detailed_results: {
                checklist: $checklist[0],
                signoffs: $signoffs[0]
            }
        }' > "$report_file"

    success "UAT report generated: $report_file"

    # Display summary
    echo
    highlight "UAT Summary Report"
    echo "===================="
    jq -r '
        "Test Results: \(.summary.test_results.passed)/\(.summary.test_results.total_tests) passed",
        "Critical Tests: \(.summary.test_results.critical_passed)/\(.summary.test_results.critical_tests) passed",
        "Approvals: \(.summary.approvals.approved)/\(.summary.approvals.min_required) required",
        "Overall Status: \(.summary.approvals.overall_status)",
        "Production Ready: \(.summary.ready_for_production)"
    ' "$report_file"
}

# Display current status
show_status() {
    if [ ! -f "$UAT_CHECKLIST_FILE" ]; then
        warning "UAT not initialized"
        return 1
    fi

    echo "========================================"
    echo "📋 StatusBoardV2 UAT Status"
    echo "========================================"
    echo "Environment: $STAGING_URL"
    echo "Timestamp: $(date)"
    echo "========================================"
    echo

    # Show test categories and status
    highlight "Test Progress by Category:"
    jq -r '
        .test_categories | to_entries[] |
        "\(.key) (\(.value.name)):",
        "  Total: \(.value.tests | length)",
        "  Passed: \(.value.tests | map(select(.status == "passed")) | length)",
        "  Failed: \(.value.tests | map(select(.status == "failed")) | length)",
        "  Pending: \(.value.tests | map(select(.status == "pending")) | length)",
        ""
    ' "$UAT_CHECKLIST_FILE"

    # Show approvals if file exists
    if [ -f "$SIGNOFFS_FILE" ]; then
        highlight "Approvals:"
        jq -r '
            if (.approvals | length) > 0 then
                (.approvals[] | "  \(.approver_role) (\(.approver_name)): \(.decision)")
            else
                "  No approvals yet"
            end
        ' "$SIGNOFFS_FILE"

        check_approval_status
    fi
}

# Interactive test runner
run_interactive_test() {
    local test_id="$1"

    if [ ! -f "$UAT_CHECKLIST_FILE" ]; then
        error "UAT not initialized"
        return 1
    fi

    # Get test details
    local test_info
    test_info=$(jq --arg test_id "$test_id" '
        [.test_categories[].tests[]] |
        map(select(.id == $test_id)) |
        .[0]
    ' "$UAT_CHECKLIST_FILE")

    if [ "$test_info" = "null" ]; then
        error "Test not found: $test_id"
        return 1
    fi

    local test_name
    local test_description
    test_name=$(echo "$test_info" | jq -r '.name')
    test_description=$(echo "$test_info" | jq -r '.description')

    echo "========================================"
    echo "🧪 Running UAT Test: $test_id"
    echo "========================================"
    echo "Name: $test_name"
    echo "Description: $test_description"
    echo "========================================"
    echo

    read -p "Enter your name: " tester_name
    echo "Please perform the test described above."
    echo "Test URL: $STAGING_URL"
    echo
    read -p "Did the test pass? (y/n): " test_result
    read -p "Enter any notes or observations: " test_notes

    local status
    if [[ "$test_result" =~ ^[Yy] ]]; then
        status="passed"
        success "Test marked as PASSED"
    else
        status="failed"
        error "Test marked as FAILED"
    fi

    update_test "$test_id" "$status" "$tester_name" "$test_notes"
}

# Main function
main() {
    local action="${1:-status}"

    case "$action" in
        "init")
            initialize_uat
            success "UAT validation framework ready"
            echo "Next steps:"
            echo "1. Run tests: $0 test <test_id>"
            echo "2. Add approvals: $0 approve <role> <name> <approved|rejected> '<comments>'"
            echo "3. Check status: $0 status"
            ;;

        "status")
            show_status
            ;;

        "test")
            local test_id="$2"
            if [ -z "$test_id" ]; then
                error "Test ID required"
                echo "Available tests:"
                jq -r '.test_categories[].tests[] | "\(.id): \(.name)"' "$UAT_CHECKLIST_FILE" 2>/dev/null || echo "Run 'init' first"
                exit 1
            fi
            run_interactive_test "$test_id"
            ;;

        "update")
            local test_id="$2"
            local status="$3"
            local tester="$4"
            local notes="$5"

            if [ -z "$test_id" ] || [ -z "$status" ] || [ -z "$tester" ]; then
                error "Usage: $0 update <test_id> <passed|failed|pending> <tester_name> [notes]"
                exit 1
            fi

            update_test "$test_id" "$status" "$tester" "$notes"
            ;;

        "approve")
            local role="$2"
            local name="$3"
            local decision="$4"
            local comments="$5"

            if [ -z "$role" ] || [ -z "$name" ] || [ -z "$decision" ]; then
                error "Usage: $0 approve <role> <name> <approved|rejected> [comments]"
                exit 1
            fi

            add_signoff "$role" "$name" "$decision" "$comments"
            ;;

        "report")
            generate_uat_report
            ;;

        "checklist")
            if [ -f "$UAT_CHECKLIST_FILE" ]; then
                jq '.' "$UAT_CHECKLIST_FILE"
            else
                error "UAT not initialized"
            fi
            ;;

        "signoffs")
            if [ -f "$SIGNOFFS_FILE" ]; then
                jq '.' "$SIGNOFFS_FILE"
            else
                error "No sign-offs found"
            fi
            ;;

        *)
            echo "Usage: $0 {init|status|test|update|approve|report|checklist|signoffs}"
            echo
            echo "Commands:"
            echo "  init                                    - Initialize UAT framework"
            echo "  status                                  - Show current UAT status"
            echo "  test <test_id>                         - Run interactive test"
            echo "  update <id> <status> <tester> [notes]  - Update test status"
            echo "  approve <role> <name> <decision> [comments] - Add stakeholder approval"
            echo "  report                                  - Generate comprehensive UAT report"
            echo "  checklist                               - Show full test checklist"
            echo "  signoffs                                - Show all sign-offs"
            echo
            echo "Examples:"
            echo "  $0 init"
            echo "  $0 test func_001"
            echo "  $0 approve qa_lead 'Jane Smith' approved 'All critical tests pass'"
            exit 1
            ;;
    esac
}

main "$@"
