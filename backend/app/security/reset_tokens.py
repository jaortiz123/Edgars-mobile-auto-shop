"""
TASK 6: Password Reset Flow - Secure Reset Token Module

This module provides secure password reset token generation, storage, and validation
with cryptographic security, time-based expiry, and one-time use enforcement.

Security Features:
- Cryptographically secure random token generation (32 bytes = 256 bits)
- SHA256 hashing for database storage (never store plain text tokens)
- 60-minute token expiry for security
- One-time use enforcement with used_at timestamps
- Automatic cleanup of expired tokens
- Tenant-aware operations for multi-tenant isolation

Critical Security Requirements:
- Tokens MUST expire in 60 minutes
- Tokens MUST be stored as SHA256 hashes, never plain text
- Tokens MUST be cryptographically secure (not predictable)
- One-time use MUST be enforced (mark used_at timestamp)
"""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta
from typing import Optional

from psycopg2.extras import RealDictCursor

# Configure logging
log = logging.getLogger(__name__)


def generate_reset_token() -> str:
    """
    Generate a cryptographically secure random token for password reset.

    Uses secrets.token_urlsafe() which provides:
    - Cryptographic randomness (not predictable)
    - URL-safe base64 encoding (no special characters)
    - 32 bytes of randomness (256 bits of entropy)

    Returns:
        str: A secure random token suitable for password reset
    """
    # Generate 32 bytes (256 bits) of cryptographically secure randomness
    # This provides sufficient entropy to prevent brute force attacks
    token = secrets.token_urlsafe(32)  # 32 bytes -> ~43 character URL-safe string
    log.debug("Generated secure reset token (length: %d)", len(token))
    return token


def hash_token(token: str) -> str:
    """
    Hash a reset token using SHA256 for secure database storage.

    Args:
        token: The plain text reset token

    Returns:
        str: SHA256 hex digest of the token

    Security Note:
        Never store plain text tokens in the database. Always hash tokens
        before storage to prevent token theft via database compromise.
    """
    if not token:
        raise ValueError("Token cannot be empty")

    # Use SHA256 for hashing (provides 256 bits of security)
    # This is irreversible - we can only verify tokens, never recover them
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    log.debug("Hashed reset token (hash length: %d)", len(token_hash))
    return token_hash


def create_reset_request(user_id, tenant_id: str, db_connection) -> str:
    """
    Create a password reset request by generating and storing a secure token.

    Args:
        user_id: The ID of the user requesting password reset
        tenant_id: The tenant ID for multi-tenant isolation
        db_connection: Active database connection

    Returns:
        str: The plain text reset token (to be sent via email)

    Process:
        1. Generate cryptographically secure random token
        2. Hash token with SHA256 for database storage
        3. Delete any existing reset tokens for this user (one active token per user)
        4. Store hashed token with 60-minute expiry
        5. Return plain text token for email transmission
    """
    if not user_id:
        raise ValueError("User ID cannot be empty")
    if not tenant_id:
        raise ValueError("Tenant ID cannot be empty")

    # Generate secure token
    plain_token = generate_reset_token()
    token_hash = hash_token(plain_token)

    # Calculate expiry time (60 minutes from now)
    expires_at = datetime.utcnow() + timedelta(hours=1)

    with db_connection.cursor(cursor_factory=RealDictCursor) as cursor:
        # First, clean up any existing reset tokens for this user
        # This ensures only one active reset token per user at any time
        log.debug(
            "About to execute DELETE with user_id=%s (type=%s), tenant_id=%s (type=%s)",
            user_id,
            type(user_id),
            tenant_id,
            type(tenant_id),
        )
        cursor.execute(
            """
            DELETE FROM password_resets
            WHERE user_id = %s AND tenant_id = %s
        """,
            (user_id, tenant_id),
        )

        deleted_count = cursor.rowcount
        if deleted_count > 0:
            log.info("Deleted %d existing reset tokens for user %s", deleted_count, user_id)

        # Insert new reset token
        cursor.execute(
            """
            INSERT INTO password_resets (user_id, token_hash, expires_at, tenant_id)
            VALUES (%s, %s, %s, %s)
        """,
            (user_id, token_hash, expires_at, tenant_id),
        )

        # Commit the transaction
        db_connection.commit()

        log.info(
            "Created password reset token for user %s (expires at %s)",
            user_id,
            expires_at.isoformat(),
        )

    return plain_token


