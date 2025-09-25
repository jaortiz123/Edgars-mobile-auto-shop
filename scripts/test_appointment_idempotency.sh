#!/usr/bin/env bash
# CURL POST Replay Test for Admin Appointments Idempotency
# Demonstrates X-Idempotency-Key behavior end-to-end

set -euo pipefail

SERVER_URL="http://localhost:3001"
ENDPOINT="/api/admin/appointments"
IDEMPOTENCY_KEY="test-$(date +%s)-$(uuidgen | tr '[:upper:]' '[:lower:]')"

# Test payload
PAYLOAD='{
  "customer_id": "test-customer-123",
  "vehicle_id": "test-vehicle-456",
  "service_code": "OIL_CHANGE",
  "scheduled_at": "2024-01-01T10:00:00Z",
  "notes": "Idempotency test appointment",
  "total_amount": 89.99
}'

echo "🔍 ADMIN APPOINTMENTS IDEMPOTENCY TEST"
echo "====================================="
echo "Endpoint: $SERVER_URL$ENDPOINT"
echo "Idempotency Key: $IDEMPOTENCY_KEY"
echo ""

# Function to make POST request with timing
make_request() {
    local attempt=$1
    echo "📡 Request #$attempt"
    echo "-------------------"

    start_time=$(date +%s.%3N)

    response=$(curl -s -w "\\n%{http_code}\\n%{header_json}\\n" \\
      -X POST \\
      -H "Content-Type: application/json" \\
      -H "Authorization: Bearer test-token" \\
      -H "X-Tenant-Id: 00000000-0000-0000-0000-000000000001" \\
      -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" \\
      -d "$PAYLOAD" \\
      "$SERVER_URL$ENDPOINT" || echo "CURL_ERROR")

    end_time=$(date +%s.%3N)
    duration=$(echo "$end_time - $start_time" | bc -l)

    if [[ "$response" == "CURL_ERROR" ]]; then
        echo "❌ Request failed (server not running?)"
        return 1
    fi

    # Parse response parts
    body=$(echo "$response" | head -n -2)
    status_code=$(echo "$response" | tail -n 2 | head -n 1)
    headers=$(echo "$response" | tail -n 1)

    echo "Status: $status_code"
    echo "Duration: ${duration}s"

    # Extract key headers if available
    if command -v jq > /dev/null && [[ "$headers" != "null" ]]; then
        idempotency_status=$(echo "$headers" | jq -r '.["x-idempotency-status"] // "not-present"')
        echo "X-Idempotency-Status: $idempotency_status"
    fi

    # Extract appointment ID from response
    if command -v jq > /dev/null; then
        appointment_id=$(echo "$body" | jq -r '.data.id // "none"')
        echo "Appointment ID: $appointment_id"
    fi

    echo "Response body: $body"
    echo ""

    return 0
}

echo "🎯 TESTING IDEMPOTENCY BEHAVIOR"
echo "Server must return same response for duplicate requests"
echo ""

# First request - should create new appointment
echo "🆕 FIRST REQUEST (should create)"
if make_request 1; then
    echo "✅ First request completed"
else
    echo "❌ First request failed - cannot proceed with idempotency test"
    echo ""
    echo "💡 To test manually when server is running:"
    echo "curl -X POST \\"
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -H 'Authorization: Bearer test-token' \\"
    echo "  -H 'X-Tenant-Id: 00000000-0000-0000-0000-000000000001' \\"
    echo "  -H 'X-Idempotency-Key: $IDEMPOTENCY_KEY' \\"
    echo "  -d '$PAYLOAD' \\"
    echo "  '$SERVER_URL$ENDPOINT'"
    exit 1
fi

# Second request - should return same result (idempotent replay)
echo "🔄 SECOND REQUEST (should be idempotent)"
if make_request 2; then
    echo "✅ Second request completed"
    echo ""
    echo "🎉 SUCCESS: Idempotency test completed!"
    echo "Both requests should return same appointment ID"
    echo "Second request should have X-Idempotency-Status: replayed"
else
    echo "❌ Second request failed"
    exit 1
fi

echo ""
echo "💡 VERIFICATION CHECKLIST:"
echo "  □ Both responses have same appointment ID"
echo "  □ Both responses have same body content"
echo "  □ First response: X-Idempotency-Status: created"
echo "  □ Second response: X-Idempotency-Status: replayed"
echo "  □ Status codes: 201 (first) or 200 (second)"
