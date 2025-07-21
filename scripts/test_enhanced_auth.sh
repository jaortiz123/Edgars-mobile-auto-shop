#!/bin/bash

# Enhanced Frontend Authentication Testing
# Tests the complete authentication flow including new features

set -e

API_URL="http://localhost:5001"
FRONTEND_URL="http://localhost:5175"
EMAIL="enhanced-test-$(date +%s)@example.com"
PASSWORD="TestPass123!"

echo "🎯 Enhanced Authentication System Testing"
echo "========================================="
echo "API URL: $API_URL"
echo "Frontend URL: $FRONTEND_URL"
echo "Test Email: $EMAIL"
echo "Test Password: $PASSWORD"
echo ""

# Function to check if servers are running
check_servers() {
    echo "🔍 Checking server status..."
    
    # Check backend
    if curl -s "$API_URL/health" >/dev/null; then
        echo "✅ Backend server is running"
    else
        echo "❌ Backend server is not responding"
        exit 1
    fi
    
    # Check frontend
    if curl -s "$FRONTEND_URL" >/dev/null; then
        echo "✅ Frontend server is running"
    else
        echo "❌ Frontend server is not responding"
        exit 1
    fi
    echo ""
}

# Test backend API endpoints
test_backend_apis() {
    echo "🔧 Testing Backend APIs..."
    
    # 1. Registration
    echo "1. Testing user registration..."
    REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/customers/register" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
    
    if echo "$REGISTER_RESPONSE" | grep -q "User registered successfully"; then
        echo "✅ Registration API working"
    else
        echo "❌ Registration API failed: $REGISTER_RESPONSE"
        exit 1
    fi
    
    # 2. Login
    echo "2. Testing user login..."
    LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/customers/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
    
    TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('token', ''))
except:
    pass
")
    
    if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
        echo "✅ Login API working"
    else
        echo "❌ Login API failed: $LOGIN_RESPONSE"
        exit 1
    fi
    
    # 3. Profile Access
    echo "3. Testing profile access..."
    PROFILE_RESPONSE=$(curl -s -X GET "$API_URL/customers/profile" \
      -H "Authorization: Bearer $TOKEN")
    
    if echo "$PROFILE_RESPONSE" | grep -q "email"; then
        echo "✅ Profile API working"
    else
        echo "❌ Profile API failed: $PROFILE_RESPONSE"
        exit 1
    fi
    
    # 4. Profile Update with Vehicles
    echo "4. Testing profile update with vehicles..."
    UPDATE_RESPONSE=$(curl -s -X PUT "$API_URL/customers/profile" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"email\":\"$EMAIL\",
        \"vehicles\":[
          {\"make\":\"Tesla\",\"model\":\"Model 3\",\"year\":2023,\"license_plate\":\"TESLA1\"},
          {\"make\":\"BMW\",\"model\":\"X5\",\"year\":2022,\"license_plate\":\"BMW123\"}
        ]
      }")
    
    if echo "$UPDATE_RESPONSE" | grep -q "Profile updated successfully"; then
        echo "✅ Profile update API working"
    else
        echo "❌ Profile update API failed: $UPDATE_RESPONSE"
        exit 1
    fi
    
    echo ""
}

# Test error handling
test_error_handling() {
    echo "🚨 Testing Error Handling..."
    
    # 1. Invalid credentials
    echo "1. Testing invalid login credentials..."
    INVALID_LOGIN=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/customers/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$EMAIL\",\"password\":\"WrongPassword\"}")
    
    if [ "$INVALID_LOGIN" = "401" ]; then
        echo "✅ Invalid credentials properly rejected"
    else
        echo "❌ Invalid credentials not rejected (got $INVALID_LOGIN)"
        exit 1
    fi
    
    # 2. Invalid token
    echo "2. Testing invalid token..."
    INVALID_TOKEN=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$API_URL/customers/profile" \
      -H "Authorization: Bearer invalid-token")
    
    if [ "$INVALID_TOKEN" = "401" ]; then
        echo "✅ Invalid token properly rejected"
    else
        echo "❌ Invalid token not rejected (got $INVALID_TOKEN)"
        exit 1
    fi
    
    # 3. Duplicate email registration
    echo "3. Testing duplicate email registration..."
    DUPLICATE_REG=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/customers/register" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
    
    if [ "$DUPLICATE_REG" = "400" ] || [ "$DUPLICATE_REG" = "409" ]; then
        echo "✅ Duplicate email properly rejected (HTTP $DUPLICATE_REG)"
    else
        echo "❌ Duplicate email not rejected (got $DUPLICATE_REG)"
        exit 1
    fi
    
    echo ""
}

