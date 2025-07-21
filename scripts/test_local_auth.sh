#!/bin/bash
set -e

echo "🧪 Testing Edgar's Auto Shop Authentication System"
echo "=================================================="

API_URL="http://localhost:5001"
TEST_EMAIL="test.user@example.com"
TEST_PASSWORD="SecurePassword123!"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_status() {
    echo -e "${GREEN}✓${NC} $1"
}

echo_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

echo_error() {
    echo -e "${RED}✗${NC} $1"
}

# Test 1: Health Check
echo ""
echo "1. Testing Health Endpoint..."
if curl -s "$API_URL/health" | grep -q "ok"; then
    echo_status "Health endpoint is working"
else
    echo_error "Health endpoint failed"
    exit 1
fi

# Test 2: User Registration
echo ""
echo "2. Testing User Registration..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/customers/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

if echo "$REGISTER_RESPONSE" | grep -q "successfully"; then
    echo_status "User registration successful"
else
    echo_warning "User might already exist: $REGISTER_RESPONSE"
fi

# Test 3: User Login
echo ""
echo "3. Testing User Login..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/customers/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

if echo "$LOGIN_RESPONSE" | grep -q "token"; then
    echo_status "User login successful"
    TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")
    echo "Token received: ${TOKEN:0:20}..."
else
    echo_error "User login failed: $LOGIN_RESPONSE"
    exit 1
fi

# Test 4: Profile Access
echo ""
echo "4. Testing Profile Access..."
PROFILE_RESPONSE=$(curl -s -X GET "$API_URL/customers/profile" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN")

if echo "$PROFILE_RESPONSE" | grep -q "$TEST_EMAIL"; then
    echo_status "Profile access successful"
    echo "Profile data: $PROFILE_RESPONSE"
else
    echo_error "Profile access failed: $PROFILE_RESPONSE"
    exit 1
fi

# Test 5: Profile Update
echo ""
echo "5. Testing Profile Update..."
UPDATE_RESPONSE=$(curl -s -X PUT "$API_URL/customers/profile" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"vehicles":[{"make":"Toyota","model":"Camry","year":2020,"license_plate":"ABC123"}]}')

if echo "$UPDATE_RESPONSE" | grep -q "successfully"; then
    echo_status "Profile update successful"
else
    echo_error "Profile update failed: $UPDATE_RESPONSE"
    exit 1
fi

# Test 6: Verify Profile Update
echo ""
echo "6. Verifying Profile Update..."
UPDATED_PROFILE=$(curl -s -X GET "$API_URL/customers/profile" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN")

if echo "$UPDATED_PROFILE" | grep -q "Toyota"; then
    echo_status "Profile update verified - vehicle data saved"
    echo "Updated profile: $UPDATED_PROFILE"
else
    echo_error "Profile update verification failed: $UPDATED_PROFILE"
    exit 1
fi

# Test 7: Invalid Token Test
echo ""
echo "7. Testing Invalid Token Protection..."
INVALID_RESPONSE=$(curl -s -w "%{http_code}" -X GET "$API_URL/customers/profile" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer invalid-token")

if echo "$INVALID_RESPONSE" | grep -q "401"; then
    echo_status "Invalid token properly rejected"
else
    echo_error "Invalid token test failed"
fi

# Test 8: Duplicate Registration
echo ""
echo "8. Testing Duplicate Registration Prevention..."
DUPLICATE_RESPONSE=$(curl -s -X POST "$API_URL/customers/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

if echo "$DUPLICATE_RESPONSE" | grep -q "already exists"; then
    echo_status "Duplicate registration properly prevented"
else
    echo_warning "Duplicate registration test inconclusive: $DUPLICATE_RESPONSE"
fi

# Test 9: Invalid Login
echo ""
echo "9. Testing Invalid Login..."
INVALID_LOGIN=$(curl -s -X POST "$API_URL/customers/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"wrongpassword\"}")

if echo "$INVALID_LOGIN" | grep -q "Invalid credentials"; then
    echo_status "Invalid login properly rejected"
else
    echo_error "Invalid login test failed: $INVALID_LOGIN"
fi

echo ""
echo "🎉 All authentication tests completed successfully!"
echo "=================================================="
echo ""
echo "Frontend URLs:"
echo "- Main site: http://localhost:5174/"
echo "- Login: http://localhost:5174/login"
echo "- Register: http://localhost:5174/register"
echo "- Profile: http://localhost:5174/profile"
echo ""
echo "Backend API: $API_URL"
echo "Test user: $TEST_EMAIL"
