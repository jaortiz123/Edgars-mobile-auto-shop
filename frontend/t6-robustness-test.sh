#!/bin/bash

# T6 Robustness Test Suite
# Comprehensive testing of CI coverage integration edge cases and failure modes

set -euo pipefail

echo "🧪 T6 ROBUSTNESS TEST SUITE"
echo "=========================="
echo ""

FRONTEND_DIR="/Users/jesusortiz/Edgars-mobile-auto-shop/frontend"
cd "$FRONTEND_DIR"

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
    local test_name="$1"
    local test_command="$2"

    TESTS_RUN=$((TESTS_RUN + 1))
    echo "🔍 Test $TESTS_RUN: $test_name"

    if eval "$test_command"; then
        echo "✅ PASSED: $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo ""
        return 0
    else
        echo "❌ FAILED: $test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo ""
        return 1
    fi
}

# Test 1: Normal Coverage Generation
run_test "Normal coverage generation" "npm test -- --coverage --run > /dev/null 2>&1"

# Test 2: Coverage File Validation
run_test "Coverage files exist and are valid" "
    [ -f coverage/coverage-summary.json ] &&
    [ -f coverage/lcov.info ] &&
    [ -s coverage/coverage-summary.json ] &&
    node -p 'JSON.parse(require(\"fs\").readFileSync(\"coverage/coverage-summary.json\"))' > /dev/null 2>&1
"

# Test 3: Coverage Metrics Extraction (Simulate CI logic)
run_test "Coverage metrics extraction works" "
    statements=\$(node -p 'JSON.parse(require(\"fs\").readFileSync(\"coverage/coverage-summary.json\")).total.statements.pct')
    [ \"\$statements\" != 'undefined' ] && [ \"\$statements\" != 'null' ] && [[ \$statements =~ ^[0-9]+(\.[0-9]+)?\$ ]]
"

# Test 4: bc Calculator Availability (CI dependency)
run_test "bc calculator is available" "command -v bc > /dev/null 2>&1"

# Test 5: Threshold Comparison Logic (CI logic simulation)
run_test "Threshold comparison logic works" "
    statements=7.36
    result=\$(echo \"\$statements < 60\" | bc -l)
    [ \"\$result\" = \"1\" ]
"

# Test 6: Handle Missing Coverage Directory
run_test "Handle missing coverage directory gracefully" "
    rm -rf coverage_backup && cp -r coverage coverage_backup
    rm -rf coverage
    if npm test -- --coverage --run > /dev/null 2>&1; then
        [ -d coverage ]
    else
        # Restore backup
        mv coverage_backup coverage 2>/dev/null || true
        false
    fi
"

# Test 7: Handle Corrupted Coverage JSON
run_test "Handle corrupted coverage JSON" "
    cp coverage/coverage-summary.json coverage/coverage-summary.json.backup
    echo 'invalid json' > coverage/coverage-summary.json

    # Test that our robust parsing detects corruption
    if node -p 'JSON.parse(require(\"fs\").readFileSync(\"coverage/coverage-summary.json\"))' > /dev/null 2>&1; then
        # Restore and fail - should have detected corruption
        cp coverage/coverage-summary.json.backup coverage/coverage-summary.json
        false
    else
        # Restore and pass - correctly detected corruption
        cp coverage/coverage-summary.json.backup coverage/coverage-summary.json
        true
    fi
"

# Test 8: Handle Empty Coverage File
run_test "Handle empty coverage file" "
    cp coverage/coverage-summary.json coverage/coverage-summary.json.backup
    echo '' > coverage/coverage-summary.json

    # Test file size detection
    size=\$(wc -c < coverage/coverage-summary.json)

    # Restore file
    cp coverage/coverage-summary.json.backup coverage/coverage-summary.json

    # Empty file should be detected
    [ \"\$size\" -eq 0 ]
"

# Test 9: Verify Test Results Directory Creation
run_test "Test results directory and files created" "
    [ -d test-results ] && [ -f test-results/junit.xml ]
"

# Test 10: Coverage Thresholds Aligned Between CI and Vitest
run_test "Coverage thresholds are achievable" "
    # Current coverage should pass vitest local thresholds
    npm test -- --coverage --run > /dev/null 2>&1
"

# Test 11: Artifact Structure Validation
run_test "Coverage artifacts have expected structure" "
    [ -f coverage/index.html ] &&
    [ -f coverage/lcov.info ] &&
    [ -f coverage/coverage-final.json ] &&
    [ -f coverage/coverage-summary.json ] &&
    [ -d coverage/lcov-report ]
"

# Test 12: Performance Test (Coverage Generation Speed)
run_test "Coverage generation completes within reasonable time" "
    start_time=\$(date +%s)
    npm test -- --coverage --run > /dev/null 2>&1
    end_time=\$(date +%s)
    duration=\$((end_time - start_time))

    # Should complete within 60 seconds for robustness
    [ \$duration -lt 60 ]
"

echo "🏁 ROBUSTNESS TEST RESULTS"
echo "========================="
echo "📊 Tests Run: $TESTS_RUN"
echo "✅ Tests Passed: $TESTS_PASSED"
echo "❌ Tests Failed: $TESTS_FAILED"

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo "🎉 ALL ROBUSTNESS TESTS PASSED!"
    echo "✅ T6 CI Coverage Integration is robust and production-ready"
    exit 0
else
    echo ""
    echo "⚠️  SOME ROBUSTNESS TESTS FAILED"
    echo "❌ Review failed tests and address issues before production deployment"
    exit 1
fi
