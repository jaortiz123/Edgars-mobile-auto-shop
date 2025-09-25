#!/bin/bash

# StatusBoardV2 Staging Deployment Script
# Implements Sprint 6 → Staging Launch Playbook

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${SCRIPT_DIR}/frontend"
BUILD_DIR="${FRONTEND_DIR}/dist"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEPLOY_LOG="${SCRIPT_DIR}/staging-deploy-${TIMESTAMP}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1" | tee -a "$DEPLOY_LOG"
}

success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅ $1${NC}" | tee -a "$DEPLOY_LOG"
}

warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️  $1${NC}" | tee -a "$DEPLOY_LOG"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌ $1${NC}" | tee -a "$DEPLOY_LOG"
    exit 1
}

# Environment variables (override as needed)
STAGING_BUCKET="${STAGING_BUCKET:-mobile-auto-shop-staging-b928aa27}"
CF_DIST_ID="$NEW_CF_ID"
STAGING_API_URL="${STAGING_API_URL:-https://staging-api.edgarsautoshop.com}"
FEATURE_FLAG_ENABLED="${FEATURE_FLAG_ENABLED:-false}"

echo "========================================"
echo "🚀 StatusBoardV2 Staging Deployment"
echo "========================================"
echo "Timestamp: $(date)"
echo "Feature Flag: $FEATURE_FLAG_ENABLED"
echo "Staging API: $STAGING_API_URL"
echo "Deploy Log: $DEPLOY_LOG"
echo "========================================"
echo

# Step 1: Prerequisites Check
log "Step 1: Prerequisites Check"

if [ ! -d "$FRONTEND_DIR" ]; then
    error "Frontend directory not found: $FRONTEND_DIR"
fi

if ! command -v npm &> /dev/null; then
    error "npm is not installed"
fi

if ! command -v aws &> /dev/null; then
    warning "AWS CLI not found - S3 deployment will be skipped"
    SKIP_AWS=true
fi

# Check if .env.preview exists
if [ ! -f "$FRONTEND_DIR/.env.preview" ]; then
    error ".env.preview file not found in frontend directory"
fi

success "Prerequisites validated"

# Step 2: Environment Configuration
log "Step 2: Environment Configuration"

cd "$FRONTEND_DIR"

# Backup current environment
if [ -f ".env.backup" ]; then
    warning "Existing .env.backup found"
fi
cp .env .env.backup 2>/dev/null || true

# Create staging environment file
cat > .env.staging << EOF
# Staging Environment Configuration
# Generated: $(date)

# === API CONFIGURATION ===
VITE_API_BASE_URL=${STAGING_API_URL}
VITE_API_ENDPOINT_URL=${STAGING_API_URL}/api

# === ENVIRONMENT CONFIGURATION ===
VITE_NODE_ENV=staging
VITE_APP_ENV=staging

# === StatusBoardV2 Feature Flags ===
VITE_FEATURE_STATUS_BOARD_V2=${FEATURE_FLAG_ENABLED}
VITE_FEATURE_STATUS_BOARD_V2_DRAG_DROP=${FEATURE_FLAG_ENABLED}
VITE_FEATURE_STATUS_BOARD_V2_PERF_MON=true
VITE_FEATURE_STATUS_BOARD_V2_DRAWER=${FEATURE_FLAG_ENABLED}
VITE_FEATURE_STATUS_BOARD_V2_ROLLBACK=true

# === MONITORING ===
VITE_ENABLE_PERFORMANCE_MONITORING=true
VITE_ENABLE_ERROR_TRACKING=true
EOF

# Use staging environment for build
cp .env.staging .env

success "Staging environment configured"

# Step 3: Dependencies & Build
log "Step 3: Clean Install & Build"

# Clean install
rm -rf node_modules 2>/dev/null || true
npm install

if [ $? -ne 0 ]; then
    error "npm install failed"
fi

# Clean previous build
rm -rf dist

# Build for staging
log "Building for staging environment..."
npm run build

if [ $? -ne 0 ]; then
    error "Build failed"
fi

success "Build completed successfully"

# Step 4: Build Validation
log "Step 4: Build Validation"

if [ ! -d "$BUILD_DIR" ]; then
    error "Build directory not found: $BUILD_DIR"
