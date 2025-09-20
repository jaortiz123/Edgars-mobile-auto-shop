#!/usr/bin/env python3
"""
Quick database initialization script using the correct secret
"""

import json

import boto3
import pg8000


def main():
    print("Initializing database...")

    # Get database credentials from AWS Secrets Manager
    secrets_client = boto3.client("secretsmanager", region_name="us-west-2")
    secret_value = secrets_client.get_secret_value(SecretId="edgar-auto-shop-dev-db-credentials")
    secret = json.loads(secret_value["SecretString"])

    # Connect to database using pg8000 (same driver as Lambda)
    conn = pg8000.connect(
        host=secret["host"],
        port=secret["port"],
        database=secret["dbname"],
        user=secret["username"],
        password=secret["password"],
    )

    print("Connected to database successfully!")

    # Read the SQL schema file
    with open("database/init.sql") as f:
        sql_script = f.read()

    # Execute the schema creation
    with conn.cursor() as cur:
        # Split by semicolons and execute each statement
        statements = [stmt.strip() for stmt in sql_script.split(";") if stmt.strip()]

        for i, stmt in enumerate(statements):
            try:
                print(f"Executing statement {i+1}/{len(statements)}...")
                cur.execute(stmt)
                conn.commit()
            except Exception as e:
                print(f"Error executing statement {i+1}: {e}")
                print(f"Statement: {stmt[:100]}...")

    # Verify tables were created
    cur.execute(
        """
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
    """
    )

    tables = [row[0] for row in cur.fetchall()]
    print(f"\nTables created: {tables}")

    conn.close()
    print("Database initialization complete!")


if __name__ == "__main__":
    main()
