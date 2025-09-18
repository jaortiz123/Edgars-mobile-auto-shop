#!/usr/bin/env python3
"""Create test tenants for validation testing"""

import psycopg2
from psycopg2.extras import RealDictCursor


def create_test_tenants():
    # Use same DB config as Flask app
    # For now, let's try the standard connection string
    db_config = {
        "host": "localhost",
        "database": "edgar_automotive_db",
        "user": "postgres",
        "password": "",
        "port": 5432,
    }

    try:
        conn = psycopg2.connect(**db_config)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Check existing tenants
            cur.execute("SELECT id, name FROM tenants ORDER BY name")
            tenants = cur.fetchall()
            print("Existing tenants:")
            for tenant in tenants:
                print(f'  {tenant["id"]} - {tenant["name"]}')

            # Create both test tenants
            test_tenants = [
                ("00000000-0000-0000-0000-000000000001", "Test Tenant 1", "test-tenant-1"),
                ("00000000-0000-0000-0000-000000000002", "Test Tenant 2", "test-tenant-2"),
            ]

            for tenant_id, name, slug in test_tenants:
                cur.execute("SELECT id FROM tenants WHERE id = %s", (tenant_id,))
                if not cur.fetchone():
                    print(f"\nCreating tenant: {name} ({tenant_id})")
                    cur.execute(
                        "INSERT INTO tenants (id, name, slug, is_active) VALUES (%s, %s, %s, %s)",
                        (tenant_id, name, slug, True),
                    )
                    conn.commit()
                    print(f"✅ {name} created")
                else:
                    print(f"\n✓ {name} already exists")

        conn.close()
        print("\n🎯 Test tenants ready for validation")

    except Exception as e:
        print(f"Database connection failed: {e}")
        print("Trying alternative connection...")

        # Try alternative connection method
        try:
            conn = psycopg2.connect(
                host="localhost",
                database="edgar_automotive_db",
                user="edgar_user",
                password="edgar_secure_2023",
                port=5432,
            )

            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Create both test tenants
                test_tenants = [
                    ("00000000-0000-0000-0000-000000000001", "Test Tenant 1", "test-tenant-1"),
                    ("00000000-0000-0000-0000-000000000002", "Test Tenant 2", "test-tenant-2"),
                ]

                for tenant_id, name, slug in test_tenants:
                    cur.execute("SELECT id FROM tenants WHERE id = %s", (tenant_id,))
                    if not cur.fetchone():
                        print(f"Creating tenant: {name}")
                        cur.execute(
                            "INSERT INTO tenants (id, name, slug, is_active) VALUES (%s, %s, %s, %s)",
                            (tenant_id, name, slug, True),
                        )
                        conn.commit()
                        print(f"✅ {name} created")
            conn.close()
            print("🎯 Test tenants ready")

        except Exception as e2:
            print(f"Alternative connection also failed: {e2}")
            return False

    return True


if __name__ == "__main__":
    create_test_tenants()
