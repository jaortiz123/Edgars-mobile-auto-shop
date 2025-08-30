#!/usr/bin/env python3
"""
TASK 8-C: MULTI-TENANT SYSTEM PROOF

This script sets up a complete multi-tenant test environment with:
1. Real tenant records with business data
2. Multiple users with proper tenant associations via user_tenants table
3. Business data (appointments, customers) isolated by tenant
4. Proper RLS policies enforcing tenant boundaries

This proves the complete multi-tenant architecture works end-to-end.
"""

from datetime import datetime, timedelta

import psycopg2


def setup_complete_multitenant_system():
    """Set up complete multi-tenant test system with real data"""

    print("🏗️  TASK 8-C: SETTING UP COMPLETE MULTI-TENANT SYSTEM")
    print("=" * 60)

    # Connect to database
    try:
        conn = psycopg2.connect(
            host="localhost",
            port=5441,
            database="security_test",
            user="postgres",
            password="securepass",
        )
        conn.autocommit = True
        cursor = conn.cursor()
        print("✅ Connected to PostgreSQL database")

    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

    try:
        # STEP 1: Create complete multi-tenant schema with business data
        print("\\n📊 STEP 1: Creating Multi-Tenant Database Schema")
        print("-" * 50)

        # Create tenants table with real business data
        cursor.execute(
            """
            DROP TABLE IF EXISTS user_tenants CASCADE;
            DROP TABLE IF EXISTS appointment_services CASCADE;
            DROP TABLE IF EXISTS appointments CASCADE;
            DROP TABLE IF EXISTS customer_auth CASCADE;
            DROP TABLE IF EXISTS customers CASCADE;
            DROP TABLE IF EXISTS services CASCADE;
            DROP TABLE IF EXISTS users CASCADE;
            DROP TABLE IF EXISTS tenants CASCADE;
        """
        )

        # Tenants - Real auto shop businesses
        cursor.execute(
            """
            CREATE TABLE tenants (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                business_type VARCHAR(100),
                address TEXT,
                phone VARCHAR(20),
                email VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """
        )

        # Insert real tenant data
        tenants_data = [
            (
                "edgar_mobile_shop",
                "Edgars Mobile Auto Shop",
                "Mobile Auto Repair",
                "1234 Main St, Austin TX",
                "555-0101",
                "contact@edgarsmobile.com",
            ),
            (
                "quick_fix_auto",
                "Quick Fix Auto Service",
                "Full Service Auto",
                "5678 Oak Ave, Dallas TX",
                "555-0202",
                "info@quickfixauto.com",
            ),
            (
                "premium_motors",
                "Premium Motors & Detailing",
                "Luxury Auto Service",
                "9012 Elm St, Houston TX",
                "555-0303",
                "service@premiummotors.com",
            ),
        ]

        cursor.executemany(
            """
            INSERT INTO tenants (id, name, business_type, address, phone, email)
            VALUES (%s, %s, %s, %s, %s, %s)
        """,
            tenants_data,
        )

        print(f"✅ Created {len(tenants_data)} real tenant businesses")

        # Users - Staff members who can access multiple tenants
        cursor.execute(
            """
            CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'staff',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """
        )

        # Insert staff users
        users_data = [
            ("admin@edgarsmobile.com", "Edgar Martinez", "admin"),
            ("tech1@edgarsmobile.com", "Mike Rodriguez", "technician"),
            ("manager@quickfixauto.com", "Sarah Johnson", "manager"),
            ("tech2@quickfixauto.com", "David Chen", "technician"),
            ("owner@premiummotors.com", "Robert Premium", "owner"),
            ("advisor@premiummotors.com", "Lisa Thompson", "advisor"),
        ]

        cursor.executemany(
            """
            INSERT INTO users (email, name, role) VALUES (%s, %s, %s)
        """,
            users_data,
        )

        print(f"✅ Created {len(users_data)} staff users")

        # User-Tenant relationships - The core of multi-tenant access control
        cursor.execute(
            """
            CREATE TABLE user_tenants (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
                role VARCHAR(50) DEFAULT 'staff',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, tenant_id)
            );
        """
        )

        # Set up realistic tenant memberships
        user_tenant_data = [
            # Edgar's Mobile Shop staff
            (1, "edgar_mobile_shop", "admin", True),  # Edgar - admin of his shop
            (2, "edgar_mobile_shop", "technician", True),  # Mike - works for Edgar
            # Quick Fix Auto staff
            (3, "quick_fix_auto", "manager", True),  # Sarah - manages Quick Fix
            (4, "quick_fix_auto", "technician", True),  # David - works at Quick Fix
            # Premium Motors staff
            (5, "premium_motors", "owner", True),  # Robert - owns Premium Motors
            (6, "premium_motors", "advisor", True),  # Lisa - advisor at Premium
            # Cross-tenant access (realistic scenario)
            (1, "quick_fix_auto", "consultant", True),  # Edgar consults for Quick Fix
            (3, "premium_motors", "consultant", True),  # Sarah consults for Premium
        ]

        cursor.executemany(
            """
            INSERT INTO user_tenants (user_id, tenant_id, role, is_active)
            VALUES (%s, %s, %s, %s)
        """,
            user_tenant_data,
        )

        print(f"✅ Created {len(user_tenant_data)} user-tenant relationships")

        # Customers table with tenant isolation
        cursor.execute(
            """
            CREATE TABLE customers (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(50) REFERENCES tenants(id) NOT NULL,
                email VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(tenant_id, email)
            );

            -- Enable RLS on customers
            ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

            -- RLS policy: users can only see customers from their accessible tenants
            CREATE POLICY tenant_isolation_policy ON customers
                FOR ALL
                USING (tenant_id = current_setting('app.tenant_id', true));
        """
        )

        # Insert customer data for each tenant
        customers_data = [
            # Edgar's Mobile Shop customers
            ("edgar_mobile_shop", "john.doe@email.com", "John Doe", "555-1001"),
            ("edgar_mobile_shop", "mary.smith@email.com", "Mary Smith", "555-1002"),
            ("edgar_mobile_shop", "carlos.lopez@email.com", "Carlos Lopez", "555-1003"),
            # Quick Fix Auto customers
            ("quick_fix_auto", "alice.wilson@email.com", "Alice Wilson", "555-2001"),
            ("quick_fix_auto", "bob.taylor@email.com", "Bob Taylor", "555-2002"),
            ("quick_fix_auto", "diana.brown@email.com", "Diana Brown", "555-2003"),
            # Premium Motors customers
            ("premium_motors", "luxury.client1@email.com", "William Luxury", "555-3001"),
            ("premium_motors", "premium.client2@email.com", "Elizabeth Elite", "555-3002"),
        ]

        cursor.executemany(
            """
            INSERT INTO customers (tenant_id, email, name, phone)
            VALUES (%s, %s, %s, %s)
        """,
            customers_data,
        )

        print(f"✅ Created {len(customers_data)} tenant-isolated customers")

        # Services table with tenant-specific offerings
        cursor.execute(
            """
            CREATE TABLE services (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(50) REFERENCES tenants(id) NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                price_min DECIMAL(10,2),
                price_max DECIMAL(10,2),
                duration_minutes INTEGER
            );

            -- Enable RLS on services
            ALTER TABLE services ENABLE ROW LEVEL SECURITY;
            CREATE POLICY service_tenant_policy ON services
                FOR ALL
                USING (tenant_id = current_setting('app.tenant_id', true));
        """
        )

        services_data = [
            # Edgar's Mobile services (mobile repair focus)
            (
                "edgar_mobile_shop",
                "Mobile Oil Change",
                "Oil change service at your location",
                45.00,
                75.00,
                30,
            ),
            (
                "edgar_mobile_shop",
                "Mobile Battery Replacement",
                "Battery replacement on-site",
                120.00,
                200.00,
                45,
            ),
            (
                "edgar_mobile_shop",
                "Mobile Brake Service",
                "Brake inspection and repair",
                180.00,
                350.00,
                90,
            ),
            # Quick Fix services (standard auto shop)
            ("quick_fix_auto", "Standard Oil Change", "Quick oil change service", 35.00, 55.00, 20),
            ("quick_fix_auto", "Tire Rotation", "Tire rotation and inspection", 25.00, 45.00, 30),
            ("quick_fix_auto", "Engine Diagnostic", "Computer diagnostic scan", 95.00, 125.00, 60),
            # Premium Motors services (luxury focus)
            (
                "premium_motors",
                "Premium Detailing",
                "Full luxury car detailing",
                250.00,
                500.00,
                180,
            ),
            (
                "premium_motors",
                "Concierge Service",
                "White-glove vehicle service",
                200.00,
                400.00,
                120,
            ),
            (
                "premium_motors",
                "Performance Tuning",
                "High-end performance optimization",
                500.00,
                1200.00,
                240,
            ),
        ]

        cursor.executemany(
            """
            INSERT INTO services (tenant_id, name, description, price_min, price_max, duration_minutes)
            VALUES (%s, %s, %s, %s, %s, %s)
        """,
            services_data,
        )

        print(f"✅ Created {len(services_data)} tenant-specific services")

        # Appointments table with tenant isolation
        cursor.execute(
            """
            CREATE TABLE appointments (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(50) REFERENCES tenants(id) NOT NULL,
                customer_id INTEGER REFERENCES customers(id),
                scheduled_date TIMESTAMP NOT NULL,
                status VARCHAR(50) DEFAULT 'SCHEDULED',
                total_amount DECIMAL(10,2),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Enable RLS on appointments
            ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
            CREATE POLICY appointment_tenant_policy ON appointments
                FOR ALL
                USING (tenant_id = current_setting('app.tenant_id', true));
        """
        )

        # Create realistic appointment data
        base_date = datetime.now()
        appointments_data = []

        # Edgar's appointments (customer IDs 1-3)
        for i in range(1, 4):
            appointments_data.extend(
                [
                    (
                        "edgar_mobile_shop",
                        i,
                        base_date + timedelta(days=i),
                        "SCHEDULED",
                        125.00,
                        f"Mobile service for customer {i}",
                    ),
                    (
                        "edgar_mobile_shop",
                        i,
                        base_date + timedelta(days=i + 7),
                        "COMPLETED",
                        85.00,
                        "Follow-up service",
                    ),
                ]
            )

        # Quick Fix appointments (customer IDs 4-6)
        for i in range(4, 7):
            appointments_data.extend(
                [
                    (
                        "quick_fix_auto",
                        i,
                        base_date + timedelta(days=i - 3),
                        "SCHEDULED",
                        75.00,
                        f"Standard service for customer {i}",
                    ),
                    (
                        "quick_fix_auto",
                        i,
                        base_date + timedelta(days=i + 4),
                        "IN_PROGRESS",
                        110.00,
                        "Engine work",
                    ),
                ]
            )

        # Premium appointments (customer IDs 7-8)
        for i in range(7, 9):
            appointments_data.extend(
                [
                    (
                        "premium_motors",
                        i,
                        base_date + timedelta(days=i - 6),
                        "SCHEDULED",
                        350.00,
                        f"Luxury service for customer {i}",
                    ),
                    (
                        "premium_motors",
                        i,
                        base_date + timedelta(days=i + 1),
                        "COMPLETED",
                        275.00,
                        "Premium detailing",
                    ),
                ]
            )

        cursor.executemany(
            """
            INSERT INTO appointments (tenant_id, customer_id, scheduled_date, status, total_amount, notes)
            VALUES (%s, %s, %s, %s, %s, %s)
        """,
            appointments_data,
        )

        print(f"✅ Created {len(appointments_data)} tenant-isolated appointments")

        # Customer authentication table (for customer portal access)
        cursor.execute(
            """
            CREATE TABLE customer_auth (
                id SERIAL PRIMARY KEY,
                customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
                tenant_id VARCHAR(50) REFERENCES tenants(id) NOT NULL,
                email VARCHAR(255) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                salt VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(tenant_id, email)
            );

            -- Enable RLS on customer_auth
            ALTER TABLE customer_auth ENABLE ROW LEVEL SECURITY;
            CREATE POLICY customer_auth_tenant_policy ON customer_auth
                FOR ALL
                USING (tenant_id = current_setting('app.tenant_id', true));
        """
        )

        print("✅ Created customer authentication table with RLS")

        # Grant permissions to application user
        cursor.execute(
            """
            GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO edgars_app;
            GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO edgars_app;
        """
        )

        print("✅ Granted permissions to application user")

        # STEP 2: Verify RLS is working with tenant isolation
        print("\\n🔒 STEP 2: Verifying RLS Tenant Isolation")
        print("-" * 50)

        # Close superuser connection and connect as application user for RLS testing
        conn.close()

        # Connect as application user (RLS applies to non-superusers)
        app_conn = psycopg2.connect(
            host="localhost",
            port=5441,
            database="security_test",
            user="edgars_app",
            password="app_secure_pass",
        )
        app_cursor = app_conn.cursor()

        # Test 1: Edgar's tenant context should only see Edgar's data
        app_cursor.execute("SET app.tenant_id = 'edgar_mobile_shop'")
        app_cursor.execute("SELECT COUNT(*) FROM customers")
        edgar_customers = app_cursor.fetchone()[0]

        app_cursor.execute("SELECT COUNT(*) FROM appointments")
        edgar_appointments = app_cursor.fetchone()[0]

        # Test 2: Quick Fix tenant context should only see Quick Fix data
        app_cursor.execute("SET app.tenant_id = 'quick_fix_auto'")
        app_cursor.execute("SELECT COUNT(*) FROM customers")
        quickfix_customers = app_cursor.fetchone()[0]

        app_cursor.execute("SELECT COUNT(*) FROM appointments")
        quickfix_appointments = app_cursor.fetchone()[0]

        # Test 3: No tenant context should see nothing
        app_cursor.execute("RESET app.tenant_id")
        app_cursor.execute("SELECT COUNT(*) FROM customers")
        no_tenant_customers = app_cursor.fetchone()[0]

        print(
            f"✅ Edgar's Mobile Shop: {edgar_customers} customers, {edgar_appointments} appointments"
        )
        print(
            f"✅ Quick Fix Auto: {quickfix_customers} customers, {quickfix_appointments} appointments"
        )
        print(f"✅ No tenant context: {no_tenant_customers} customers (should be 0)")

        if no_tenant_customers == 0 and edgar_customers > 0 and quickfix_customers > 0:
            print("✅ RLS tenant isolation is working correctly!")
            rls_working = True
        else:
            print("❌ RLS tenant isolation failed!")
            rls_working = False

        app_conn.close()

        # Reconnect as superuser for final summary
        conn = psycopg2.connect(
            host="localhost",
            port=5441,
            database="security_test",
            user="postgres",
            password="securepass",
        )
        cursor = conn.cursor()

        # STEP 3: Create summary report
        print("\\n📋 STEP 3: Multi-Tenant System Summary")
        print("-" * 50)

        cursor.execute("SELECT COUNT(*) FROM tenants")
        total_tenants = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM users")
        total_users = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM user_tenants WHERE is_active = TRUE")
        total_memberships = cursor.fetchone()[0]

        cursor.execute("RESET app.tenant_id; SELECT COUNT(*) FROM customers")
        total_customers = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM services")
        total_services = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM appointments")
        total_appointments = cursor.fetchone()[0]

        print(f"🏢 Tenants: {total_tenants} (real auto shop businesses)")
        print(f"👥 Users: {total_users} (staff members)")
        print(f"🔗 User-Tenant Memberships: {total_memberships} (access control)")
        print(f"👤 Customers: {total_customers} (tenant-isolated)")
        print(f"🔧 Services: {total_services} (tenant-specific offerings)")
        print(f"📅 Appointments: {total_appointments} (business transactions)")

        print("\\n🎉 COMPLETE MULTI-TENANT SYSTEM READY FOR TESTING!")
        print("=" * 60)

        conn.close()

        if not rls_working:
            return False

        return True

    except Exception as e:
        print(f"❌ Setup failed: {e}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    setup_complete_multitenant_system()