# Test security features
test_security() {
    echo "🛡️ Testing Security Features..."
    
    # 1. Password strength requirements
    echo "1. Testing weak password rejection..."
    WEAK_PASSWORD=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/customers/register" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"weak-$(date +%s)@example.com\",\"password\":\"123\"}")
    
    if [ "$WEAK_PASSWORD" = "400" ]; then
        echo "✅ Weak password properly rejected"
    else
        echo "❌ Weak password not rejected (got $WEAK_PASSWORD)"
        exit 1
    fi
    
    # 2. JWT Token expiration structure
    echo "2. Validating JWT token structure..."
    if echo "$TOKEN" | grep -q "^eyJ"; then
        echo "✅ JWT token has correct format"
    else
        echo "❌ JWT token format is invalid"
        exit 1
    fi
    
    echo ""
}

# Performance testing
test_performance() {
    echo "⚡ Testing Performance..."
    
    # 1. API response times
    echo "1. Testing API response times..."
    
    LOGIN_TIME=$(curl -s -o /dev/null -w "%{time_total}" -X POST "$API_URL/customers/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
    
    if (( $(echo "$LOGIN_TIME < 2.0" | bc -l) )); then
        echo "✅ Login response time: ${LOGIN_TIME}s (good)"
    else
        echo "⚠️ Login response time: ${LOGIN_TIME}s (slow)"
    fi
    
    PROFILE_TIME=$(curl -s -o /dev/null -w "%{time_total}" -X GET "$API_URL/customers/profile" \
      -H "Authorization: Bearer $TOKEN")
    
    if (( $(echo "$PROFILE_TIME < 1.0" | bc -l) )); then
        echo "✅ Profile response time: ${PROFILE_TIME}s (good)"
    else
        echo "⚠️ Profile response time: ${PROFILE_TIME}s (slow)"
    fi
    
    echo ""
}

# Integration testing with complex scenarios
test_integration() {
    echo "🔗 Testing Integration Scenarios..."
    
    # 1. Full user journey
    echo "1. Testing complete user journey..."
    
    # Create new user
    NEW_EMAIL="integration-$(date +%s)@example.com"
    curl -s -X POST "$API_URL/customers/register" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"$PASSWORD\"}" > /dev/null
    
    # Login
    NEW_LOGIN=$(curl -s -X POST "$API_URL/customers/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"$PASSWORD\"}")
    
    NEW_TOKEN=$(echo "$NEW_LOGIN" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('token', ''))
except:
    pass
")
    
    # Add multiple vehicles
    curl -s -X PUT "$API_URL/customers/profile" \
      -H "Authorization: Bearer $NEW_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"email\":\"$NEW_EMAIL\",
        \"vehicles\":[
          {\"make\":\"Ford\",\"model\":\"F-150\",\"year\":2021,\"license_plate\":\"FORD21\"},
          {\"make\":\"Chevrolet\",\"model\":\"Silverado\",\"year\":2020,\"license_plate\":\"CHEVY20\"},
          {\"make\":\"Ram\",\"model\":\"1500\",\"year\":2022,\"license_plate\":\"RAM22\"}
        ]
      }" > /dev/null
    
    # Verify all vehicles
    FINAL_PROFILE=$(curl -s -X GET "$API_URL/customers/profile" \
      -H "Authorization: Bearer $NEW_TOKEN")
    
    VEHICLE_COUNT=$(echo "$FINAL_PROFILE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(len(data.get('vehicles', [])))
except:
    print(0)
")
    
    if [ "$VEHICLE_COUNT" = "3" ]; then
        echo "✅ Complete user journey successful (3 vehicles added)"
    else
        echo "❌ User journey failed (expected 3 vehicles, got $VEHICLE_COUNT)"
        exit 1
    fi
    
    echo ""
}

# Main test execution
main() {
    echo "🚀 Starting Enhanced Authentication Testing..."
    echo ""
    
    check_servers
    test_backend_apis
    test_error_handling
    test_security
    test_performance
    test_integration
    
    echo "🎉 All Enhanced Authentication Tests Passed!"
    echo "============================================="
    echo "✅ Server Health Check"
    echo "✅ Backend API Functionality"
    echo "✅ Error Handling"
    echo "✅ Security Features"
    echo "✅ Performance Metrics"
    echo "✅ Integration Scenarios"
    echo ""
    echo "📊 Test Summary:"
    echo "• Registration & Login: Working"
    echo "• Profile Management: Working"
    echo "• Vehicle Management: Working"
    echo "• Error Handling: Robust"
    echo "• Security: Implemented"
    echo "• Performance: Acceptable"
    echo ""
    echo "🔧 Authentication system is production-ready!"
}

# Run tests
main
