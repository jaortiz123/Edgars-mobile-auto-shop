#!/usr/bin/env bash
#
# Rollback Script for Edgar's Mobile Auto Shop
# Fast rollback to previous deployment
#
# Sprint 2 Task 5: Release & Rollback Scripts
#

set -euo pipefail

# Colors and formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging helpers
info() { echo -e "${BLUE}→ INFO:${NC} $1"; }
success() { echo -e "${GREEN}✓ SUCCESS:${NC} $1"; }
warn() { echo -e "${YELLOW}⚠ WARNING:${NC} $1"; }
error() { echo -e "${RED}✗ ERROR:${NC} $1"; }
step() { echo -e "${YELLOW}=== $1 ===${NC}"; }

# Configuration
FUNCTION_NAME="${FUNCTION_NAME:-edgar-auto-shop-dev-flask-app}"
AWS_REGION="${AWS_REGION:-us-west-2}"
RELEASES_DIR="releases"
ROLLBACK_FILE="$RELEASES_DIR/rollback.json"

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Rollback Edgar's Mobile Auto Shop to the previous deployment.

Options:
    --dry-run       Show what would be rolled back without making changes
    --no-smoke      Skip post-rollback smoke test
    --function-name Name of Lambda function (default: edgar-auto-shop-dev-flask-app)
    --region        AWS region (default: us-west-2)
    --rollback-file Path to rollback info file (default: releases/rollback.json)
    --help          Show this help message

Examples:
    $0                           # Full rollback with smoke test
    $0 --dry-run                 # Preview what would be rolled back
    $0 --no-smoke               # Rollback without smoke test
    $0 --rollback-file releases/release-20250920-143022.json

Environment Variables:
    FUNCTION_NAME    Lambda function name
    AWS_REGION       AWS region
EOF
}

