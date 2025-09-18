#!/usr/bin/env python3
"""
Minimal Flask server for runtime security testing
This server implements basic authentication and security endpoints for verification
"""

import os
import sys
from datetime import datetime, timedelta

import bcrypt
import jwt
import psycopg2
from flask import Flask, jsonify, make_response, request

# Add security modules to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "app"))

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "test-jwt-secret")


def get_db_connection():
    """Get database connection"""
    db_url = os.environ.get(
        "DATABASE_URL", "postgresql://postgres:testpass@localhost:5433/edgars_test"
    )
    return psycopg2.connect(db_url)


@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "timestamp": datetime.utcnow().isoformat()})


@app.route("/api/auth/register", methods=["POST"])
def register():
    """User registration endpoint"""
    try:
        data = request.get_json()
        email = data.get("email")
        password = data.get("password")
        name = data.get("name")

        if not all([email, password, name]):
            return jsonify({"error": "Missing required fields"}), 400

        # Hash password with bcrypt
        password_bytes = password.encode("utf-8")
        salt = bcrypt.gensalt(rounds=12)
        password_hash = bcrypt.hashpw(password_bytes, salt).decode("utf-8")

        # Save to database
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            INSERT INTO users (email, name, password_hash, tenant_id)
            VALUES (%s, %s, %s, %s)
        """,
            (email, name, password_hash, "t_default"),
        )

        conn.commit()
        conn.close()

        return jsonify({"message": "User registered successfully"}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/login", methods=["POST"])
def login():
    """User login endpoint"""
    try:
        data = request.get_json()
        email = data.get("email")
        password = data.get("password")

        if not all([email, password]):
            return jsonify({"error": "Missing email or password"}), 400

        # Get user from database
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT id, password_hash, name FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        conn.close()

        if not user:
            return jsonify({"error": "Invalid credentials"}), 401

        user_id, password_hash, name = user

        # Verify password
        if bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8")):
            # Create JWT tokens
            payload = {
                "user_id": str(user_id),
                "email": email,
                "exp": datetime.utcnow() + timedelta(hours=1),
            }

            access_token = jwt.encode(payload, app.config["SECRET_KEY"], algorithm="HS256")

            response = make_response(
                jsonify(
                    {
                        "message": "Login successful",
                        "user": {"id": str(user_id), "email": email, "name": name},
                    }
                )
            )

            # Set httpOnly cookies
            response.set_cookie(
                "access_token",
                access_token,
                httponly=True,
                secure=False,  # Set to True in production
                samesite="Strict",
                max_age=3600,
            )

            response.set_cookie(
                "refresh_token",
                "refresh_" + access_token,  # Simplified for testing
                httponly=True,
                secure=False,
                samesite="Strict",
                max_age=86400,
            )

            return response
        else:
            return jsonify({"error": "Invalid credentials"}), 401

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/customers", methods=["GET"])
def get_customers():
    """Protected endpoint - requires authentication"""
    try:
        # Check for access token cookie
        token = request.cookies.get("access_token")
        if not token:
            return jsonify({"error": "Authentication required"}), 401

        # Verify JWT token
        try:
            jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        # Get customers (with tenant isolation in production)
        conn = get_db_connection()
        cursor = conn.cursor()

        # Set tenant context for RLS
        cursor.execute("SET app.tenant_id = 't_default'")
        cursor.execute("SELECT id, name, email FROM customers LIMIT 10")

        customers = []
        for row in cursor.fetchall():
            customers.append({"id": str(row[0]), "name": row[1], "email": row[2]})

        conn.close()

        return jsonify({"customers": customers})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/request-reset", methods=["POST"])
def request_password_reset():
    """Password reset request endpoint"""
    try:
        data = request.get_json()
        email = data.get("email")

        if not email:
            return jsonify({"error": "Email required"}), 400

        # Generate reset token
        import secrets

        token = secrets.token_urlsafe(32)
        token_hash = bcrypt.hashpw(token.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        expires_at = datetime.utcnow() + timedelta(hours=1)

        # Save to database
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            INSERT INTO password_resets (email, token_hash, expires_at)
            VALUES (%s, %s, %s)
        """,
            (email, token_hash, expires_at),
        )

        conn.commit()
        conn.close()

        return jsonify({"message": "Password reset requested"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app_env = os.environ.get("APP_ENV", "development").lower()
    is_dev = app_env in {"dev", "development", "local"}
    host = "0.0.0.0" if is_dev else "127.0.0.1"
    debug = bool(is_dev)
    app.run(host=host, port=port, debug=debug)
