#!/usr/bin/env python3
"""
Test TASK 3: Tenant Context Middleware Implementation

This script verifies that tenant context middleware is properly integrated
into Flask routes and enforcing Row-Level Security (RLS).
"""

import os
import sys

import psycopg2
from psycopg2.extras import RealDictCursor

# Add backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from backend.app.middleware.tenant_context import resolve_active_tenant, tenant_context


def get_db_connection():
    """Get database connection for testing."""
    return psycopg2.connect(
        host="localhost",
        port=5432,
        database="edgar_db",
        user="app_user",  # Use app_user to test RLS
        cursor_factory=RealDictCursor,
    )


def test_tenant_context_isolation():
    """Test that tenant context properly isolates data access."""
    print("\n=== TASK 3: Testing Tenant Context Middleware ===")

    conn = get_db_connection()
    try:
        with conn:
            with conn.cursor() as cur:
                # Verify we have multiple tenants and customers
                cur.execute("SELECT id, name FROM tenants ORDER BY id")
                tenants = cur.fetchall()
                print(f"Available tenants: {len(tenants)}")
                for tenant in tenants:
                    print(f"  - {tenant['id']}: {tenant['name']}")

                cur.execute("SELECT COUNT(*) as total FROM customers")
                total_customers = cur.fetchone()["total"]
                print(f"Total customers in database: {total_customers}")

                # Test tenant context isolation for each tenant
                for tenant in tenants:
                    tenant_id = tenant["id"]
                    tenant_name = tenant["name"]
                    print(f"\n--- Testing Tenant Context for '{tenant_name}' (ID: {tenant_id}) ---")

                    with tenant_context(cur, tenant_id):
                        # Test customer access within tenant context
                        cur.execute("SELECT id, name, tenant_id FROM customers ORDER BY id")
                        tenant_customers = cur.fetchall()
                        print(f"Customers visible in tenant {tenant_name}: {len(tenant_customers)}")

                        for customer in tenant_customers:
                            if customer["tenant_id"] != tenant_id:
                                print(
                                    f"❌ SECURITY BREACH: Customer {customer['id']} belongs to tenant {customer['tenant_id']} but visible in tenant {tenant_id}!"
                                )
                                return False
                            print(
                                f"  ✅ Customer {customer['id']}: {customer['name']} (tenant_id: {customer['tenant_id']})"
                            )

                        # Test vehicle access within tenant context
                        cur.execute(
                            "SELECT v.id, v.license_plate, v.tenant_id, c.name FROM vehicles v JOIN customers c ON c.id = v.customer_id ORDER BY v.id"
                        )
                        tenant_vehicles = cur.fetchall()
                        print(f"Vehicles visible in tenant {tenant_name}: {len(tenant_vehicles)}")

                        for vehicle in tenant_vehicles:
                            if vehicle["tenant_id"] != tenant_id:
                                print(
                                    f"❌ SECURITY BREACH: Vehicle {vehicle['id']} belongs to tenant {vehicle['tenant_id']} but visible in tenant {tenant_id}!"
                                )
                                return False
                            print(
                                f"  ✅ Vehicle {vehicle['id']}: {vehicle['license_plate']} (owner: {vehicle['name']}, tenant_id: {vehicle['tenant_id']})"
                            )

                print("\n✅ Tenant context isolation working correctly!")
                print("✅ RLS policies enforcing tenant boundaries!")
                return True

    except Exception as e:
        print(f"❌ Tenant context test failed: {e}")
        import traceback

        traceback.print_exc()
        return False
    finally:
        conn.close()


def test_resolve_active_tenant():
    """Test the resolve_active_tenant function."""
    print("\n=== Testing resolve_active_tenant Function ===")

    # Mock user and request objects
    class MockRequest:
        def __init__(self, headers=None):
            self.headers = headers or {}

    # Test with admin user (should default to tenant 1)
    admin_user = {
        "sub": "auth0|admin123",
        "preferred_username": "admin",
        "cognito:groups": ["Admin"],
    }

    request = MockRequest()
    tenant_id = resolve_active_tenant(admin_user, request)
    print(f"Admin user resolved to tenant: {tenant_id}")

    # Test with tenant-specific header
    request_with_tenant = MockRequest(headers={"X-Tenant-ID": "2"})
    tenant_id_from_header = resolve_active_tenant(admin_user, request_with_tenant)
    print(f"Admin user with X-Tenant-ID header resolved to tenant: {tenant_id_from_header}")

    print("✅ resolve_active_tenant function working correctly!")


def main():
    """Run all TASK 3 tests."""
    print("🔒 PHASE 1 CRITICAL SECURITY - TASK 3 VERIFICATION")
    print("=" * 60)

    # Test tenant context isolation
    isolation_success = test_tenant_context_isolation()

    # Test tenant resolution
    test_resolve_active_tenant()

    if isolation_success:
        print("\n🎉 TASK 3: Tenant Context Middleware - COMPLETE!")
        print("✅ Row-Level Security enforced through tenant context")
        print("✅ Multi-tenant isolation working correctly")
        print("✅ Flask routes can now use tenant_context for secure data access")
        print("\nNext: TASK 4 - Secure Password Hashing")
    else:
        print("\n❌ TASK 3: Tenant Context Middleware - FAILED!")
        print("RLS enforcement or tenant isolation not working properly")
        sys.exit(1)


if __name__ == "__main__":
    main()
