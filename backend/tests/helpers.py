# -*- coding: utf-8 -*-
"""
Test helpers for standardized response handling and auth patterns.
Stabilizes auth-related unit tests with consistent envelope structures.
"""


def payload(data):
    """Standard success response envelope."""
    return {"success": True, "data": data}


def error_code(code, message="Error occurred"):
    """Standard error response envelope."""
    return {"success": False, "error": {"code": code, "message": message}}


def auth_headers(tenant_id="test_tenant", user_id="test_user", role="user"):
    """Standard authentication headers for test requests."""
    return {
        "X-Tenant-ID": tenant_id,
        "X-User-ID": user_id,
        "X-User-Role": role,
        "Authorization": "Bearer test_token",
        "Content-Type": "application/json",
    }
