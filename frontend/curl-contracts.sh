#!/bin/bash
# Curl contracts (sanity) for Customer Profile API

BASE_URL="http://localhost:3001"
CUSTOMER_ID="19"

echo "=== PR B6 Customer Profile API Curl Contracts ==="

# 1) Basic
echo "1) Basic profile request with limit:"
curl -is "${BASE_URL}/api/admin/customers/${CUSTOMER_ID}/profile?limit_appointments=5" | sed -n '1,12p'
echo ""

# 2) ETag flow
echo "2) ETag flow - first request to get ETag:"
ET=$(curl -sI "${BASE_URL}/api/admin/customers/${CUSTOMER_ID}/profile" | awk -F': ' '/^ETag:/ {print $2}' | tr -d '\r')
echo "ETag received: ${ET}"

if [ ! -z "$ET" ]; then
    echo "Conditional request with If-None-Match:"
    curl -is -H "If-None-Match: $ET" "${BASE_URL}/api/admin/customers/${CUSTOMER_ID}/profile" | sed -n '1,8p'
else
    echo "No ETag received - skipping conditional request test"
fi
echo ""

# 3) Cursor pagination
echo "3) Cursor pagination - first page:"
RESPONSE=$(curl -s "${BASE_URL}/api/admin/customers/${CUSTOMER_ID}/profile?limit_appointments=25")
echo "Response structure:"
echo "$RESPONSE" | jq 'keys'

NEXT=$(echo "$RESPONSE" | jq -r '.page.next_cursor // empty')
echo "Next cursor: ${NEXT}"

if [ ! -z "$NEXT" ] && [ "$NEXT" != "null" ]; then
    echo "Second page with cursor:"
    curl -s "${BASE_URL}/api/admin/customers/${CUSTOMER_ID}/profile?cursor=$NEXT" | jq '.appointments|length'
else
    echo "No next cursor - single page result"
fi
echo ""

echo "=== Curl contracts completed ==="
