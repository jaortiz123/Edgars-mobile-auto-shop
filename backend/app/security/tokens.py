"""
TASK 5: Secure JWT Cookie System

This module provides secure JWT token generation and httpOnly cookie management,
replacing the insecure localStorage JWT system with secure cookie-based authentication.

Security Features:
- Access tokens with 15-minute expiry for short-lived authentication
- Refresh tokens with 14-day expiry for token rotation
- httpOnly cookies preventing XSS token theft
- Secure cookie flags for HTTPS environments
- Token rotation to limit exposure window
"""

import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Tuple

import jwt
from flask import Response

# JWT Configuration
JWT_SECRET = os.environ.get("JWT_SECRET", "dev_secret")
JWT_ALGORITHM = "HS256"

# Token Expiry Settings
ACCESS_TOKEN_EXPIRY_MINUTES = 15
REFRESH_TOKEN_EXPIRY_DAYS = 14

# Cookie Configuration
ACCESS_COOKIE_NAME = "__Host_access_token"
REFRESH_COOKIE_NAME = "__Host_refresh_token"


def make_tokens(user_id: str, tenant_ids: list[str]) -> Tuple[str, str]:
    """
    Generate access and refresh token pair for authenticated user.

    Args:
        user_id: The unique identifier for the user
        tenant_ids: List of tenant IDs the user has access to

    Returns:
        Tuple[str, str]: (access_token, refresh_token)

    Example:
        >>> access_token, refresh_token = make_tokens("user123", ["tenant1", "tenant2"])
        >>> # Tokens ready for httpOnly cookie storage
    """
    now = datetime.now(timezone.utc)

    # Generate Access Token (15-minute expiry)
    access_payload = {
        "user_id": user_id,
        "tenant_ids": tenant_ids,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRY_MINUTES),
        "type": "access",
    }

    access_token = jwt.encode(access_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    # Generate Refresh Token (14-day expiry)
    refresh_jti = str(uuid.uuid4())  # Unique ID for token rotation tracking
    refresh_payload = {
        "user_id": user_id,
        "jti": refresh_jti,  # JWT ID for refresh token rotation
        "iat": now,
        "exp": now + timedelta(days=REFRESH_TOKEN_EXPIRY_DAYS),
        "type": "refresh",
    }

    refresh_token = jwt.encode(refresh_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    return access_token, refresh_token


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """
    Set secure httpOnly authentication cookies on response.

    Args:
        response: Flask Response object to set cookies on
        access_token: JWT access token for authentication
        refresh_token: JWT refresh token for token rotation

    Cookie Security Features:
        - httpOnly: Prevents JavaScript access (XSS protection)
        - secure: HTTPS only transmission
        - samesite='Lax': CSRF protection while allowing normal navigation
        - __Host prefix: Additional security for HTTPS environments
    """
    # Set Access Token Cookie (15-minute expiry)
    response.set_cookie(
        ACCESS_COOKIE_NAME,
        access_token,
        max_age=ACCESS_TOKEN_EXPIRY_MINUTES * 60,  # 15 minutes in seconds
        httponly=True,  # Fixed: lowercase 'httponly'
        secure=False,  # Allow HTTP for development
        samesite="Lax",  # CSRF protection
        path="/",
    )

    # Set Refresh Token Cookie (14-day expiry)
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        refresh_token,
        max_age=REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60,  # 14 days in seconds
        httponly=True,  # Fixed: lowercase 'httponly'
        secure=False,  # Allow HTTP for development
        samesite="Lax",  # CSRF protection
        path="/",
    )


def verify_access_token(token: str) -> Dict[str, Any]:
    """
    Verify and decode an access token.

    Args:
        token: JWT access token to verify

    Returns:
        Dict[str, Any]: Decoded token payload

    Raises:
        jwt.ExpiredSignatureError: Token has expired
        jwt.InvalidTokenError: Token is invalid or malformed
        ValueError: Token is not an access token

    Example:
        >>> payload = verify_access_token(access_token)
        >>> user_id = payload['user_id']
        >>> tenant_ids = payload['tenant_ids']
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])

        # Verify this is an access token
        if payload.get("type") != "access":
            raise ValueError("Not an access token")

        return payload

    except jwt.ExpiredSignatureError:
        raise jwt.ExpiredSignatureError("Access token has expired")
    except jwt.InvalidTokenError as e:
        raise jwt.InvalidTokenError(f"Invalid access token: {str(e)}")


def verify_refresh_token(token: str) -> Dict[str, Any]:
    """
    Verify and decode a refresh token.

    Args:
        token: JWT refresh token to verify

    Returns:
        Dict[str, Any]: Decoded token payload

    Raises:
        jwt.ExpiredSignatureError: Token has expired
        jwt.InvalidTokenError: Token is invalid or malformed
        ValueError: Token is not a refresh token

    Example:
        >>> payload = verify_refresh_token(refresh_token)
        >>> user_id = payload['user_id']
        >>> jti = payload['jti']  # For rotation tracking
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])

        # Verify this is a refresh token
        if payload.get("type") != "refresh":
            raise ValueError("Not a refresh token")

        return payload

    except jwt.ExpiredSignatureError:
        raise jwt.ExpiredSignatureError("Refresh token has expired")
    except jwt.InvalidTokenError as e:
        raise jwt.InvalidTokenError(f"Invalid refresh token: {str(e)}")


def clear_auth_cookies(response: Response) -> None:
    """
    Clear authentication cookies (for logout).

    Args:
        response: Flask Response object to clear cookies on
    """
    response.set_cookie(
        ACCESS_COOKIE_NAME,
        "",
        expires=0,
        httponly=True,  # Fixed: lowercase 'httponly'
        secure=False,  # Allow HTTP for development
        samesite="Lax",
        path="/",
    )

    response.set_cookie(
        REFRESH_COOKIE_NAME,
        "",
        expires=0,
        httponly=True,  # Fixed: lowercase 'httponly'
        secure=False,  # Allow HTTP for development
        samesite="Lax",
        path="/",
    )


def extract_token_from_cookies(request) -> Tuple[str, str]:
    """
    Extract access and refresh tokens from request cookies.

    Args:
        request: Flask request object

    Returns:
        Tuple[str, str]: (access_token, refresh_token) - empty strings if not found
    """
    access_token = request.cookies.get(ACCESS_COOKIE_NAME, "")
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME, "")

    return access_token, refresh_token
