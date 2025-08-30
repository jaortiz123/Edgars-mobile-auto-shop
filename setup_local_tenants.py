#!/usr/bin/env python3
"""
Setup local SQLite database with tenant structure for testing
"""

import os
import sqlite3


def setup_tenant_database():
    """Setup SQLite database with tenant structure"""
    db_path = "database/local_shop.db"

    # Ensure database directory exists
    os.makedirs("database", exist_ok=True)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("Setting up tenant structure...")

    # Create tenants table
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS tenants (
            id TEXT PRIMARY KEY,
            slug TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            plan TEXT NOT NULL DEFAULT 'starter',
            status TEXT NOT NULL DEFAULT 'active',
            admin_email TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    )

    # Create customers table with tenant_id
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            password_hash TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    )

    # Create vehicles table with tenant_id
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
            make TEXT,
            model TEXT,
            year INTEGER,
            vin TEXT,
            license_plate TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    )

    # Create appointments table with tenant_id
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
            vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
            scheduled_date DATE,
            scheduled_time TIME,
            status TEXT DEFAULT 'scheduled',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    )

    # Insert default tenants
    cursor.execute(
        """
        INSERT OR IGNORE INTO tenants (id, slug, name, plan, status, admin_email)
        VALUES
            ('00000000-0000-0000-0000-000000000001', 'tenant-a', 'Tenant A Auto Shop', 'enterprise', 'active', 'admin@tenant-a.com'),
            ('00000000-0000-0000-0000-000000000002', 'tenant-b', 'Tenant B Auto Shop', 'enterprise', 'active', 'admin@tenant-b.com')
    """
    )

    conn.commit()

    # Verify setup
    cursor.execute("SELECT id, name FROM tenants")
    tenants = cursor.fetchall()

    print(f"✅ Database setup complete with {len(tenants)} tenants:")
    for tenant in tenants:
        print(f"   {tenant[0]} - {tenant[1]}")

    conn.close()


if __name__ == "__main__":
    setup_tenant_database()
