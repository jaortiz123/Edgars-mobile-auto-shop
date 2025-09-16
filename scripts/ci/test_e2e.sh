#!/usr/bin/env bash
set -Eeuo pipefail

echo "🎭 E2E Tests (Playwright) - CI orchestrated"

# Note: In CI, compose setup is handled by workflow steps
# This script now just runs the Playwright tests
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-west-2}"
export API_BASE_URL="${API_BASE_URL:-http://localhost:3001}"

echo "🧪 Running Playwright tests..."
cd frontend
npx playwright test --config=playwright.config.ts --workers=1 --reporter=list

echo "✅ E2E tests complete"