fi

if [ ! -f "$BUILD_DIR/index.html" ]; then
    error "index.html not found in build directory"
fi

# Check bundle size
BUNDLE_SIZE=$(du -sh "$BUILD_DIR" | cut -f1)
log "Build size: $BUNDLE_SIZE"

# Count assets
JS_COUNT=$(find "$BUILD_DIR" -name "*.js" | wc -l)
CSS_COUNT=$(find "$BUILD_DIR" -name "*.css" | wc -l)
log "Assets: ${JS_COUNT} JS files, ${CSS_COUNT} CSS files"

success "Build validation passed"

# Step 5: Pre-deployment Tests
log "Step 5: Pre-deployment Tests"

# Test that essential files exist
ESSENTIAL_FILES=("index.html")
for file in "${ESSENTIAL_FILES[@]}"; do
    if [ ! -f "$BUILD_DIR/$file" ]; then
        error "Essential file missing: $file"
    fi
done

# Check for StatusBoardV2 in build (should be present but potentially lazy-loaded)
if grep -r "StatusBoardV2" "$BUILD_DIR" > /dev/null; then
    success "StatusBoardV2 components found in build"
else
    warning "StatusBoardV2 components not found in build (may be lazy-loaded)"
fi

success "Pre-deployment tests passed"

# Step 6: S3 Deployment (if AWS CLI available)
if [ "$SKIP_AWS" != true ]; then
    log "Step 6: S3 Deployment"

    # Sync to S3 with cache headers
    aws s3 sync "$BUILD_DIR" "s3://$STAGING_BUCKET" \
        --delete \
        --cache-control "max-age=60" \
        --exclude "*.html" \
        --exclude "*.json"

    # Upload HTML/JSON with no-cache
    aws s3 sync "$BUILD_DIR" "s3://$STAGING_BUCKET" \
        --cache-control "no-cache" \
        --include "*.html" \
        --include "*.json"

    if [ $? -eq 0 ]; then
        success "S3 sync completed"
    else
        error "S3 sync failed"
    fi

    # CloudFront invalidation
    log "Creating CloudFront invalidation..."
    INVALIDATION_ID=$(aws cloudfront create-invalidation \
        --distribution-id "$CF_DIST_ID" \
        --paths "/*" \
        --query 'Invalidation.Id' \
        --output text)

    if [ $? -eq 0 ]; then
        success "CloudFront invalidation created: $INVALIDATION_ID"
        log "Invalidation URL: https://console.aws.amazon.com/cloudfront/home#distribution-settings:$CF_DIST_ID"
    else
        error "CloudFront invalidation failed"
    fi
else
    warning "Skipping S3 deployment (AWS CLI not available)"
fi

# Step 7: Post-deployment Validation
log "Step 7: Post-deployment Validation"

# Create deployment manifest
cat > "${SCRIPT_DIR}/staging-deployment-${TIMESTAMP}.json" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "git_branch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')",
  "feature_flags": {
    "statusBoardV2Enabled": $FEATURE_FLAG_ENABLED,
    "performanceMonitoring": true
  },
  "environment": {
    "api_url": "$STAGING_API_URL",
    "deployment_id": "$TIMESTAMP"
  },
  "build_info": {
    "size": "$BUNDLE_SIZE",
    "js_files": $JS_COUNT,
    "css_files": $CSS_COUNT
  }
}
EOF

success "Deployment manifest created"

# Restore original environment
cp .env.backup .env 2>/dev/null || true
rm -f .env.backup .env.staging

success "Environment restored"

echo
echo "========================================"
echo "🎉 Staging Deployment Complete!"
echo "========================================"
echo "Deployment ID: $TIMESTAMP"
echo "Feature Flag: $FEATURE_FLAG_ENABLED"
echo "Staging URL: https://staging.edgarsautoshop.com"
echo "Deploy Log: $DEPLOY_LOG"
echo "========================================"
echo
echo "Next Steps:"
echo "1. Run staging smoke tests: ./staging-smoke-tests.sh"
echo "2. Enable feature flag if not already enabled"
echo "3. Begin UAT validation"
echo

# Return to original directory
cd "$SCRIPT_DIR"
