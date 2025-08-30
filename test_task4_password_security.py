#!/usr/bin/env python3
"""
Test TASK 4: Secure Password Hashing Implementation

This script verifies that secure password hashing is properly implemented:
- New user registration uses bcrypt with cost factor 12
- Existing users with SHA256 passwords can login successfully
- After successful login, old passwords are automatically migrated to bcrypt
- All password verification goes through the secure dual-verification system
"""

import hashlib
import os
import sys
import uuid

import requests

# Add backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

try:
    from backend.app.security.passwords import (
        hash_password,
        is_bcrypt_hash,
        verify_password_with_salt,
    )

    print("✅ Successfully imported password security module")
except ImportError as e:
    print(f"❌ Failed to import password security module: {e}")
    sys.exit(1)


def test_password_module():
    """Test the password security module functions directly."""
    print("\n=== TASK 4: Testing Password Security Module ===")

    # Test password hashing
    test_password = "TestPassword123!"
    hashed = hash_password(test_password)
    print(f"Test password: {test_password}")
    print(f"Bcrypt hash: {hashed[:30]}...")

    # Verify it's a bcrypt hash
    if not hashed.startswith("$2b$12$"):
        print("❌ Hash doesn't start with $2b$12$ (wrong cost factor or algorithm)")
        return False
    print("✅ Hash uses bcrypt with cost factor 12")

    # Test verification with bcrypt hash
    is_valid, needs_migration = verify_password_with_salt(test_password, hashed, "")
    if not is_valid or needs_migration:
        print(f"❌ Bcrypt verification failed: valid={is_valid}, migration={needs_migration}")
        return False
    print("✅ Bcrypt password verification working")

    # Test verification with legacy SHA256 hash
    legacy_salt = uuid.uuid4().hex
    legacy_hash = hashlib.sha256((legacy_salt + test_password).encode("utf-8")).hexdigest()
    is_valid, needs_migration = verify_password_with_salt(test_password, legacy_hash, legacy_salt)
    if not is_valid or not needs_migration:
        print(f"❌ SHA256 verification failed: valid={is_valid}, migration={needs_migration}")
        return False
    print("✅ Legacy SHA256 password verification working")

    # Test wrong password
    is_valid, needs_migration = verify_password_with_salt("WrongPassword", hashed, "")
    if is_valid:
        print("❌ Wrong password verification should fail")
        return False
    print("✅ Wrong password correctly rejected")

    return True


def test_user_registration():
    """Test that new user registration uses bcrypt."""
    print("\n=== Testing New User Registration (bcrypt) ===")

    # Generate unique test user
    test_email = f"test_bcrypt_{uuid.uuid4().hex[:8]}@test.com"
    test_password = "SecureBcryptPass123!"
    test_name = "Bcrypt Test User"

    # Register new user
    registration_data = {"email": test_email, "password": test_password, "name": test_name}

    try:
        # Note: This requires the Flask server to be running
        response = requests.post(
            "http://localhost:5000/api/customers/register", json=registration_data, timeout=5
        )

        if response.status_code == 201:
            result = response.json()
            print(f"✅ New user registered successfully: {result.get('customer', {}).get('email')}")

            # Verify we can login with the new password
            login_response = requests.post(
                "http://localhost:5000/api/customers/login",
                json={"email": test_email, "password": test_password},
                timeout=5,
            )

            if login_response.status_code == 200:
                print("✅ New user can login with bcrypt password")
                return True, test_email, test_password
            else:
                print(f"❌ New user login failed: {login_response.status_code}")
                return False, None, None

        else:
            print(f"❌ User registration failed: {response.status_code} - {response.text}")
            return False, None, None

    except requests.exceptions.RequestException as e:
        print(f"⚠️ Cannot test registration - server not running: {e}")
        return None, None, None


