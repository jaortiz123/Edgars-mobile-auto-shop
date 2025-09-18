#!/usr/bin/env python3
"""
Direct SQLite connection test to verify database operations work.
"""

import sqlite3


def test_sqlite_direct():
    """Test direct SQLite operations"""
    db_path = "/Users/jesusortiz/Edgars-mobile-auto-shop/database/local_shop.db"

    print("🔍 Testing direct SQLite connection...")

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Test basic query
        cursor.execute("SELECT COUNT(*) as count FROM tenants")
        result = cursor.fetchone()
        print(f"✅ Found {result[0]} tenants")

        # Test tenant data
        cursor.execute("SELECT id, slug, name FROM tenants")
        tenants = cursor.fetchall()
        for tenant in tenants:
            print(f"   - {tenant['slug']}: {tenant['name']} ({tenant['id']})")

        # Test admin users
        cursor.execute("SELECT COUNT(*) as count FROM admin_users")
        result = cursor.fetchone()
        print(f"✅ Found {result[0]} admin users")

        # Test insert operation (admin registration simulation)
        test_email = "test@tenant-a.com"
        test_tenant_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

        # Check if user exists
        cursor.execute("SELECT id FROM admin_users WHERE email = ?", (test_email,))
        existing = cursor.fetchone()

        if existing:
            print(f"✅ Test user {test_email} already exists")
        else:
            # Try to insert
            cursor.execute(
                """
                INSERT INTO admin_users (tenant_id, email, password_hash, name, role)
                VALUES (?, ?, ?, ?, ?)
            """,
                (test_tenant_id, test_email, "test_hash", "Test Admin", "admin"),
            )
            conn.commit()
            print(f"✅ Successfully inserted test user {test_email}")

        conn.close()
        print("🎯 SQLite database operations working correctly!")
        return True

    except Exception as e:
        print(f"❌ SQLite test failed: {e}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    test_sqlite_direct()
