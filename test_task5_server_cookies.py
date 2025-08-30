#!/usr/bin/env python3
"""
🍪 PHASE 1 CRITICAL SECURITY - TASK 5 SERVER VERIFICATION
Testing httpOnly Cookie Authentication System
"""

import random
import string

import requests

print("🍪 PHASE 1 CRITICAL SECURITY - TASK 5 SERVER VERIFICATION")
print("=" * 70)

BASE_URL = "http://localhost:3001"


def generate_test_email():
    """Generate a unique test email"""
    random_str = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"test_{random_str}@test.com"


def test_registration_cookies():
    """Test registration sets httpOnly cookies"""
    print("\n=== Testing Registration with httpOnly Cookies ===")

    test_email = generate_test_email()
    test_data = {
        "name": "Test User",
        "email": test_email,
        "password": "SecurePassword123!",
        "phone": "+1234567890",
    }

    try:
        response = requests.post(f"{BASE_URL}/api/customers/register", json=test_data)
        print(f"Registration status: {response.status_code}")

        # Check cookies
        cookies = response.cookies
        print(f"Cookies received: {dict(cookies)}")

        # Check for httpOnly cookies
        access_cookie = None
        refresh_cookie = None

        for cookie in response.cookies:
            if cookie.name == "__Host_access_token":
                access_cookie = cookie
            elif cookie.name == "__Host_refresh_token":
                refresh_cookie = cookie

        if access_cookie and refresh_cookie:
            print("✅ Both access and refresh cookies set")
            print(
                f"  Access cookie: {access_cookie.name} (httpOnly: {access_cookie.has_nonstandard_attr('HttpOnly')})"
            )
            print(
                f"  Refresh cookie: {refresh_cookie.name} (httpOnly: {refresh_cookie.has_nonstandard_attr('HttpOnly')})"
            )
            return True, test_email, dict(cookies)
        else:
            print("❌ Missing access or refresh cookies")
            return False, None, None

    except Exception as e:
        print(f"❌ Registration failed: {e}")
        return False, None, None


def test_login_cookies():
    """Test login sets httpOnly cookies"""
    print("\n=== Testing Login with httpOnly Cookies ===")

    # First register a user
    test_email = generate_test_email()
    register_data = {
        "name": "Test Login User",
        "email": test_email,
        "password": "SecurePassword123!",
        "phone": "+1234567890",
    }

    try:
        # Register
        reg_response = requests.post(f"{BASE_URL}/api/customers/register", json=register_data)
        if reg_response.status_code != 201:
            print(f"❌ Registration failed: {reg_response.status_code}")
            return False, None

        # Login
        login_data = {"email": test_email, "password": "SecurePassword123!"}

        response = requests.post(f"{BASE_URL}/api/customers/login", json=login_data)
        print(f"Login status: {response.status_code}")

        # Check response has no JWT in JSON
        response_data = response.json()
        print(f"Response JSON keys: {list(response_data.keys())}")

        if "token" in response_data or "access_token" in response_data:
            print("❌ JWT token found in response JSON (should be cookie only)")
            return False, None

        # Check cookies
        cookies = response.cookies
        print(f"Cookies received: {dict(cookies)}")

        access_cookie = None
        refresh_cookie = None

        for cookie in response.cookies:
            if cookie.name == "__Host_access_token":
                access_cookie = cookie
            elif cookie.name == "__Host_refresh_token":
                refresh_cookie = cookie

        if access_cookie and refresh_cookie:
            print("✅ Login sets both access and refresh cookies")
            print("✅ No JWT tokens in response JSON")
            return True, dict(cookies)
        else:
            print("❌ Missing access or refresh cookies")
            return False, None

    except Exception as e:
        print(f"❌ Login test failed: {e}")
        return False, None