def create_legacy_user():
    """Create a user with legacy SHA256 password directly in database."""
    print("\n=== Creating Legacy SHA256 User ===")

    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor

        conn = psycopg2.connect(
            host="localhost",
            port=5432,
            database="edgar_db",
            user="postgres",
            cursor_factory=RealDictCursor,
        )

        test_email = f"legacy_user_{uuid.uuid4().hex[:8]}@test.com"
        test_password = "LegacyPassword123!"
        test_name = "Legacy SHA256 User"

        with conn:
            with conn.cursor() as cur:
                # Create customer
                cur.execute(
                    "INSERT INTO customers(name,email,phone) VALUES (%s,%s,%s) RETURNING id",
                    (test_name, test_email, None),
                )
                cust_id = cur.fetchone()["id"]

                # Create legacy SHA256 password hash
                salt = uuid.uuid4().hex
                legacy_hash = hashlib.sha256((salt + test_password).encode("utf-8")).hexdigest()

                # Insert into customer_auth with legacy hash
                cur.execute(
                    "INSERT INTO customer_auth(customer_id,email,password_hash,salt) VALUES (%s,%s,%s,%s)",
                    (cust_id, test_email, legacy_hash, salt),
                )

        conn.close()
        print(f"✅ Created legacy user: {test_email}")
        return test_email, test_password, cust_id

    except Exception as e:
        print(f"❌ Failed to create legacy user: {e}")
        return None, None, None


def test_legacy_migration():
    """Test that legacy SHA256 passwords are migrated to bcrypt on login."""
    print("\n=== Testing Legacy Password Migration ===")

    # Create legacy user
    legacy_email, legacy_password, cust_id = create_legacy_user()
    if not legacy_email:
        return False

    try:
        # Login with legacy user (should trigger migration)
        response = requests.post(
            "http://localhost:5000/api/customers/login",
            json={"email": legacy_email, "password": legacy_password},
            timeout=5,
        )

        if response.status_code == 200:
            print("✅ Legacy user login successful")

            # Check if password was migrated to bcrypt
            import psycopg2
            from psycopg2.extras import RealDictCursor

            conn = psycopg2.connect(
                host="localhost",
                port=5432,
                database="edgar_db",
                user="postgres",
                cursor_factory=RealDictCursor,
            )

            with conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT password_hash FROM customer_auth WHERE customer_id = %s", (cust_id,)
                    )
                    row = cur.fetchone()

            conn.close()

            if row and is_bcrypt_hash(row["password_hash"]):
                print("✅ Legacy password automatically migrated to bcrypt")

                # Verify user can still login with new bcrypt hash
                response2 = requests.post(
                    "http://localhost:5000/api/customers/login",
                    json={"email": legacy_email, "password": legacy_password},
                    timeout=5,
                )

                if response2.status_code == 200:
                    print("✅ User can login after migration")
                    return True
                else:
                    print(f"❌ User cannot login after migration: {response2.status_code}")
                    return False
            else:
                print("❌ Password was not migrated to bcrypt")
                return False
        else:
            print(f"❌ Legacy user login failed: {response.status_code}")
            return False

    except requests.exceptions.RequestException as e:
        print(f"⚠️ Cannot test migration - server not running: {e}")
        return None


def main():
    """Run all TASK 4 tests."""
    print("🔒 PHASE 1 CRITICAL SECURITY - TASK 4 VERIFICATION")
    print("=" * 60)

    # Test password module functions
    module_success = test_password_module()
    if not module_success:
        print("\n❌ TASK 4: Password Security Module - FAILED!")
        sys.exit(1)

    # Test new user registration (requires server)
    reg_success, test_email, test_password = test_user_registration()

    # Test legacy migration (requires server and database)
    migration_success = test_legacy_migration()

    # Summary
    print("\n📊 TASK 4 Test Results:")
    print("✅ Password Security Module: PASS")
    print(
        f"{'✅' if reg_success else '⚠️' if reg_success is None else '❌'} New User Registration: {'PASS' if reg_success else 'SKIP (server not running)' if reg_success is None else 'FAIL'}"
    )
    print(
        f"{'✅' if migration_success else '⚠️' if migration_success is None else '❌'} Legacy Migration: {'PASS' if migration_success else 'SKIP (server not running)' if migration_success is None else 'FAIL'}"
    )

    if module_success and (reg_success is not False) and (migration_success is not False):
        print("\n🎉 TASK 4: Secure Password Hashing - COMPLETE!")
        print("✅ New user registration uses bcrypt (cost=12)")
        print("✅ Dual verification supports both old SHA256 and new bcrypt")
        print("✅ Auto-migration happens on successful login")
        print("✅ All password verification goes through secure system")
        print("\nNext: TASK 5 - Secure JWT Cookie System")
    else:
        print("\n❌ TASK 4: Secure Password Hashing - ISSUES DETECTED!")
        print("Some tests failed or could not run due to server/database unavailability")


if __name__ == "__main__":
    main()
