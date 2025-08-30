#!/usr/bin/env python3
"""
Multi-Tenant Test Environment Setup
Creates two distinct tenants with isolated data and admin users for cross-tenant testing
"""

import hashlib
import os
import sqlite3


class MultiTenantTestSetup:
    def __init__(self, db_path="database/local_shop.db"):
        self.db_path = db_path
        self.tenant_a_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        self.tenant_b_id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

    def hash_password(self, password):
        """Simple password hashing for test purposes"""
        return hashlib.sha256(password.encode()).hexdigest()

    def setup_database_schema(self):
        """Create complete multi-tenant database schema"""
        # Ensure database directory exists
        os.makedirs("database", exist_ok=True)

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        print("Setting up multi-tenant database schema...")

        # Drop existing tables to ensure clean state
        cursor.execute("DROP TABLE IF EXISTS appointments")
        cursor.execute("DROP TABLE IF EXISTS invoices")
        cursor.execute("DROP TABLE IF EXISTS vehicles")
        cursor.execute("DROP TABLE IF EXISTS customers")
        cursor.execute("DROP TABLE IF EXISTS admin_users")
        cursor.execute("DROP TABLE IF EXISTS tenants")

        # Create tenants table
        cursor.execute(
            """
            CREATE TABLE tenants (
                id TEXT PRIMARY KEY,
                slug TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                plan TEXT NOT NULL DEFAULT 'enterprise',
                status TEXT NOT NULL DEFAULT 'active',
                admin_email TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        )

        # Create admin_users table (separate from customers)
        cursor.execute(
            """
            CREATE TABLE admin_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'admin',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        )

        # Create customers table with tenant_id
        cursor.execute(
            """
            CREATE TABLE customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone TEXT,
                password_hash TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(tenant_id, email)
            )
        """
        )

        # Create vehicles table with tenant_id
        cursor.execute(
            """
            CREATE TABLE vehicles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                make TEXT NOT NULL,
                model TEXT NOT NULL,
                year INTEGER,
                vin TEXT,
                license_plate TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        )

        # Create appointments table with tenant_id
        cursor.execute(
            """
            CREATE TABLE appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
                scheduled_date DATE NOT NULL,
                scheduled_time TIME,
                status TEXT DEFAULT 'scheduled',
                service_description TEXT,
                estimated_cost DECIMAL(10,2),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        )

        # Create invoices table with tenant_id
        cursor.execute(
            """
            CREATE TABLE invoices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
                customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                invoice_number TEXT NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                status TEXT DEFAULT 'draft',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(tenant_id, invoice_number)
            )
        """
        )

        conn.commit()
        print("✅ Database schema created successfully")
        return conn

    def seed_tenant_data(self, conn):
        """Seed two tenants with isolated data sets"""
        cursor = conn.cursor()

        print("Seeding tenant data...")

        # Create Tenant A
        cursor.execute(
            """
            INSERT INTO tenants (id, slug, name, admin_email)
            VALUES (?, 'tenant-a', 'Tenant A Auto Shop', 'admin@tenant-a.com')
        """,
            (self.tenant_a_id,),
        )

        # Create Tenant B
        cursor.execute(
            """
            INSERT INTO tenants (id, slug, name, admin_email)
            VALUES (?, 'tenant-b', 'Tenant B Auto Shop', 'admin@tenant-b.com')
        """,
            (self.tenant_b_id,),
        )

        # Create admin users for each tenant
        admin_password = self.hash_password("AdminPass123!")

        cursor.execute(
            """
            INSERT INTO admin_users (tenant_id, email, password_hash, name, role)
            VALUES (?, 'admin@tenant-a.com', ?, 'Admin User A', 'admin')
        """,
            (self.tenant_a_id, admin_password),
        )

        cursor.execute(
            """
            INSERT INTO admin_users (tenant_id, email, password_hash, name, role)
            VALUES (?, 'admin@tenant-b.com', ?, 'Admin User B', 'admin')
        """,
            (self.tenant_b_id, admin_password),
        )

        # Seed Tenant A data
        self._seed_tenant_a_data(cursor)

        # Seed Tenant B data
        self._seed_tenant_b_data(cursor)

        conn.commit()
        print("✅ Tenant data seeded successfully")

    def _seed_tenant_a_data(self, cursor):
        """Seed isolated data for Tenant A"""
        # Tenant A customers
        cursor.execute(
            """
            INSERT INTO customers (tenant_id, first_name, last_name, email, phone, password_hash)
            VALUES (?, 'John', 'Doe', 'john.doe@tenant-a.com', '555-0101', ?)
        """,
            (self.tenant_a_id, self.hash_password("password123")),
        )

        cursor.execute(
            """
            INSERT INTO customers (tenant_id, first_name, last_name, email, phone, password_hash)
            VALUES (?, 'Jane', 'Smith', 'jane.smith@tenant-a.com', '555-0102', ?)
        """,
            (self.tenant_a_id, self.hash_password("password123")),
        )

        # Get customer IDs for Tenant A
        cursor.execute(
            "SELECT id FROM customers WHERE tenant_id = ? ORDER BY id", (self.tenant_a_id,)
        )
        tenant_a_customers = [row[0] for row in cursor.fetchall()]

        # Tenant A vehicles
        cursor.execute(
            """
            INSERT INTO vehicles (tenant_id, customer_id, make, model, year, vin, license_plate)
            VALUES (?, ?, 'Toyota', 'Camry', 2020, 'VIN-A-001', 'ABC-123')
        """,
            (self.tenant_a_id, tenant_a_customers[0]),
        )

        cursor.execute(
            """
            INSERT INTO vehicles (tenant_id, customer_id, make, model, year, vin, license_plate)
            VALUES (?, ?, 'Honda', 'Civic', 2019, 'VIN-A-002', 'DEF-456')
        """,
            (self.tenant_a_id, tenant_a_customers[1]),
        )

        # Get vehicle IDs for Tenant A
        cursor.execute(
            "SELECT id FROM vehicles WHERE tenant_id = ? ORDER BY id", (self.tenant_a_id,)
        )
        tenant_a_vehicles = [row[0] for row in cursor.fetchall()]

        # Tenant A appointments
        cursor.execute(
            """
            INSERT INTO appointments (tenant_id, customer_id, vehicle_id, scheduled_date,
                                    service_description, estimated_cost, status)
            VALUES (?, ?, ?, '2025-09-01', 'Oil Change', 49.99, 'scheduled')
        """,
            (self.tenant_a_id, tenant_a_customers[0], tenant_a_vehicles[0]),
        )

        cursor.execute(
            """
            INSERT INTO appointments (tenant_id, customer_id, vehicle_id, scheduled_date,
                                    service_description, estimated_cost, status)
            VALUES (?, ?, ?, '2025-09-02', 'Brake Inspection', 89.99, 'completed')
        """,
            (self.tenant_a_id, tenant_a_customers[1], tenant_a_vehicles[1]),
        )

        # Tenant A invoices
        cursor.execute(
            """
            INSERT INTO invoices (tenant_id, customer_id, invoice_number, amount, status)
            VALUES (?, ?, 'INV-A-001', 49.99, 'paid')
        """,
            (self.tenant_a_id, tenant_a_customers[0]),
        )

        cursor.execute(
            """
            INSERT INTO invoices (tenant_id, customer_id, invoice_number, amount, status)
            VALUES (?, ?, 'INV-A-002', 89.99, 'draft')
        """,
            (self.tenant_a_id, tenant_a_customers[1]),
        )

        print(
            f"  ✅ Seeded Tenant A data: {len(tenant_a_customers)} customers, {len(tenant_a_vehicles)} vehicles"
        )

    def _seed_tenant_b_data(self, cursor):
        """Seed isolated data for Tenant B"""
        # Tenant B customers
        cursor.execute(
            """
            INSERT INTO customers (tenant_id, first_name, last_name, email, phone, password_hash)
            VALUES (?, 'Alice', 'Johnson', 'alice.johnson@tenant-b.com', '555-0201', ?)
        """,
            (self.tenant_b_id, self.hash_password("password456")),
        )

        cursor.execute(
            """
            INSERT INTO customers (tenant_id, first_name, last_name, email, phone, password_hash)
            VALUES (?, 'Bob', 'Williams', 'bob.williams@tenant-b.com', '555-0202', ?)
        """,
            (self.tenant_b_id, self.hash_password("password456")),
        )

        # Get customer IDs for Tenant B
        cursor.execute(
            "SELECT id FROM customers WHERE tenant_id = ? ORDER BY id", (self.tenant_b_id,)
        )
        tenant_b_customers = [row[0] for row in cursor.fetchall()]

        # Tenant B vehicles
        cursor.execute(
            """
            INSERT INTO vehicles (tenant_id, customer_id, make, model, year, vin, license_plate)
            VALUES (?, ?, 'Ford', 'F-150', 2021, 'VIN-B-001', 'XYZ-789')
        """,
            (self.tenant_b_id, tenant_b_customers[0]),
        )

        cursor.execute(
            """
            INSERT INTO vehicles (tenant_id, customer_id, make, model, year, vin, license_plate)
            VALUES (?, ?, 'Chevrolet', 'Malibu', 2018, 'VIN-B-002', 'GHI-012')
        """,
            (self.tenant_b_id, tenant_b_customers[1]),
        )

        # Get vehicle IDs for Tenant B
        cursor.execute(
            "SELECT id FROM vehicles WHERE tenant_id = ? ORDER BY id", (self.tenant_b_id,)
        )
        tenant_b_vehicles = [row[0] for row in cursor.fetchall()]

        # Tenant B appointments
        cursor.execute(
            """
            INSERT INTO appointments (tenant_id, customer_id, vehicle_id, scheduled_date,
                                    service_description, estimated_cost, status)
            VALUES (?, ?, ?, '2025-09-03', 'Tire Rotation', 39.99, 'scheduled')
        """,
            (self.tenant_b_id, tenant_b_customers[0], tenant_b_vehicles[0]),
        )

        cursor.execute(
            """
            INSERT INTO appointments (tenant_id, customer_id, vehicle_id, scheduled_date,
                                    service_description, estimated_cost, status)
            VALUES (?, ?, ?, '2025-09-04', 'Engine Diagnostic', 129.99, 'in_progress')
        """,
            (self.tenant_b_id, tenant_b_customers[1], tenant_b_vehicles[1]),
        )

        # Tenant B invoices
        cursor.execute(
            """
            INSERT INTO invoices (tenant_id, customer_id, invoice_number, amount, status)
            VALUES (?, ?, 'INV-B-001', 39.99, 'sent')
        """,
            (self.tenant_b_id, tenant_b_customers[0]),
        )

        cursor.execute(
            """
            INSERT INTO invoices (tenant_id, customer_id, invoice_number, amount, status)
            VALUES (?, ?, 'INV-B-002', 129.99, 'draft')
        """,
            (self.tenant_b_id, tenant_b_customers[1]),
        )

        print(
            f"  ✅ Seeded Tenant B data: {len(tenant_b_customers)} customers, {len(tenant_b_vehicles)} vehicles"
        )

    def verify_data_isolation(self, conn):
        """Verify that tenant data is properly isolated"""
        cursor = conn.cursor()

        print("\nVerifying tenant data isolation...")

        # Check Tenant A data
        cursor.execute("SELECT COUNT(*) FROM customers WHERE tenant_id = ?", (self.tenant_a_id,))
        tenant_a_customers = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM invoices WHERE tenant_id = ?", (self.tenant_a_id,))
        tenant_a_invoices = cursor.fetchone()[0]

        # Check Tenant B data
        cursor.execute("SELECT COUNT(*) FROM customers WHERE tenant_id = ?", (self.tenant_b_id,))
        tenant_b_customers = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM invoices WHERE tenant_id = ?", (self.tenant_b_id,))
        tenant_b_invoices = cursor.fetchone()[0]

        print(f"  Tenant A: {tenant_a_customers} customers, {tenant_a_invoices} invoices")
        print(f"  Tenant B: {tenant_b_customers} customers, {tenant_b_invoices} invoices")

        # Verify admin users
        cursor.execute("SELECT email FROM admin_users WHERE tenant_id = ?", (self.tenant_a_id,))
        admin_a = cursor.fetchone()[0]

        cursor.execute("SELECT email FROM admin_users WHERE tenant_id = ?", (self.tenant_b_id,))
        admin_b = cursor.fetchone()[0]

        print(f"  Admin users: {admin_a} (Tenant A), {admin_b} (Tenant B)")

        return {
            "tenant_a": {
                "customers": tenant_a_customers,
                "invoices": tenant_a_invoices,
                "admin": admin_a,
            },
            "tenant_b": {
                "customers": tenant_b_customers,
                "invoices": tenant_b_invoices,
                "admin": admin_b,
            },
        }

    def setup_complete_environment(self):
        """Complete setup of multi-tenant test environment"""
        print("=" * 70)
        print("🔧 SETTING UP MULTI-TENANT TEST ENVIRONMENT")
        print("=" * 70)

        # Setup database schema
        conn = self.setup_database_schema()

        # Seed tenant data
        self.seed_tenant_data(conn)

        # Verify isolation
        verification = self.verify_data_isolation(conn)

        conn.close()

        print("\n" + "=" * 70)
        print("✅ MULTI-TENANT TEST ENVIRONMENT READY")
        print("=" * 70)
        print(f"Database: {self.db_path}")
        print(f"Tenant A ID: {self.tenant_a_id}")
        print(f"Tenant B ID: {self.tenant_b_id}")
        print("Admin credentials: AdminPass123!")
        print("=" * 70)

        return {
            "tenant_a_id": self.tenant_a_id,
            "tenant_b_id": self.tenant_b_id,
            "admin_email_a": "admin@tenant-a.com",
            "admin_email_b": "admin@tenant-b.com",
            "admin_password": "AdminPass123!",
            "verification": verification,
        }


def main():
    setup = MultiTenantTestSetup()
    result = setup.setup_complete_environment()

    print("\n🎯 READY FOR CROSS-TENANT TESTING:")
    print(f"   • Use '{result['admin_email_a']}' to test Tenant A admin access")
    print("   • Try accessing Tenant B data with Tenant A credentials")
    print("   • This should fail with 403 Forbidden if tenant isolation works")

    return result


if __name__ == "__main__":
    main()
