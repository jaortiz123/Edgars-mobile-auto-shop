#!/usr/bin/env bash
#
# Release Script for Edgar's Mobile Auto Shop
# Automated deployment with rollback capture
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
ECR_REGISTRY="${ECR_REGISTRY:-588738589514.dkr.ecr.us-west-2.amazonaws.com}"
ECR_REPOSITORY="${ECR_REPOSITORY:-edgar-auto-shop-dev-flask-app}"
RELEASES_DIR="releases"

# Ensure releases directory exists
mkdir -p "$RELEASES_DIR"

usage() {
    cat << EOF
Usage: $0 [OPTIONS] <release-tag>

Deploy a new release of Edgar's Mobile Auto Shop with rollback capture.

Arguments:
    release-tag     Git tag or version identifier (e.g., v1.2.3, hotfix-001)

Options:
    --dry-run       Show what would be deployed without making changes
    --skip-build    Use existing image with the release tag
    --no-smoke      Skip post-deployment smoke test
    --function-name Name of Lambda function (default: edgar-auto-shop-dev-flask-app)
    --region        AWS region (default: us-west-2)
    --help          Show this help message

Examples:
    $0 v1.2.3                    # Full release build and deploy
    $0 --dry-run v1.2.4          # Preview what would happen
    $0 --skip-build hotfix-001   # Deploy existing image
    $0 --no-smoke v1.3.0         # Deploy without smoke test

Environment Variables:
    FUNCTION_NAME    Lambda function name
    AWS_REGION       AWS region
    ECR_REGISTRY     ECR registry URL
    ECR_REPOSITORY   ECR repository name
EOF
}

capture_current_deployment() {
    # Capture current deployment info for rollback

    step "Capturing Current Deployment"

    info "Getting current Lambda configuration..."

    local current_config
    current_config=$(aws lambda get-function \
        --function-name "$FUNCTION_NAME" \
        --region "$AWS_REGION" \
        --output json)

    local current_image_uri
    current_image_uri=$(echo "$current_config" | jq -r '.Code.ImageUri')

    local current_sha
    current_sha=$(echo "$current_config" | jq -r '.Configuration.CodeSha256')

    local current_version
    current_version=$(echo "$current_config" | jq -r '.Configuration.Version')

    # Extract tag from image URI if possible
    local current_tag="unknown"
    if [[ "$current_image_uri" =~ :([^:]+)$ ]]; then
        current_tag="${BASH_REMATCH[1]}"
    fi

    # Create rollback info
    local rollback_file="$RELEASES_DIR/rollback.json"
    local rollback_info
    rollback_info=$(cat << EOF
{
  "captured_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "function_name": "$FUNCTION_NAME",
  "previous_deployment": {
    "image_uri": "$current_image_uri",
    "code_sha256": "$current_sha",
    "version": "$current_version",
    "tag": "$current_tag"
  },
  "new_deployment": {
    "tag": "$RELEASE_TAG",
    "image_uri": "$ECR_REGISTRY/$ECR_REPOSITORY:$RELEASE_TAG"
  },
  "release_metadata": {
    "released_by": "$(whoami)",
    "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "git_branch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
  }
}
EOF
)

    echo "$rollback_info" > "$rollback_file"

    success "Rollback info saved to $rollback_file"
    info "Previous deployment: $current_image_uri"
    info "New deployment: $ECR_REGISTRY/$ECR_REPOSITORY:$RELEASE_TAG"

    # Also create timestamped backup
    local timestamp_file="$RELEASES_DIR/release-$(date +%Y%m%d-%H%M%S).json"
    cp "$rollback_file" "$timestamp_file"
    info "Backup saved to $timestamp_file"
}

build_and_push_image() {
    # Build and push Docker image with release tag

    step "Building Release Image"

    info "Building Docker image for release $RELEASE_TAG..."

    # Build image with release tag
    docker buildx build \
        --platform linux/amd64 \
        -f backend/Dockerfile.lambda \
        -t "$ECR_REPOSITORY:$RELEASE_TAG" \
        -t "$ECR_REPOSITORY:latest" \
        backend/ \
        --load

    success "Docker image built: $ECR_REPOSITORY:$RELEASE_TAG"

    # Tag for ECR
    docker tag "$ECR_REPOSITORY:$RELEASE_TAG" "$ECR_REGISTRY/$ECR_REPOSITORY:$RELEASE_TAG"
    docker tag "$ECR_REPOSITORY:latest" "$ECR_REGISTRY/$ECR_REPOSITORY:latest"

    info "Logging into ECR..."
    aws ecr get-login-password --region "$AWS_REGION" | \
        docker login --username AWS --password-stdin "$ECR_REGISTRY"

    info "Pushing image to ECR..."
    docker push "$ECR_REGISTRY/$ECR_REPOSITORY:$RELEASE_TAG"
    docker push "$ECR_REGISTRY/$ECR_REPOSITORY:latest"

    success "Image pushed to ECR: $ECR_REGISTRY/$ECR_REPOSITORY:$RELEASE_TAG"
}

