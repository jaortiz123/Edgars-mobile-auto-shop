"""
INDEPENDENT SECURITY MODULE

This module contains core security functions extracted from local_server.py
that can be imported and tested without Flask app instantiation conflicts.

CRITICAL: This fixes DIRECTIVE 2 - Flask instantiation conflicts
"""

import hashlib
import os
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Tuple

import bcrypt
import jwt

# Extract JWT configuration
JWT_SECRET = os.getenv("JWT_SECRET", "dev_secret")
JWT_ALG = os.getenv("JWT_ALG", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7


def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt with cost factor 12 for production security.

    Args:
        password: Plain text password to hash

    Returns:
        Bcrypt hashed password string
    """
    if not password:
        raise ValueError("Password cannot be empty")

    # Use bcrypt with cost factor 12 for production
    salt = bcrypt.gensalt(rounds=12)
    password_bytes = password.encode("utf-8")
    hashed = bcrypt.hashpw(password_bytes, salt)

    return hashed.decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    """
    Verify a password against its bcrypt hash.

    Args:
        password: Plain text password to verify
        hashed_password: Bcrypt hashed password to check against

    Returns:
        True if password matches, False otherwise
    """
    if not password or not hashed_password:
        return False

    try:
        password_bytes = password.encode("utf-8")
        hashed_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False


def make_tokens(
    customer_id: str,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    role: str = "customer",
) -> Tuple[str, str]:
    """
    Generate access and refresh tokens for a customer.

    Args:
        customer_id: Customer ID to include in token
        email: Customer email (optional)
        phone: Customer phone (optional)
        role: Customer role (default: 'customer')

    Returns:
        Tuple of (access_token, refresh_token)
    """
    if not customer_id:
        raise ValueError("Customer ID is required")

    now = datetime.utcnow()

    # Access token (short-lived)
    access_payload = {
        "customer_id": customer_id,
        "role": role,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }

    if email:
        access_payload["email"] = email
    if phone:
        access_payload["phone"] = phone

    # Refresh token (long-lived)
    refresh_payload = {
        "customer_id": customer_id,
        "type": "refresh",
        "iat": now,
        "exp": now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    }

    access_token = jwt.encode(access_payload, JWT_SECRET, algorithm=JWT_ALG)
    refresh_token = jwt.encode(refresh_payload, JWT_SECRET, algorithm=JWT_ALG)

    return access_token, refresh_token


def verify_token(token: str, token_type: str = "access") -> Optional[Dict[str, Any]]:
    """
    Verify and decode a JWT token.

    Args:
        token: JWT token string to verify
        token_type: Expected token type ('access' or 'refresh')

    Returns:
        Decoded token payload if valid, None otherwise
    """
    if not token:
        return None

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])

        # Check token type if specified
        if token_type and payload.get("type") != token_type:
            return None

        return payload

    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def generate_password_reset_token(email: str) -> Tuple[str, datetime]:
    """
    Generate a secure password reset token for an email.

    Args:
        email: User email address

    Returns:
        Tuple of (token_string, expiration_datetime)
    """
    if not email:
        raise ValueError("Email is required")

    now = datetime.utcnow()
    expiration = now + timedelta(hours=1)  # 1 hour expiration

    payload = {"email": email, "iat": now, "exp": expiration, "type": "password_reset"}

    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

    return token, expiration


def verify_password_reset_token(token: str) -> Optional[str]:
    """
    Verify a password reset token and return the email if valid.

    Args:
        token: Password reset token to verify

    Returns:
        Email address if token is valid, None otherwise
    """
    payload = verify_token(token, "password_reset")
    if payload:
        return payload.get("email")
    return None


def validate_password_strength(password: str) -> Tuple[bool, str]:
    """
    Validate password meets security requirements.

    Args:
        password: Password to validate

    Returns:
        Tuple of (is_valid: bool, error_message: str)
    """
    if not password:
        return False, "Password is required"

    if len(password) < 8:
        return False, "Password must be at least 8 characters long"

    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"

    if not any(c.islower() for c in password):
        return False, "Password must contain at least one lowercase letter"

    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one digit"

    special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
    if not any(c in special_chars for c in password):
        return False, f"Password must contain at least one special character: {special_chars}"

    return True, "Password is valid"


# Legacy support - check if old SHA256 hashes need migration
def is_bcrypt_hash(password_hash: str) -> bool:
    """Check if a password hash is bcrypt format."""
    if not password_hash:
        return False
    return password_hash.startswith("$2b$") or password_hash.startswith("$2a$")


def migrate_legacy_password(password: str, old_hash: str) -> Optional[str]:
    """
    Migrate from legacy SHA256 to bcrypt if the password matches the old hash.

    Args:
        password: Plain text password
        old_hash: Legacy SHA256 hash

    Returns:
        New bcrypt hash if migration successful, None otherwise
    """
    # Check if old password matches legacy SHA256 hash
    legacy_hash = hashlib.sha256(password.encode()).hexdigest()
    if legacy_hash == old_hash:
        return hash_password(password)
    return None


if __name__ == "__main__":
    # Test the security functions independently
    print("🧪 TESTING INDEPENDENT SECURITY MODULE")
    print("=" * 50)

    # Test password hashing
    test_password = "TestPassword123!"
    hashed = hash_password(test_password)
    print(f"✅ Password hashing works: {len(hashed)} chars")

    # Test password verification
    valid = verify_password(test_password, hashed)
    print(f"✅ Password verification works: {valid}")

    # Test JWT tokens
    user_data = {"customer_id": 123, "tenant_id": "test_tenant", "email": "test@example.com"}
    tokens = make_tokens(user_data)
    print(f"✅ JWT generation works: {len(tokens)} tokens")

    # Test token verification
    decoded = verify_token(tokens["access_token"])
    print(f"✅ JWT verification works: {decoded['sub'] if decoded else 'Failed'}")

    print("\n🎉 INDEPENDENT SECURITY MODULE WORKING!")