load_rollback_info() {
    # Load and validate rollback information

    step "Loading Rollback Information"

    if [[ ! -f "$ROLLBACK_FILE" ]]; then
        error "Rollback file not found: $ROLLBACK_FILE"
        error "This usually means:"
        error "  1. No previous deployment was captured"
        error "  2. The rollback file was deleted or moved"
        error "  3. You're in the wrong directory"
        echo
        info "Available rollback files:"
        ls -la "$RELEASES_DIR"/*.json 2>/dev/null || echo "  No rollback files found"
        exit 1
    fi

    info "Loading rollback info from: $ROLLBACK_FILE"

    # Validate JSON format
    if ! jq empty "$ROLLBACK_FILE" 2>/dev/null; then
        error "Invalid JSON in rollback file: $ROLLBACK_FILE"
        exit 1
    fi

    # Extract rollback information
    PREVIOUS_IMAGE_URI=$(jq -r '.previous_deployment.image_uri' "$ROLLBACK_FILE")
    PREVIOUS_TAG=$(jq -r '.previous_deployment.tag' "$ROLLBACK_FILE")
    PREVIOUS_SHA=$(jq -r '.previous_deployment.code_sha256' "$ROLLBACK_FILE")
    NEW_TAG=$(jq -r '.new_deployment.tag' "$ROLLBACK_FILE")
    CAPTURED_AT=$(jq -r '.captured_at' "$ROLLBACK_FILE")

    # Validate required fields
    if [[ "$PREVIOUS_IMAGE_URI" == "null" || -z "$PREVIOUS_IMAGE_URI" ]]; then
        error "No previous image URI found in rollback file"
        exit 1
    fi

    success "Rollback info loaded"
    info "Rolling back FROM: $NEW_TAG"
    info "Rolling back TO: $PREVIOUS_TAG ($PREVIOUS_IMAGE_URI)"
    info "Captured: $CAPTURED_AT"
}

get_current_deployment() {
    # Get current deployment info to compare

    step "Checking Current Deployment"

    local current_config
    current_config=$(aws lambda get-function \
        --function-name "$FUNCTION_NAME" \
        --region "$AWS_REGION" \
        --output json)

    CURRENT_IMAGE_URI=$(echo "$current_config" | jq -r '.Code.ImageUri')
    CURRENT_SHA=$(echo "$current_config" | jq -r '.Configuration.CodeSha256')

    info "Current deployment: $CURRENT_IMAGE_URI"
    info "Current SHA: $CURRENT_SHA"
}

validate_rollback() {
    # Validate rollback is safe and sensible

    step "Validating Rollback"

    # Check if we're already on the target deployment
    if [[ "$CURRENT_IMAGE_URI" == "$PREVIOUS_IMAGE_URI" ]]; then
        warn "Already on target deployment: $PREVIOUS_IMAGE_URI"
        warn "No rollback needed"
        exit 0
    fi

    # Check if current deployment matches what we think we deployed
    local expected_new_image_uri
    expected_new_image_uri=$(jq -r '.new_deployment.image_uri' "$ROLLBACK_FILE")

    if [[ "$CURRENT_IMAGE_URI" != "$expected_new_image_uri" ]]; then
        warn "Current deployment doesn't match expected deployment"
        warn "Expected: $expected_new_image_uri"
        warn "Current:  $CURRENT_IMAGE_URI"
        warn "This might indicate manual changes or multiple deployments"

        read -p "Continue with rollback anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            info "Rollback cancelled by user"
            exit 0
        fi
    fi

    success "Rollback validation passed"
}

perform_rollback() {
    # Perform the actual rollback

    step "Rolling Back Lambda Function"

    info "Rolling back to: $PREVIOUS_IMAGE_URI"

    local rollback_result
    rollback_result=$(aws lambda update-function-code \
        --function-name "$FUNCTION_NAME" \
        --image-uri "$PREVIOUS_IMAGE_URI" \
        --region "$AWS_REGION" \
        --output json)

    local new_sha
    new_sha=$(echo "$rollback_result" | jq -r '.CodeSha256')

    success "Rollback initiated"
    info "New CodeSha256: $new_sha"

    # Wait for update to complete
    info "Waiting for rollback to complete..."
    aws lambda wait function-updated \
        --function-name "$FUNCTION_NAME" \
        --region "$AWS_REGION"

    success "Rollback completed"

    # Verify the rollback
    local verify_config
    verify_config=$(aws lambda get-function \
        --function-name "$FUNCTION_NAME" \
        --region "$AWS_REGION" \
        --output json)

    local verify_image_uri
    verify_image_uri=$(echo "$verify_config" | jq -r '.Code.ImageUri')

    if [[ "$verify_image_uri" == "$PREVIOUS_IMAGE_URI" ]]; then
        success "Rollback verified: $verify_image_uri"
    else
        error "Rollback verification failed"
        error "Expected: $PREVIOUS_IMAGE_URI"
        error "Actual: $verify_image_uri"
        exit 1
    fi
}

run_smoke_test() {
    # Run smoke test against rolled back function

    step "Post-Rollback Validation"

    # Get function URL
    local function_url
    function_url=$(aws lambda get-function-url-config \
        --function-name "$FUNCTION_NAME" \
        --region "$AWS_REGION" \
        --query 'FunctionUrl' \
        --output text)

    info "Running smoke test against: $function_url"

    # Run smoke test
    if ./scripts/smoke.sh "$function_url"; then
        success "Smoke test passed - rollback validated"
    else
        error "Smoke test failed - rolled back version may have issues"
        warn "You may need to investigate or deploy a different version"
        return 1
    fi
}

save_rollback_record() {
    # Save record of the rollback operation

    step "Recording Rollback Operation"

    local rollback_record_file="$RELEASES_DIR/rollback-$(date +%Y%m%d-%H%M%S).json"
    local rollback_record
    rollback_record=$(cat << EOF
{
  "rollback_performed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "performed_by": "$(whoami)",
  "function_name": "$FUNCTION_NAME",
  "rolled_back_from": {
    "image_uri": "$CURRENT_IMAGE_URI",
    "code_sha256": "$CURRENT_SHA"
  },
  "rolled_back_to": {
    "image_uri": "$PREVIOUS_IMAGE_URI",
    "tag": "$PREVIOUS_TAG",
    "code_sha256": "$PREVIOUS_SHA"
  },
  "original_rollback_file": "$ROLLBACK_FILE"
}
EOF
)

    echo "$rollback_record" > "$rollback_record_file"
    success "Rollback record saved: $rollback_record_file"
}

print_rollback_summary() {
    # Print rollback summary

    step "Rollback Summary"

    local function_url
    function_url=$(aws lambda get-function-url-config \
        --function-name "$FUNCTION_NAME" \
        --region "$AWS_REGION" \
        --query 'FunctionUrl' \
        --output text 2>/dev/null || echo "N/A")

    echo
    success "🔄 Rollback completed successfully!"
    echo
    echo "📋 Rollback Details:"
    echo "  Function: $FUNCTION_NAME"
    echo "  Region: $AWS_REGION"
    echo "  Rolled back FROM: $NEW_TAG"
    echo "  Rolled back TO: $PREVIOUS_TAG"
    echo "  Image: $PREVIOUS_IMAGE_URI"
    echo "  URL: $function_url"
    echo
    echo "🔍 Next Steps:"
    echo "  - Monitor application behavior"
    echo "  - Check CloudWatch logs for any issues"
    echo "  - Investigate why the previous deployment needed rollback"
    echo "  - Plan next deployment with fixes"
    echo
}

main() {
    local DRY_RUN=false
    local NO_SMOKE=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --no-smoke)
                NO_SMOKE=true
                shift
                ;;
            --function-name)
                FUNCTION_NAME="$2"
                shift 2
                ;;
            --region)
                AWS_REGION="$2"
                shift 2
                ;;
            --rollback-file)
                ROLLBACK_FILE="$2"
                shift 2
                ;;
            --help)
                usage
                exit 0
                ;;
            -*)
                error "Unknown option: $1"
                usage
                exit 1
                ;;
            *)
                error "Unexpected argument: $1"
                usage
                exit 1
                ;;
        esac
    done

    echo
    info "🔄 Starting rollback for Edgar's Mobile Auto Shop"
    info "Function: $FUNCTION_NAME"
    info "Region: $AWS_REGION"
    info "Rollback file: $ROLLBACK_FILE"

    if [[ "$DRY_RUN" == "true" ]]; then
        warn "DRY RUN MODE - No changes will be made"
    fi

    echo

    # Check prerequisites
    if ! command -v aws &> /dev/null; then
        error "AWS CLI not found. Please install and configure AWS CLI."
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        error "jq not found. Please install jq."
        exit 1
    fi

    # Verify AWS credentials
    if ! aws sts get-caller-identity &>/dev/null; then
        error "AWS credentials not configured or expired"
        exit 1
    fi

    # Record start time
    local start_time
    start_time=$(date +%s)

    # Load rollback information
    load_rollback_info

    # Get current deployment state
    get_current_deployment

    # Validate rollback is safe
    validate_rollback

    if [[ "$DRY_RUN" == "false" ]]; then
        # Confirm rollback
        echo
        warn "⚠️  ROLLBACK CONFIRMATION REQUIRED ⚠️"
        echo
        echo "This will rollback the Lambda function:"
        echo "  FROM: $NEW_TAG"
        echo "  TO:   $PREVIOUS_TAG"
        echo
        read -p "Are you sure you want to proceed? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            info "Rollback cancelled by user"
            exit 0
        fi
        echo

        # Perform rollback
        perform_rollback

        # Run smoke test (unless skipped)
        if [[ "$NO_SMOKE" == "false" ]]; then
            run_smoke_test
        else
            warn "Skipping smoke test"
        fi

        # Save rollback record
        save_rollback_record

        # Print summary
        print_rollback_summary
    else
        info "DRY RUN: Would rollback from $NEW_TAG to $PREVIOUS_TAG"
        info "DRY RUN: Would update function to: $PREVIOUS_IMAGE_URI"
        info "DRY RUN: Would run smoke test"
    fi

    # Calculate elapsed time
    local end_time
    end_time=$(date +%s)
    local elapsed=$((end_time - start_time))

    success "Rollback process completed in ${elapsed}s"
}

# Run main function with all arguments
main "$@"
