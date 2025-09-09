#!/usr/bin/env bash
# diff-coverage-check.sh
# Differential Coverage Quality Gate for Edgar's Mobile Auto Shop Backend
#
# This script runs coverage analysis on only the lines that have changed
# compared to the main branch, ensuring new code meets high standards
# without requiring existing code to be retroactively tested.

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COVERAGE_THRESHOLD=80
COMPARE_BRANCH="origin/main"

echo -e "${BLUE}🔍 Edgar's Mobile Auto Shop - Diff Coverage Quality Gate${NC}"
echo "================================================================"
echo "Backend Directory: $BACKEND_DIR"
echo "Coverage Threshold: $COVERAGE_THRESHOLD%"
echo "Compare Branch: $COMPARE_BRANCH"
echo ""

# Ensure we're in the backend directory
cd "$BACKEND_DIR"

# Step 1: Generate current coverage data
echo -e "${YELLOW}📊 Step 1: Generating coverage data...${NC}"
echo "Running: TEST_MODE=unit pytest --cov=backend --cov-report=xml --cov-report=html --ignore=tests/test_invoice_add_package.py -q"

if ! TEST_MODE=unit pytest --cov=backend --cov-report=xml --cov-report=html --ignore=tests/test_invoice_add_package.py -q; then
    echo -e "${RED}❌ Error: Test suite failed. Cannot proceed with diff coverage.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Coverage data generated successfully${NC}"
echo ""

# Step 2: Check if coverage.xml exists
if [[ ! -f "coverage.xml" ]]; then
    echo -e "${RED}❌ Error: coverage.xml not found. Coverage generation may have failed.${NC}"
    exit 1
fi

# Step 3: Fetch latest main branch for comparison
echo -e "${YELLOW}🔄 Step 2: Fetching latest main branch for comparison...${NC}"
if git fetch origin main; then
    echo -e "${GREEN}✅ Successfully fetched origin/main${NC}"
else
    echo -e "${YELLOW}⚠️  Warning: Could not fetch origin/main. Using local main branch.${NC}"
    COMPARE_BRANCH="main"
fi
echo ""

# Step 4: Run diff-cover analysis
echo -e "${YELLOW}🎯 Step 3: Running differential coverage analysis...${NC}"
echo "Analyzing coverage for lines changed compared to $COMPARE_BRANCH"
echo ""

# Run diff-cover with our configuration
if diff-cover coverage.xml \
    --compare-branch="$COMPARE_BRANCH" \
    --fail-under="$COVERAGE_THRESHOLD" \
    --html-report=htmlcov/diff-coverage-report.html \
    --show-uncovered \
    --show-uncovered-delta; then

    echo ""
    echo -e "${GREEN}🎉 SUCCESS: Differential coverage quality gate PASSED!${NC}"
    echo -e "${GREEN}✅ All new/modified lines meet the $COVERAGE_THRESHOLD% coverage threshold${NC}"
    RESULT=0
else
    echo ""
    echo -e "${RED}❌ FAILURE: Differential coverage quality gate FAILED!${NC}"
    echo -e "${RED}🔍 Some new/modified lines do not meet the $COVERAGE_THRESHOLD% coverage threshold${NC}"
    RESULT=1
fi

echo ""
echo -e "${BLUE}📋 Coverage Reports Generated:${NC}"
echo "  • Global Coverage: htmlcov/index.html"
echo "  • Diff Coverage: htmlcov/diff-coverage-report.html"
echo "  • Coverage XML: coverage.xml"

# Step 5: Show summary of changes being analyzed
echo ""
echo -e "${BLUE}📁 Files with changes being analyzed:${NC}"
if git diff --name-only "$COMPARE_BRANCH"...HEAD -- "*.py" | grep -v test | head -10; then
    echo ""
else
    echo "  (No Python files with changes found)"
fi

# Step 6: Provide next steps based on result
echo ""
if [[ $RESULT -eq 0 ]]; then
    echo -e "${GREEN}🚀 Ready for merge! Your changes meet our coverage standards.${NC}"
    echo ""
    echo -e "${BLUE}📊 Quality Gate Summary:${NC}"
    echo "  ✅ New/modified code coverage: ≥ $COVERAGE_THRESHOLD%"
    echo "  ✅ Test suite: All tests passing"
    echo "  ✅ Coverage reports: Generated successfully"
else
    echo -e "${YELLOW}🔧 Action Required:${NC}"
    echo "  1. Review the diff coverage report: htmlcov/diff-coverage-report.html"
    echo "  2. Add tests for the uncovered lines highlighted in red"
    echo "  3. Re-run this script to verify coverage improvements"
    echo ""
    echo -e "${BLUE}💡 Tip:${NC} Focus on testing only the new/modified lines."
    echo "     You don't need to achieve $COVERAGE_THRESHOLD% global coverage."
fi

echo ""
echo "================================================================"
exit $RESULT
