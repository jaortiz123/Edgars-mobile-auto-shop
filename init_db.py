#!/usr/bin/env python3
import json
import os

import boto3
import psycopg2


def run_migration_file(cursor, migration_file):
    """Run a single migration file"""
    print(f"Running migration: {migration_file}")
    with open(migration_file) as f:
        migration_sql = f.read()
    cursor.execute(migration_sql)
    print(f"✓ Migration {migration_file} completed successfully")


def get_db_connection():
    """Get database connection - supports both local and AWS configurations"""

    # Check if we have a local DATABASE_URL (local development)
    local_db_url = os.environ.get("DATABASE_URL")
    if local_db_url and "localhost" in local_db_url:
        print("Using local database connection...")
        # Parse local URL: postgres://user:password@host:port/database
        # For now, use docker-compose defaults
        return psycopg2.connect(
            host="localhost",
            port=5432,
            database="edgarautoshop",
            user="postgres",
            password="postgres",
        )

    # Use AWS Secrets Manager for production
    print("Using AWS RDS connection via Secrets Manager...")
    secrets_client = boto3.client("secretsmanager", region_name="us-west-2")
    secret_value = secrets_client.get_secret_value(
        SecretId="arn:aws:secretsmanager:us-west-2:588738589514:secret:edgar/rds/master-credentials-0K6opS"
    )
    secret = json.loads(secret_value["SecretString"])

    return psycopg2.connect(
        host=secret["host"],
        port=secret["port"],
        database=secret["dbname"],
        user=secret["username"],
        password=secret["password"],
    )


def main():
    # Connect to database
    try:
        conn = get_db_connection()
    except Exception as e:
        print(f"Failed to connect to database: {e}")
        print("Make sure you have either:")
        print("1. Local PostgreSQL running (docker-compose up db)")
        print("2. AWS credentials configured for RDS access")
        return

    try:
        with conn.cursor() as cur:
            # First run the base database initialization
            print("Running base database initialization...")
            with open("database/init.sql") as f:
                sql_script = f.read()
            cur.execute(sql_script)
            conn.commit()
            print("✓ Base database initialized successfully")

            # Run multi-tenant foundation migrations in order
            migration_files = [
                "backend/migrations/001_tenants_and_user_tenants.sql",
                "backend/migrations/002_add_tenant_id_to_domain.sql",
                "backend/migrations/003_rls_enable.sql",
                "backend/migrations/004_password_resets.sql",
            ]

            for migration_file in migration_files:
                if os.path.exists(migration_file):
                    run_migration_file(cur, migration_file)
                    conn.commit()
                else:
                    print(f"Warning: Migration file not found: {migration_file}")

            # Verify tables were created with tenant_id columns
            print("\nVerifying multi-tenant schema...")

            # Check tenant-related tables exist
            cur.execute(
                """
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name IN ('tenants', 'users', 'user_tenants')
                ORDER BY table_name
            """
            )
            tenant_tables = [row[0] for row in cur.fetchall()]
            print(f"Tenant foundation tables: {tenant_tables}")

            # Check tenant_id columns exist on domain tables
            cur.execute(
                """
                SELECT table_name, column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND column_name = 'tenant_id'
                AND table_name IN ('customers', 'vehicles', 'invoices', 'appointments', 'invoice_line_items')
                ORDER BY table_name
            """
            )
            tenant_columns = cur.fetchall()
            print("Domain tables with tenant_id:")
            for table, column in tenant_columns:
                print(f"  ✓ {table}.{column}")

            # Check RLS policies exist
            cur.execute(
                """
                SELECT schemaname, tablename, policyname
                FROM pg_policies
                WHERE schemaname = 'public'
                ORDER BY tablename, policyname
            """
            )
            policies = cur.fetchall()
            if policies:
                print("Row-Level Security policies:")
                for schema, table, policy in policies:
                    print(f"  ✓ {table}.{policy}")
            else:
                print("No RLS policies found (RLS may be disabled)")

            # Verify constraints
            cur.execute(
                """
                SELECT tc.table_name, tc.constraint_name
                FROM information_schema.table_constraints tc
                WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema = 'public'
                AND tc.constraint_name LIKE '%tenant%'
                ORDER BY tc.table_name
            """
            )
            fk_constraints = cur.fetchall()
            print("Tenant foreign key constraints:")
            for table, constraint in fk_constraints:
                print(f"  ✓ {table}.{constraint}")

            print("\n🎉 Multi-tenant database foundation setup complete!")

    except Exception as e:
        print(f"Error initializing database: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
