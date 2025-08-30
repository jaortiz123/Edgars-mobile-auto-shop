#!/usr/bin/env python3
"""
Minimal test server for cross-tenant security testing.
Implements only the endpoints needed for JWT authentication and profile access.
"""

import sqlite3
from datetime import datetime, timedelta

import jwt
from flask import Flask, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__)
app.config["SECRET_KEY"] = "test-secret-key-for-cross-tenant-test"

DB_PATH = "/Users/jesusortiz/Edgars-mobile-auto-shop/database/local_shop.db"


def get_db_connection():
    """Get SQLite database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def generate_jwt_token(user_id, tenant_id, email):
    """Generate JWT token for authenticated user"""
    payload = {
        "user_id": user_id,
        "tenant_id": tenant_id,
        "email": email,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=24),
    }
    return jwt.encode(payload, app.config["SECRET_KEY"], algorithm="HS256")


def verify_jwt_token(token):
    """Verify and decode JWT token"""
    try:
        payload = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        conn.close()
        return jsonify({"status": "ok", "db": "up"})
    except Exception as e:
        return jsonify({"status": "error", "db": "down", "detail": str(e)}), 503


@app.route("/api/customers/register", methods=["POST"])
def register():
    """Register new admin user"""
    try:
        data = request.get_json()
        email = data.get("email")
        password = data.get("password")
        name = data.get("name", "Test Admin")

        # Get tenant ID from X-Tenant-Id header
        tenant_id = request.headers.get("X-Tenant-Id")
        if not tenant_id:
            return (
                jsonify({"error": {"code": "invalid_request", "message": "Missing tenant ID"}}),
                400,
            )

        # Validate tenant exists
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM tenants WHERE id = ?", (tenant_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({"error": {"code": "invalid_request", "message": "Invalid tenant"}}), 400

        # Check if user exists
        cursor.execute("SELECT id FROM admin_users WHERE email = ?", (email,))
        if cursor.fetchone():
            conn.close()
            return jsonify({"error": {"code": "conflict", "message": "User already exists"}}), 409

        # Create user
        password_hash = generate_password_hash(password)
        cursor.execute(
            """
            INSERT INTO admin_users (tenant_id, email, password_hash, name, role)
            VALUES (?, ?, ?, ?, ?)
        """,
            (tenant_id, email, password_hash, name, "admin"),
        )
        user_id = cursor.lastrowid
        conn.commit()
        conn.close()

        # Generate JWT
        token = generate_jwt_token(user_id, tenant_id, email)

        return jsonify(
            {
                "message": "User registered successfully",
                "token": token,
                "user": {"id": user_id, "email": email, "tenant_id": tenant_id},
            }
        )

    except Exception as e:
        print(f"Registration error: {e}")
        return jsonify({"error": {"code": "internal", "message": "Registration failed"}}), 500


@app.route("/api/customers/login", methods=["POST"])
def login():
    """Login admin user"""
    try:
        data = request.get_json()
        email = data.get("email")
        password = data.get("password")

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, tenant_id, email, password_hash FROM admin_users WHERE email = ?", (email,)
        )
        user = cursor.fetchone()
        conn.close()

        if not user or not check_password_hash(user["password_hash"], password):
            return (
                jsonify({"error": {"code": "unauthorized", "message": "Invalid credentials"}}),
                401,
            )

        # Generate JWT
        token = generate_jwt_token(user["id"], user["tenant_id"], user["email"])

        return jsonify(
            {
                "message": "Login successful",
                "token": token,
                "user": {"id": user["id"], "email": user["email"], "tenant_id": user["tenant_id"]},
            }
        )

    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({"error": {"code": "internal", "message": "Login failed"}}), 500


@app.route("/api/customers/profile", methods=["GET"])
def get_profile():
    """Get customer profile - TENANT ISOLATION CRITICAL"""
    try:
        # Get JWT from Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return (
                jsonify({"error": {"code": "unauthorized", "message": "Missing or invalid token"}}),
                401,
            )

        token = auth_header.split(" ")[1]
        payload = verify_jwt_token(token)
        if not payload:
            return jsonify({"error": {"code": "unauthorized", "message": "Invalid token"}}), 401

        # Get tenant ID from header (this is what attackers will manipulate)
        request_tenant_id = request.headers.get("X-Tenant-Id")
        if not request_tenant_id:
            return (
                jsonify({"error": {"code": "invalid_request", "message": "Missing tenant ID"}}),
                400,
            )

        # 🚨 CRITICAL SECURITY CHECK: JWT tenant must match request tenant
        jwt_tenant_id = payload["tenant_id"]
        if request_tenant_id != jwt_tenant_id:
            print(
                f"🚨 CROSS-TENANT ATTACK BLOCKED: JWT tenant {jwt_tenant_id} != Request tenant {request_tenant_id}"
            )
            return (
                jsonify(
                    {"error": {"code": "forbidden", "message": "Access denied: tenant mismatch"}}
                ),
                403,
            )

        # If we get here, tenant isolation is working
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, email, name, tenant_id, role, created_at
            FROM admin_users
            WHERE id = ? AND tenant_id = ?
        """,
            (payload["user_id"], jwt_tenant_id),
        )
        user = cursor.fetchone()
        conn.close()

        if not user:
            return jsonify({"error": {"code": "not_found", "message": "User not found"}}), 404

        return jsonify(
            {
                "user": {
                    "id": user["id"],
                    "email": user["email"],
                    "name": user["name"],
                    "tenant_id": user["tenant_id"],
                    "role": user["role"],
                    "created_at": str(user["created_at"]),
                }
            }
        )

    except Exception as e:
        print(f"Profile error: {e}")
        return jsonify({"error": {"code": "internal", "message": "Profile access failed"}}), 500


if __name__ == "__main__":
    print("🔒 Starting minimal cross-tenant security test server...")
    print("🎯 Implementing CRITICAL tenant isolation check in /api/customers/profile")
    app.run(host="0.0.0.0", port=3001, debug=True)
