#!/usr/bin/env python3
"""Quick test script to debug the tenant/staff membership issue"""

import psycopg2

# Use same connection settings as local docker
POSTGRES_HOST = "localhost"
POSTGRES_PORT = "5432"
POSTGRES_DB = "edgar_db"
POSTGRES_USER = "postgres"
POSTGRES_PASSWORD = "postgres"


def test_tenant_lookup():
    """Test the tenant and staff membership lookup logic"""
    try:
        # Connect to database
        conn = psycopg2.connect(
            host=POSTGRES_HOST,
            port=POSTGRES_PORT,
            database=POSTGRES_DB,
            user=POSTGRES_USER,
            password=POSTGRES_PASSWORD,
        )
        cur = conn.cursor()

        # Test 1: Check if tenants table exists and has data
        print("=== Testing tenants table ===")
        cur.execute("SELECT COUNT(*) FROM tenants")
        tenant_count = cur.fetchone()[0]
        print(f"Total tenants in table: {tenant_count}")

        cur.execute("SELECT id::text, name, slug, status FROM tenants")
        tenants = cur.fetchall()
        print("All tenants:")
        for tenant in tenants:
            print(f"  ID: {tenant[0]}, Name: {tenant[1]}, Slug: {tenant[2]}, Status: {tenant[3]}")

        # Test 2: Test tenant lookup with the specific UUID
        print("\n=== Testing tenant lookup ===")
        tenant_header = "00000000-0000-0000-0000-000000000001"
        cur.execute("SELECT id::text FROM tenants WHERE id = %s::uuid", (tenant_header,))
        row = cur.fetchone()
        print(f"Tenant lookup for '{tenant_header}': {row}")

        # Test 3: Check staff_tenant_memberships table
        print("\n=== Testing staff_tenant_memberships table ===")
        cur.execute("SELECT COUNT(*) FROM staff_tenant_memberships")
        membership_count = cur.fetchone()[0]
        print(f"Total staff memberships: {membership_count}")

        cur.execute("SELECT staff_id, tenant_id::text, role FROM staff_tenant_memberships")
        memberships = cur.fetchall()
        print("All staff memberships:")
        for membership in memberships:
            print(f"  Staff: {membership[0]}, Tenant: {membership[1]}, Role: {membership[2]}")

        # Test 4: Test the actual membership lookup query
        print("\n=== Testing staff membership lookup ===")
        user_sub = "advisor"
        resolved_tenant = row[0] if row else None

        if resolved_tenant:
            cur.execute(
                "SELECT 1 FROM staff_tenant_memberships WHERE staff_id = %s AND tenant_id = %s::uuid",
                (user_sub, resolved_tenant),
            )
            membership_result = cur.fetchone()
            print(
                f"Membership lookup for staff_id='{user_sub}', tenant_id='{resolved_tenant}': {membership_result}"
            )
        else:
            print("No resolved tenant - can't test membership lookup")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    test_tenant_lookup()