deploy_lambda() {
    # Deploy new image to Lambda function

    step "Deploying to Lambda"

    local new_image_uri="$ECR_REGISTRY/$ECR_REPOSITORY:$RELEASE_TAG"

    info "Updating Lambda function code..."

    local update_result
    update_result=$(aws lambda update-function-code \
        --function-name "$FUNCTION_NAME" \
        --image-uri "$new_image_uri" \
        --region "$AWS_REGION" \
        --output json)

    local new_sha
    new_sha=$(echo "$update_result" | jq -r '.CodeSha256')

    success "Lambda function updated"
    info "New CodeSha256: $new_sha"

    # Wait for update to complete
    info "Waiting for function update to complete..."
    aws lambda wait function-updated \
        --function-name "$FUNCTION_NAME" \
        --region "$AWS_REGION"

    success "Function update completed"
}

run_smoke_test() {
    # Run smoke test against deployed function

    step "Post-Deployment Validation"

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
        success "Smoke test passed - deployment validated"
    else
        error "Smoke test failed - deployment may have issues"
        warn "Consider running rollback script: ./scripts/rollback.sh"
        return 1
    fi
}

print_deployment_summary() {
    # Print deployment summary

    step "Deployment Summary"

    local function_url
    function_url=$(aws lambda get-function-url-config \
        --function-name "$FUNCTION_NAME" \
        --region "$AWS_REGION" \
        --query 'FunctionUrl' \
        --output text 2>/dev/null || echo "N/A")

    echo
    success "🎉 Release $RELEASE_TAG deployed successfully!"
    echo
    echo "📋 Deployment Details:"
    echo "  Function: $FUNCTION_NAME"
    echo "  Region: $AWS_REGION"
    echo "  Image: $ECR_REGISTRY/$ECR_REPOSITORY:$RELEASE_TAG"
    echo "  URL: $function_url"
    echo
    echo "📂 Rollback Information:"
    echo "  Rollback file: $RELEASES_DIR/rollback.json"
    echo "  Rollback command: ./scripts/rollback.sh"
    echo
    echo "🔍 Next Steps:"
    echo "  - Monitor CloudWatch alarms for 5-10 minutes"
    echo "  - Run additional integration tests if needed"
    echo "  - If issues arise, use: ./scripts/rollback.sh"
    echo
}

main() {
    local DRY_RUN=false
    local SKIP_BUILD=false
    local NO_SMOKE=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
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
                if [[ -z "${RELEASE_TAG:-}" ]]; then
                    RELEASE_TAG="$1"
                else
                    error "Multiple release tags specified"
                    usage
                    exit 1
                fi
                shift
                ;;
        esac
    done

    # Validate release tag
    if [[ -z "${RELEASE_TAG:-}" ]]; then
        error "Release tag is required"
        usage
        exit 1
    fi

    # Validate tag format
    if [[ ! "$RELEASE_TAG" =~ ^[a-zA-Z0-9._-]+$ ]]; then
        error "Invalid release tag format: $RELEASE_TAG"
        error "Use alphanumeric characters, dots, underscores, and hyphens only"
        exit 1
    fi

    echo
    info "🚀 Starting release deployment for Edgar's Mobile Auto Shop"
    info "Release tag: $RELEASE_TAG"
    info "Function: $FUNCTION_NAME"
    info "Region: $AWS_REGION"

    if [[ "$DRY_RUN" == "true" ]]; then
        warn "DRY RUN MODE - No changes will be made"
    fi

    echo

    # Check prerequisites
    if ! command -v aws &> /dev/null; then
        error "AWS CLI not found. Please install and configure AWS CLI."
        exit 1
    fi

    if ! command -v docker &> /dev/null; then
        error "Docker not found. Please install Docker."
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

    if [[ "$DRY_RUN" == "false" ]]; then
        # Capture current deployment for rollback
        capture_current_deployment

        # Build and push image (unless skipped)
        if [[ "$SKIP_BUILD" == "false" ]]; then
            build_and_push_image
        else
            warn "Skipping build - using existing image"
        fi

        # Deploy to Lambda
        deploy_lambda

        # Run smoke test (unless skipped)
        if [[ "$NO_SMOKE" == "false" ]]; then
            run_smoke_test
        else
            warn "Skipping smoke test"
        fi

        # Print summary
        print_deployment_summary
    else
        info "DRY RUN: Would capture current deployment"
        info "DRY RUN: Would build image: $ECR_REGISTRY/$ECR_REPOSITORY:$RELEASE_TAG"
        info "DRY RUN: Would deploy to function: $FUNCTION_NAME"
        info "DRY RUN: Would run smoke test"
    fi

    # Calculate elapsed time
    local end_time
    end_time=$(date +%s)
    local elapsed=$((end_time - start_time))

    success "Release process completed in ${elapsed}s"
}

# Run main function with all arguments
main "$@"
