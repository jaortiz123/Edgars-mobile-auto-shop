#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# Fetch API endpoint from Terraform infrastructure
API_ENDPOINT=$(terraform -chdir=infrastructure output -raw api_endpoint)
COGNITO_APP_CLIENT_ID=$(terraform -chdir=infrastructure output -raw cognito_app_client_id)
echo "Using API_ENDPOINT: $API_ENDPOINT"
echo "Using COGNITO_APP_CLIENT_ID: $COGNITO_APP_CLIENT_ID"

# Test credentials
EMAIL="testuser@example.com"
PASSWORD="TestPassword123!"
echo "Using test email: $EMAIL"

# 1. Register user (idempotent due to auto-confirm)
echo "Registering user..."
curl -s -X POST "$API_ENDPOINT/customers/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"'$EMAIL'","password":"'$PASSWORD'"}'
echo -e "\n"

# 2. Login user and extract ID_TOKEN from tokens.IdToken
echo "Logging in user..."
LOGIN_RESP=$(curl -s -X POST "$API_ENDPOINT/customers/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"'$EMAIL'","password":"'$PASSWORD'"}')
echo "$LOGIN_RESP" | jq .
ID_TOKEN=$(echo "$LOGIN_RESP" | jq -r '.tokens.IdToken')
echo "ID_TOKEN: $ID_TOKEN"
echo -e "\n"

# 3. GET /customers/profile (should be empty)
echo "GET /customers/profile (expected empty items)..."
curl -s -X GET "$API_ENDPOINT/customers/profile" \
  -H "Authorization: Bearer $ID_TOKEN"
echo -e "\n"

# 4. PUT /customers/profile (create data)
echo "PUT /customers/profile..."
curl -s -X PUT "$API_ENDPOINT/customers/profile" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Jane Driver",
    "phone":"555-1234",
    "vehicles":[{"id":"v1","make":"Honda","model":"Civic","year":2015,"vin":"123ABC"}]
  }'
echo -e "\n"

# 5. GET /customers/profile (should return created data)
echo "GET /customers/profile (verify data)..."
curl -s -X GET "$API_ENDPOINT/customers/profile" \
  -H "Authorization: Bearer $ID_TOKEN"
echo -e "\n"

# Append error-case tests to guard against missing or malformed input
set +e

echo
echo "❌ Running error-case tests…"

# 1. Missing token → expect 401 Unauthorized
echo "GET without token → expect 401"
curl -s -o /dev/null -w "%{http_code}\n" -X GET "$API_ENDPOINT/customers/profile" \
  -H "Content-Type: application/json"

# 2. Invalid token → expect 401 Unauthorized
echo "GET with bad token → expect 401"
curl -s -o /dev/null -w "%{http_code}\n" -X GET "$API_ENDPOINT/customers/profile" \
  -H "Authorization: Bearer INVALID.TOKEN.HERE" \
  -H "Content-Type: application/json"

# 3. PUT missing required fields → expect 400 Bad Request
echo "PUT with empty body → expect 400"
curl -s -o /dev/null -w "%{http_code}\n" -X PUT "$API_ENDPOINT/customers/profile" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d ''

# 4. PUT with malformed JSON → expect 400 Bad Request
echo "PUT with bad JSON → expect 400"
curl -s -o /dev/null -w "%{http_code}\n" -X PUT "$API_ENDPOINT/customers/profile" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{bad json}'

echo "✅ Error-case tests complete."
set -e