def validate_reset_token(user_id: str, token: str, tenant_id: str, db_connection) -> bool:
    """
    Validate a password reset token for authenticity, expiry, and usage status.

    Args:
        user_id: The ID of the user attempting password reset
        token: The plain text reset token to validate
        tenant_id: The tenant ID for multi-tenant isolation
        db_connection: Active database connection

    Returns:
        bool: True if token is valid (not expired, not used), False otherwise

    Validation Process:
        1. Hash the provided token
        2. Look up token in database for this user and tenant
        3. Check token exists and matches
        4. Check token is not expired (within 60 minutes)
        5. Check token has not been used (used_at is NULL)
        6. Return validation result
    """
    if not user_id:
        raise ValueError("User ID cannot be empty")
    if not token:
        raise ValueError("Token cannot be empty")
    if not tenant_id:
        raise ValueError("Tenant ID cannot be empty")

    # Hash the provided token for database lookup
    token_hash = hash_token(token)

    with db_connection.cursor(cursor_factory=RealDictCursor) as cursor:
        # Look up the token with all validation conditions
        cursor.execute(
            """
            SELECT user_id, expires_at, used_at, created_at
            FROM password_resets
            WHERE user_id = %s
            AND token_hash = %s
            AND tenant_id = %s
            AND expires_at > NOW()  -- Not expired
            AND used_at IS NULL     -- Not used yet
        """,
            (user_id, token_hash, tenant_id),
        )

        result = cursor.fetchone()

        if result:
            log.info(
                "Valid reset token found for user %s (created: %s)",
                user_id,
                result["created_at"].isoformat(),
            )
            return True
        else:
            # Token is either invalid, expired, used, or doesn't exist
            log.warning("Invalid or expired reset token for user %s", user_id)
            return False


def mark_token_used(user_id: str, token: str, tenant_id: str, db_connection) -> bool:
    """
    Mark a reset token as used to enforce one-time use policy.

    Args:
        user_id: The ID of the user whose token was used
        token: The plain text reset token that was used
        tenant_id: The tenant ID for multi-tenant isolation
        db_connection: Active database connection

    Returns:
        bool: True if token was successfully marked as used, False if not found
    """
    if not user_id or not token or not tenant_id:
        raise ValueError("User ID, token, and tenant ID are required")

    token_hash = hash_token(token)
    used_at = datetime.utcnow()

    with db_connection.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            """
            UPDATE password_resets
            SET used_at = %s
            WHERE user_id = %s
            AND token_hash = %s
            AND tenant_id = %s
            AND used_at IS NULL  -- Only mark unused tokens
        """,
            (used_at, user_id, token_hash, tenant_id),
        )

        if cursor.rowcount > 0:
            db_connection.commit()
            log.info("Marked reset token as used for user %s at %s", user_id, used_at.isoformat())
            return True
        else:
            log.warning(
                "Could not mark reset token as used for user %s (not found or already used)",
                user_id,
            )
            return False


def cleanup_expired_tokens(db_connection) -> int:
    """
    Remove expired password reset tokens from the database.

    This function should be called periodically to clean up the database
    and remove tokens that have expired. Called automatically by reset endpoints.

    Args:
        db_connection: Active database connection

    Returns:
        int: Number of expired tokens removed
    """
    with db_connection.cursor() as cursor:
        # Delete tokens that are older than 1 hour
        cursor.execute(
            """
            DELETE FROM password_resets
            WHERE expires_at < NOW()
        """
        )

        deleted_count = cursor.rowcount
        db_connection.commit()

        if deleted_count > 0:
            log.info("Cleaned up %d expired password reset tokens", deleted_count)
        else:
            log.debug("No expired password reset tokens to clean up")

        return deleted_count


def get_user_by_email(email: str, tenant_id: str, db_connection) -> Optional[dict]:
    """
    Look up a user by email address within a specific tenant.

    Args:
        email: The email address to look up
        tenant_id: The tenant ID for multi-tenant isolation
        db_connection: Active database connection

    Returns:
        dict: User record if found, None if not found

    Security Note:
        This function is used internally by reset endpoints.
        The reset request endpoint must NOT reveal whether an email exists or not.
    """
    if not email or not tenant_id:
        return None

    with db_connection.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            """
            SELECT id, email, name, tenant_id
            FROM customers
            WHERE email = %s AND tenant_id = %s
        """,
            (email, tenant_id),
        )

        result = cursor.fetchone()

        if result:
            log.debug("Found user by email in tenant %s", tenant_id)
            return dict(result)
        else:
            log.debug("No user found for email in tenant %s", tenant_id)
            return None
