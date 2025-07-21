#!/bin/bash

# Test Frontend Authentication Flow
# This script tests the complete authentication flow from registration to profile management

set -e

API_URL="http://localhost:5001"
EMAIL="test-$(date +%s)@example.com"
PASSWORD="TestPass123!"

echo "🚀 Testing Frontend Authentication Flow"
echo "======================================="
echo "API URL: $API_URL"
echo "Test Email: $EMAIL"
echo "Test Password: $PASSWORD"
echo ""

# 1. Test User Registration
echo "1. Testing User Registration..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/customers/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

echo "Registration Response: $REGISTER_RESPONSE"

if echo "$REGISTER_RESPONSE" | grep -q "User registered successfully"; then
    echo "✅ Registration successful"
else
    echo "❌ Registration failed"
    exit 1
fi

echo ""

# 2. Test User Login
echo "2. Testing User Login..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/customers/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

echo "Login Response: $LOGIN_RESPONSE"

# Extract token using a more robust method
TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('token', ''))
except:
    pass
")

if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    echo "✅ Login successful"
    echo "Token: ${TOKEN:0:50}..."
else
    echo "❌ Login failed - could not extract token"
    echo "Response was: $LOGIN_RESPONSE"
    exit 1
fi

echo ""

# 3. Test Profile Access (Empty Profile)
echo "3. Testing Profile Access (should be empty)..."
PROFILE_RESPONSE=$(curl -s -X GET "$API_URL/customers/profile" \
  -H "Authorization: Bearer $TOKEN")

echo "Profile Response: $PROFILE_RESPONSE"

if echo "$PROFILE_RESPONSE" | grep -q "email"; then
    echo "✅ Profile access successful"
else
    echo "❌ Profile access failed"
    exit 1
fi

echo ""

# 4. Test Profile Update
echo "4. Testing Profile Update..."
UPDATE_RESPONSE=$(curl -s -X PUT "$API_URL/customers/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\":\"$EMAIL\",
    \"vehicles\":[
      {\"make\":\"Toyota\",\"model\":\"Camry\",\"year\":2020,\"license_plate\":\"ABC123\"},
      {\"make\":\"Honda\",\"model\":\"Civic\",\"year\":2019,\"license_plate\":\"XYZ789\"}
    ]
  }")

echo "Update Response: $UPDATE_RESPONSE"

if echo "$UPDATE_RESPONSE" | grep -q "Profile updated successfully"; then
    echo "✅ Profile update successful"
else
    echo "❌ Profile update failed"
    exit 1
fi

echo ""

# 5. Test Profile Access (With Data)
echo "5. Testing Profile Access (should have vehicles)..."
PROFILE_RESPONSE=$(curl -s -X GET "$API_URL/customers/profile" \
  -H "Authorization: Bearer $TOKEN")

echo "Profile Response: $PROFILE_RESPONSE"

if echo "$PROFILE_RESPONSE" | grep -q "Toyota" && echo "$PROFILE_RESPONSE" | grep -q "Honda"; then
    echo "✅ Profile with vehicles retrieved successfully"
else
    echo "❌ Profile with vehicles failed"
    exit 1
fi

echo ""

# 6. Test Invalid Token
echo "6. Testing Invalid Token..."
INVALID_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$API_URL/customers/profile" \
  -H "Authorization: Bearer invalid-token")

if [ "$INVALID_RESPONSE" = "401" ]; then
    echo "✅ Invalid token properly rejected"
else
    echo "❌ Invalid token not rejected (got $INVALID_RESPONSE)"
    exit 1
fi

echo ""

# 7. Test Wrong Password Login
echo "7. Testing Wrong Password..."
WRONG_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/customers/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"WrongPassword123!\"}")

if [ "$WRONG_RESPONSE" = "401" ]; then
    echo "✅ Wrong password properly rejected"
else
    echo "❌ Wrong password not rejected (got $WRONG_RESPONSE)"
    exit 1
fi

echo ""
echo "🎉 All Authentication Tests Passed!"
echo "======================================="
echo "✅ User Registration"
echo "✅ User Login"
echo "✅ Profile Access"
echo "✅ Profile Updates"
echo "✅ Token Validation"
echo "✅ Invalid Token Rejection"
echo "✅ Wrong Password Rejection"
echo ""
echo "Authentication system is working correctly!"
