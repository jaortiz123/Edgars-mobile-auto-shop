#!/bin/bash
set -e

# Fetch API endpoint from Terraform output
API_ENDPOINT=$(terraform -chdir=../infrastructure output -raw api_endpoint)
echo "Using API_ENDPOINT: $API_ENDPOINT"

# Fetch Cognito App Client ID from Terraform output
COGNITO_APP_CLIENT_ID=$(terraform -chdir=../infrastructure output -raw cognito_app_client_id)
echo "Using COGNITO_APP_CLIENT_ID: $COGNITO_APP_CLIENT_ID"

# Use static test email for smoke tests
EMAIL="testuser@example.com"
echo "Using test email: $EMAIL"
PASSWORD="TestPassword123!"

# Register user
echo "Testing POST /customers/register..."
curl -s -X POST "$API_ENDPOINT/customers/register" \
  -H "Content-Type: application/json" \
  -d '{"email": "'$EMAIL'", "password": "'$PASSWORD'"}'
echo -e "\n"

# Login user
echo "Testing POST /customers/login..."
curl -s -X POST "$API_ENDPOINT/customers/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "'$EMAIL'", "password": "'$PASSWORD'"}'
echo -e "\n"

# Append error-case tests for register and login negative scenarios
set +e

echo
echo "❌ Running error-case tests…"

# 1. Register without body → expect 400
echo "POST /customers/register without body → expect 400"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$API_ENDPOINT/customers/register" \
  -H "Content-Type: application/json"

# 2. Register missing email → expect 400
echo "POST /customers/register missing email → expect 400"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$API_ENDPOINT/customers/register" \
  -H "Content-Type: application/json" \
  -d '{"password":"'$PASSWORD'"}'

# 2b. Register missing password → expect 400
echo "POST /customers/register missing password → expect 400"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$API_ENDPOINT/customers/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"'$EMAIL'"}'

# 3. Register invalid email format → expect 400
echo "POST /customers/register invalid email → expect 400"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$API_ENDPOINT/customers/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email","password":"Foo1234!"}'

# 4. Duplicate registration → expect 400
echo "POST /customers/register duplicate user → expect 400"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$API_ENDPOINT/customers/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"'$EMAIL'","password":"'$PASSWORD'"}'

# 5. Login with wrong password → expect 401
echo "POST /customers/login wrong password → expect 401"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$API_ENDPOINT/customers/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"'$EMAIL'","password":"wrongpass"}'

# 6. Login missing fields → expect 400
echo "POST /customers/login missing password → expect 400"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$API_ENDPOINT/customers/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"'$EMAIL'"}'
echo "POST /customers/login missing email → expect 400"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$API_ENDPOINT/customers/login" \
  -H "Content-Type: application/json" \
  -d '{"password":"'$PASSWORD'"}'

echo "✅ Error-case tests complete."
set -e

# Improved assertion for HTTP status codes

echo
echo "❌ Running assertion-based error-case tests…"

# 1. Register without body → expect 400
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_ENDPOINT/customers/register")
[[ "$STATUS" == "400" ]] && echo "✓ 400 on empty register body" || echo "✗ expected 400, got $STATUS"

# 2. Register missing email → expect 400
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_ENDPOINT/customers/register" \
  -H "Content-Type: application/json" -d '{"password":"'$PASSWORD'"}')
[[ "$STATUS" == "400" ]] && echo "✓ 400 on missing email" || echo "✗ expected 400, got $STATUS"

# 3. Register missing password → expect 400
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_ENDPOINT/customers/register" \
  -H "Content-Type: application/json" -d '{"email":"'$EMAIL'"}')
[[ "$STATUS" == "400" ]] && echo "✓ 400 on missing password" || echo "✗ expected 400, got $STATUS"

# 4. Invalid email format → expect 400
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_ENDPOINT/customers/register" \
  -H "Content-Type: application/json" -d '{"email":"not-an-email","password":"Foo1234!"}')
[[ "$STATUS" == "400" ]] && echo "✓ 400 on invalid email format" || echo "✗ expected 400, got $STATUS"

# 5. Duplicate registration → expect 400
curl -s -X POST "$API_ENDPOINT/customers/register" -H "Content-Type: application/json" \
  -d '{"email":"'$EMAIL'","password":"'$PASSWORD'"}' > /dev/null
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_ENDPOINT/customers/register" \
  -H "Content-Type: application/json" -d '{"email":"'$EMAIL'","password":"'$PASSWORD'"}')
[[ "$STATUS" == "400" ]] && echo "✓ 400 on duplicate user" || echo "✗ expected 400, got $STATUS"

# 6. Login wrong password → expect 401
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_ENDPOINT/customers/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"'$EMAIL'","password":"wrongpass"}')
[[ "$STATUS" == "401" ]] && echo "✓ 401 on bad credentials" || echo "✗ expected 401, got $STATUS"

# 7. Unconfirmed user login → expect 401
TEST_UNCONF="unconf-$(date +%s)@example.com"
curl -s -X POST "$API_ENDPOINT/customers/register" -H "Content-Type: application/json" \
  -d '{"email":"'$TEST_UNCONF'","password":"'$PASSWORD'"}' > /dev/null
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_ENDPOINT/customers/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"'$TEST_UNCONF'","password":"'$PASSWORD'"}')
[[ "$STATUS" == "401" ]] && echo "✓ 401 on unconfirmed user" || echo "✗ expected 401, got $STATUS"

# 8. Missing fields on login → expect 400
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_ENDPOINT/customers/login" -H "Content-Type: application/json" -d '{"email":"'$EMAIL'"}')
[[ "$STATUS" == "400" ]] && echo "✓ 400 on missing password field" || echo "✗ expected 400, got $STATUS"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_ENDPOINT/customers/login" -H "Content-Type: application/json" -d '{"password":"'$PASSWORD'"}')
[[ "$STATUS" == "400" ]] && echo "✓ 400 on missing email field" || echo "✗ expected 400, got $STATUS"

echo "✅ Assertion-based error-case tests complete."

# Message-Content Assertion Tests
echo
echo "❌ Running message-content assertion tests…"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_ENDPOINT/customers/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"'$EMAIL'","password":"wrongpass"}')
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -n1)
if [[ "$STATUS" == "401" && \"$BODY\" =~ "NotAuthorizedException" ]]; then
  echo "✓ correct 401 + message on bad credentials"
else
  echo "✗ expected 401 + NotAuthorizedException, got $STATUS / $BODY"
fi

# Rate-Limit / Flood Protection Test
echo
echo "❌ Running rate-limit test…"
LAST_CODE=""
for i in {1..10}; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_ENDPOINT/customers/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"'$EMAIL'","password":"'$PASSWORD'"}')
  LAST_CODE=$CODE
done
if [[ "$LAST_CODE" == "429" ]]; then
  echo "✓ rate-limited after burst"
else
  echo "✗ expected 429 rate-limit, got $LAST_CODE"
fi
