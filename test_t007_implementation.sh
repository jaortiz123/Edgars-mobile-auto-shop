#!/bin/bash

# T-007 Implementation Test Script
# This simulates the exact steps our CI job will perform

set -e  # Exit on any error

echo "🧪 Testing T-007 Implementation"
echo "==============================="

# 1. Test the curl command from documentation
echo "📋 Testing documented curl command..."
response=$(curl -s -X GET "http://localhost:3001/api/admin/appointments" -H "Content-Type: application/json")

# 2. Extract .errors field using jq (as in docs)
errors_field=$(echo "$response" | jq -r '.errors')
echo "✅ Errors field value: $errors_field"

# 3. Assert .errors == null (as in CI)
if [ "$errors_field" = "null" ]; then
    echo "✅ SUCCESS: .errors field is null as expected"
else
    echo "❌ FAILURE: .errors field is not null, got: $errors_field"
    exit 1
fi

# 4. Validate envelope structure
has_data=$(echo "$response" | jq 'has("data")')
has_errors=$(echo "$response" | jq 'has("errors")')
has_meta=$(echo "$response" | jq 'has("meta")')

if [ "$has_data" = "true" ] && [ "$has_errors" = "true" ] && [ "$has_meta" = "true" ]; then
    echo "✅ SUCCESS: Envelope structure is valid (data, errors, meta fields present)"
else
    echo "❌ FAILURE: Invalid envelope structure"
    echo "   - has data: $has_data"
    echo "   - has errors: $has_errors"
    echo "   - has meta: $has_meta"
    exit 1
fi

# 5. Validate data content
appointment_count=$(echo "$response" | jq '.data.appointments | length')
echo "✅ SUCCESS: Found $appointment_count appointments in response"

echo ""
echo "🎉 T-007 Implementation Test PASSED!"
echo "   - curl command works as documented"
echo "   - .errors field is null"
echo "   - Envelope structure is valid"
echo "   - CI logic will work correctly"
