#!/bin/bash

# Status Board Smoke Tests
URL="https://zqz4buacq2lmijsk3xcdr33dmy0ixcqt.lambda-url.us-west-2.on.aws"

echo "===== Status Board Smoke Tests ====="
echo "Testing URL: $URL"
echo ""

# Function to test endpoint
test_endpoint() {
    local method="$1"
    local path="$2"
    local expected_status="$3"
    local data="$4"

    echo "Testing: $method $path"

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}\n" "$URL$path")
    else
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X "$method" "$URL$path" -H "Content-Type: application/json" -d "$data")
    fi

    # Extract HTTP status
    status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
    body=$(echo "$response" | grep -v "HTTP_STATUS:")

    echo "  Status: $status (expected: $expected_status)"
    echo "  Response: $body"

    # Basic validation
    if [ "$status" = "$expected_status" ]; then
        echo "  ✅ PASS"
    else
        echo "  ❌ FAIL - Expected $expected_status but got $status"
    fi

    echo ""
}

# Test 1: Health check
test_endpoint "GET" "/healthz" "200"

# Test 2: Board endpoint (today)
test_endpoint "GET" "/api/admin/appointments/board" "200"

# Test 3: Board endpoint with explicit date
D=$(date +%F)
test_endpoint "GET" "/api/admin/appointments/board?date=$D" "200"

# Test 4: Dashboard stats
test_endpoint "GET" "/api/admin/dashboard/stats?date=$D" "200"

# Test 5: Initialize DB (should work even if already initialized)
test_endpoint "POST" "/api/admin/init-db" "200"

echo "===== Test Summary ====="
echo "Note: If all tests show 403 with 'Message: null', there may be a Function URL"
echo "configuration or authentication issue, but the Lambda function itself appears"
echo "to be working based on CloudWatch logs showing successful executions."
echo ""
echo "Check CloudWatch logs for detailed execution traces:"
echo "aws logs tail /aws/lambda/edgar-auto-shop-dev-flask-app --follow --region us-west-2"
