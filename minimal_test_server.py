#!/usr/bin/env python3
"""
Minimal Flask server for testing production database connections.
This isolates database connection issues from the complex main server.
"""

import os

import psycopg2
from flask import Flask, jsonify

app = Flask(__name__)


def get_db_connection():
    """Test database connection with environment configuration"""
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return psycopg2.connect(database_url)
    else:
        return psycopg2.connect(
            host=os.getenv("POSTGRES_HOST", "localhost"),
            port=int(os.getenv("POSTGRES_PORT", 5432)),
            database=os.getenv("POSTGRES_DB", "autoshop"),
            user=os.getenv("POSTGRES_USER", "postgres"),
            password=os.getenv("POSTGRES_PASSWORD", "password"),
        )


@app.route("/health")
def health():
    """Health check endpoint"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        conn.close()

        return (
            jsonify(
                {
                    "status": "healthy",
                    "database": "connected",
                    "message": "Database connection successful",
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"status": "unhealthy", "database": "failed", "error": str(e)}), 503


@app.route("/api/test/register", methods=["POST"])
def test_register():
    """Test registration endpoint"""
    try:
        from flask import request

        data = request.get_json() or {}

        email = data.get("email")
        password = data.get("password")
        name = data.get("name")

        if not all([email, password, name]):
            return jsonify({"error": "Missing required fields"}), 400

        # Test database insert
        conn = get_db_connection()
        cursor = conn.cursor()

        # Set tenant context if available
        tenant_id = os.getenv("TENANT_ID", "prod_test_tenant")
        cursor.execute("SET SESSION app.tenant_id = %s", (tenant_id,))

        # Hash password (simple test)
        import hashlib

        password_hash = hashlib.sha256(password.encode()).hexdigest()

        cursor.execute(
            """
            INSERT INTO customers (name, email, password_hash, tenant_id)
            VALUES (%s, %s, %s, %s)
            RETURNING id
        """,
            (name, email, password_hash, tenant_id),
        )

        customer_id = cursor.fetchone()[0]
        conn.commit()
        conn.close()

        return (
            jsonify(
                {
                    "status": "success",
                    "data": {"customer": {"id": customer_id, "email": email, "name": name}},
                }
            ),
            201,
        )

    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500


@app.route("/api/debug/info")
def debug_info():
    """Debug information endpoint"""
    return jsonify(
        {
            "environment": {
                "DATABASE_URL": "***" if os.getenv("DATABASE_URL") else None,
                "POSTGRES_HOST": os.getenv("POSTGRES_HOST"),
                "POSTGRES_PORT": os.getenv("POSTGRES_PORT"),
                "POSTGRES_DB": os.getenv("POSTGRES_DB"),
                "POSTGRES_USER": os.getenv("POSTGRES_USER"),
                "TENANT_ID": os.getenv("TENANT_ID"),
            },
            "server": "minimal_test_server",
            "purpose": "Database connection testing",
        }
    )


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5002))
    print(f"Starting minimal test server on port {port}")
    print(f"Database URL: {os.getenv('DATABASE_URL', 'Using individual env vars')}")
    app_env = os.getenv("APP_ENV", "development").lower()
    is_dev = app_env in {"dev", "development", "local"}
    host = "0.0.0.0" if is_dev else "127.0.0.1"
    debug = bool(is_dev)
    app.run(host=host, port=port, debug=debug)
