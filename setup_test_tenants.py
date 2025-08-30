#!/usr/bin/env python3
"""Insert test tenants using SQLite"""

import os
import sqlite3

# Try to find the SQLite database
db_paths = ["database.db", "edgar_automotive.db", "backend/database.db", "instance/database.db"]

for db_path in db_paths:
    if os.path.exists(db_path):
        print(f"Found database at: {db_path}")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        try:
            # Check if tenants table exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='tenants'")
            if cursor.fetchone():
                # Insert test tenants
                cursor.execute(
                    """
                INSERT OR IGNORE INTO tenants (id, name, slug, is_active) VALUES
                ('00000000-0000-0000-0000-000000000001', 'Test Tenant 1', 'test-tenant-1', 1),
                ('00000000-0000-0000-0000-000000000002', 'Test Tenant 2', 'test-tenant-2', 1)
                """
                )
                conn.commit()

                # Verify
                cursor.execute("SELECT id, name FROM tenants")
                tenants = cursor.fetchall()
                print("Tenants in database:")
                for tenant in tenants:
                    print(f"  {tenant[0]} - {tenant[1]}")

                print("✅ Test tenants ready")
            else:
                print(f"No tenants table found in {db_path}")

        except Exception as e:
            print(f"Error with {db_path}: {e}")
        finally:
            conn.close()
        break
else:
    print("No database file found. Checking if using PostgreSQL in memory...")
    print("Proceeding with test - tenants might be created automatically")
