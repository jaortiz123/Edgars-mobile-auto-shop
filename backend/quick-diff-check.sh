#!/usr/bin/env bash
# quick-diff-check.sh
# Quick diff coverage check for development
# Simplified version for day-to-day development use

set -e

cd "$(dirname "${BASH_SOURCE[0]}")"

echo "🔍 Quick Diff Coverage Check"
echo "=============================="

# Generate coverage quickly
echo "Generating coverage..."
TEST_MODE=unit pytest --cov=backend --cov-report=xml --ignore=tests/test_invoice_add_package.py -q > /dev/null 2>&1

# Run diff-cover with minimal output
echo "Checking diff coverage (80% threshold)..."
if diff-cover coverage.xml --compare-branch=origin/main --fail-under=80 --quiet; then
    echo "✅ PASS: Your changes meet coverage requirements"
    exit 0
else
    echo "❌ FAIL: Some new/modified lines need tests"
    echo "Run './diff-coverage-check.sh' for detailed analysis"
    exit 1
fi
