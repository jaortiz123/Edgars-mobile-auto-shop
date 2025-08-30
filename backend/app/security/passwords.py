"""
TASK 4: Secure Password Hashing

This module provides secure password hashing and verification using bcrypt,
replacing the insecure SHA256 system while supporting dual verification
for backward compatibility and auto-migration.

Security Features:
- bcrypt with cost factor 12 for new passwords
- Dual verification supporting both SHA256 (legacy) and bcrypt (secure)
- Automatic migration from SHA256 to bcrypt on successful login
- Secure password storage that meets modern security standards
"""

import hashlib
from typing import Tuple

import bcrypt


def hash_password(plain: str) -> str:
    """
    Hash a plain text password using bcrypt with cost factor 12.

    Args:
        plain: The plain text password to hash

    Returns:
        str: The bcrypt hashed password (starts with $2b$)

    Example:
        >>> hashed = hash_password("mypassword123")
        >>> hashed.startswith("$2b$12$")
        True
    """
    # Convert to bytes and hash with bcrypt using cost factor 12
    password_bytes = plain.encode("utf-8")
    salt = bcrypt.gensalt(rounds=12)  # Cost factor 12 as required
    hashed = bcrypt.hashpw(password_bytes, salt)

    # Return as string for database storage
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> Tuple[bool, bool]:
    """
    Verify a password against a stored hash with dual SHA256/bcrypt support.

    This function supports both legacy SHA256 hashes and modern bcrypt hashes,
    enabling gradual migration from insecure to secure password storage.

    Args:
        plain: The plain text password to verify
        hashed: The stored hash (either SHA256 or bcrypt format)

    Returns:
        Tuple[bool, bool]: (is_valid, needs_migration)
            - is_valid: True if the password matches the hash
            - needs_migration: True if this is an old SHA256 hash that should be migrated

    Example:
        >>> # bcrypt hash verification
        >>> is_valid, needs_migration = verify_password("test", "$2b$12$...")
        >>> is_valid, needs_migration
        (True, False)

        >>> # SHA256 hash verification (legacy)
        >>> is_valid, needs_migration = verify_password("test", "sha256_hash...")
        >>> is_valid, needs_migration
        (True, True)
    """
    try:
        # Check if this is a bcrypt hash (starts with $2b$, $2a$, or $2y$)
        if hashed.startswith(("$2b$", "$2a$", "$2y$")):
            # Modern bcrypt verification
            password_bytes = plain.encode("utf-8")
            hashed_bytes = hashed.encode("utf-8")
            is_valid = bcrypt.checkpw(password_bytes, hashed_bytes)
            return is_valid, False  # No migration needed for bcrypt

        else:
            # Legacy SHA256 verification
            # Note: This is for standalone verification without salt parameter
            # In practice, the login function will need to retrieve the salt from database
            # and use the legacy _hash_password function format
            plain_hashed = hashlib.sha256(plain.encode("utf-8")).hexdigest()
            is_valid = plain_hashed == hashed
            return is_valid, is_valid  # If valid, needs migration to bcrypt

    except Exception:
        # Any error in verification means invalid password
        return False, False


def verify_password_with_salt(plain: str, hashed: str, salt: str) -> Tuple[bool, bool]:
    """
    Verify a password with explicit salt for legacy SHA256 compatibility.

    This function matches the exact format used by the existing _hash_password function:
    SHA256(salt + password)

    Args:
        plain: The plain text password to verify
        hashed: The stored SHA256 hash
        salt: The salt used in the original hash

    Returns:
        Tuple[bool, bool]: (is_valid, needs_migration)
    """
    try:
        # Check if this is a bcrypt hash (no salt needed)
        if hashed.startswith(("$2b$", "$2a$", "$2y$")):
            password_bytes = plain.encode("utf-8")
            hashed_bytes = hashed.encode("utf-8")
            is_valid = bcrypt.checkpw(password_bytes, hashed_bytes)
            return is_valid, False

        else:
            # Legacy SHA256 verification with salt (matches _hash_password format)
            h = hashlib.sha256()
            h.update((salt + plain).encode("utf-8"))
            expected = h.hexdigest()
            is_valid = expected == hashed
            return is_valid, is_valid  # If valid, needs migration to bcrypt

    except Exception:
        return False, False


def is_bcrypt_hash(hashed: str) -> bool:
    """
    Check if a stored hash is in bcrypt format.

    Args:
        hashed: The stored password hash

    Returns:
        bool: True if the hash is in bcrypt format
    """
    return hashed.startswith(("$2b$", "$2a$", "$2y$"))


def get_migration_stats(password_hashes: list) -> dict:
    """
    Analyze password hash formats for migration tracking.

    Args:
        password_hashes: List of password hashes from database

    Returns:
        dict: Statistics about hash formats
    """
    bcrypt_count = sum(1 for h in password_hashes if is_bcrypt_hash(h))
    sha256_count = len(password_hashes) - bcrypt_count

    return {
        "total": len(password_hashes),
        "bcrypt": bcrypt_count,
        "sha256": sha256_count,
        "migration_percentage": (
            (bcrypt_count / len(password_hashes) * 100) if password_hashes else 0
        ),
    }