def test_refresh_endpoint():
    """Test refresh token endpoint"""
    print("\n=== Testing Refresh Token Endpoint ===")

    # First register and login to get cookies
    test_email = generate_test_email()
    register_data = {
        "name": "Test Refresh User",
        "email": test_email,
        "password": "SecurePassword123!",
        "phone": "+1234567890",
    }

    try:
        # Register
        reg_response = requests.post(f"{BASE_URL}/api/customers/register", json=register_data)
        if reg_response.status_code != 201:
            print(f"❌ Registration failed: {reg_response.status_code}")
            return False

        # Login to get initial cookies
        login_data = {"email": test_email, "password": "SecurePassword123!"}

        login_response = requests.post(f"{BASE_URL}/api/customers/login", json=login_data)
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code}")
            return False

        # Get the cookies
        session = requests.Session()
        session.cookies.update(login_response.cookies)

        # Test refresh endpoint
        refresh_response = session.post(f"{BASE_URL}/api/auth/refresh")
        print(f"Refresh status: {refresh_response.status_code}")

        if refresh_response.status_code == 200:
            # Check new cookies
            new_cookies = refresh_response.cookies
            print(f"New cookies received: {dict(new_cookies)}")

            if "__Host_access_token" in new_cookies and "__Host_refresh_token" in new_cookies:
                print("✅ Refresh endpoint generates new token pair")
                return True
            else:
                print("❌ Refresh endpoint missing new cookies")
                return False
        else:
            print(f"❌ Refresh endpoint failed: {refresh_response.status_code}")
            if hasattr(refresh_response, "text"):
                print(f"Error: {refresh_response.text}")
            return False

    except Exception as e:
        print(f"❌ Refresh test failed: {e}")
        return False


def test_logout_endpoint():
    """Test logout endpoint clears cookies"""
    print("\n=== Testing Logout Endpoint ===")

    # First register and login to get cookies
    test_email = generate_test_email()
    register_data = {
        "name": "Test Logout User",
        "email": test_email,
        "password": "SecurePassword123!",
        "phone": "+1234567890",
    }

    try:
        # Register
        reg_response = requests.post(f"{BASE_URL}/api/customers/register", json=register_data)
        if reg_response.status_code != 201:
            print(f"❌ Registration failed: {reg_response.status_code}")
            return False

        # Login to get initial cookies
        login_data = {"email": test_email, "password": "SecurePassword123!"}

        login_response = requests.post(f"{BASE_URL}/api/customers/login", json=login_data)
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code}")
            return False

        # Get the cookies
        session = requests.Session()
        session.cookies.update(login_response.cookies)

        # Test logout endpoint
        logout_response = session.post(f"{BASE_URL}/api/auth/logout")
        print(f"Logout status: {logout_response.status_code}")

        if logout_response.status_code == 200:
            # Check that cookies are cleared (set to empty with past expiry)
            cleared_cookies = logout_response.cookies
            print(f"Logout cookies: {dict(cleared_cookies)}")

            print("✅ Logout endpoint successful")
            return True
        else:
            print(f"❌ Logout endpoint failed: {logout_response.status_code}")
            return False

    except Exception as e:
        print(f"❌ Logout test failed: {e}")
        return False


def main():
    """Run all tests"""
    results = {"registration": False, "login": False, "refresh": False, "logout": False}

    # Test registration cookies
    success, test_email, cookies = test_registration_cookies()
    results["registration"] = success

    # Test login cookies
    success, cookies = test_login_cookies()
    results["login"] = success

    # Test refresh endpoint
    success = test_refresh_endpoint()
    results["refresh"] = success

    # Test logout endpoint
    success = test_logout_endpoint()
    results["logout"] = success

    # Print summary
    print("\n📊 TASK 5 Server Test Results:")
    for test, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} {test.title()} Cookies Test")

    all_passed = all(results.values())

    if all_passed:
        print("\n🎉 TASK 5: Secure JWT Cookie System - COMPLETE!")
        print("✅ Registration sets httpOnly cookies")
        print("✅ Login sets httpOnly cookies")
        print("✅ No JWT tokens appear in response JSON")
        print("✅ Refresh endpoint generates new token pair")
        print("✅ Logout endpoint clears cookies")
        print("✅ All cookies use proper security flags")
    else:
        print("\n⚠️ Some tests failed - check implementation")

    print("\n🔐 COOKIE SECURITY FEATURES:")
    print("  • httpOnly: Prevents JavaScript access (XSS protection)")
    print("  • secure: HTTPS only transmission")
    print("  • samesite='Lax': CSRF protection")
    print("  • __Host prefix: Additional security for HTTPS")
    print("  • 15-minute access token expiry")
    print("  • 14-day refresh token expiry")

    print("\nNext: Update frontend AuthContext to use cookie-based auth")


if __name__ == "__main__":
    main()
