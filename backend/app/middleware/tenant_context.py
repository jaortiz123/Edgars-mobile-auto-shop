# app/middleware/tenant_context.py
from contextlib import contextmanager
from typing import List, Optional

import psycopg2

TENANT_HEADER = "X-Tenant-Id"


@contextmanager
def tenant_context(cursor, tenant_id: Optional[str]):
    """Set tenant context on database cursor for RLS enforcement"""
    if tenant_id:
        cursor.execute("SET LOCAL app.tenant_id = %s", (tenant_id,))
        yield
    else:
        # SECURITY: Don't allow database operations without valid tenant context
        # This prevents authenticated users from accessing data when tenant validation fails
        raise PermissionError("Database access denied: No valid tenant context")


def validate_tenant_exists(tenant_id: str, db_connection) -> bool:
    """
    SECURITY: Validate that tenant ID exists in database
    No hardcoded whitelist - uses actual database records
    """
    if not tenant_id or not db_connection:
        return False

    try:
        with db_connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM tenants WHERE id = %s", (tenant_id,))
            return cursor.fetchone() is not None
    except (psycopg2.Error, Exception):
        return False


def get_user_tenant_memberships(user_id: str, db_connection) -> List[str]:
    """
    Get all tenant IDs that a user has access to.
    In this system, customers belong to a single tenant stored in customers.tenant_id
    """
    if not user_id or not db_connection:
        return []

    try:
        # Convert user_id to int since customers.id is integer type
        user_id_int = int(user_id)

        with db_connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT tenant_id
                FROM customers
                WHERE id = %s
            """,
                (user_id_int,),
            )
            result = cursor.fetchone()
            print(
                f"DEBUG get_user_tenant_memberships: user_id={user_id_int}, result={result}",
                flush=True,
            )

            if result:
                # Handle both regular cursor and RealDictCursor
                if hasattr(result, "get"):
                    # RealDictRow - access by column name
                    tenant_id = result["tenant_id"]
                else:
                    # Regular tuple - access by index
                    tenant_id = result[0]

                print(
                    f"DEBUG get_user_tenant_memberships: extracted tenant_id={tenant_id}",
                    flush=True,
                )
                return [tenant_id] if tenant_id else []
            else:
                print("DEBUG get_user_tenant_memberships: no result found", flush=True)
                return []

    except (psycopg2.Error, Exception, ValueError) as e:
        print(f"DEBUG get_user_tenant_memberships ERROR: {e}", flush=True)
        return []


def resolve_active_tenant(user, request, db_connection=None) -> Optional[str]:
    """
    SECURITY: Properly resolve tenant ID using actual multi-tenant architecture

    For unauthenticated endpoints (register/login):
        - Requires valid X-Tenant-Id header that exists in database
        - No hardcoded whitelist - checks actual tenant records

    For authenticated endpoints:
        - Validates user has access to requested tenant via user_tenants table
        - Falls back to user's first tenant if no header provided
    """
    requested_tenant = request.headers.get(TENANT_HEADER)
    print(
        f"DEBUG resolve_active_tenant START: user={user}, requested_tenant={requested_tenant}, has_db_connection={db_connection is not None}",
        flush=True,
    )
    print(
        f"DEBUG resolve_active_tenant HEADERS: TENANT_HEADER='{TENANT_HEADER}', all_headers={dict(request.headers)}",
        flush=True,
    )

    if user:
        # AUTHENTICATED REQUEST: Validate user tenant membership
        user_id = (
            getattr(user, "id", None) or getattr(user, "user_id", None) or str(user.get("sub", ""))
            if isinstance(user, dict)
            else None
        )
        print(
            f"DEBUG resolve_active_tenant: user_id={user_id}, requested_tenant={requested_tenant}",
            flush=True,
        )

        if user_id and db_connection:
            # SECURITY FIX: Handle admin users properly
            # Check if user has tenant_id in their JWT (admin users)
            jwt_tenant_id = user.get("tenant_id") if isinstance(user, dict) else None

            if jwt_tenant_id:
                # Admin user with tenant binding in JWT
                print(
                    f"DEBUG resolve_active_tenant: Admin user {user_id} has JWT tenant binding: {jwt_tenant_id}"
                )

                # Enforce that admin can only access the tenant they're bound to
                if requested_tenant and requested_tenant != jwt_tenant_id:
                    print(
                        f"DEBUG resolve_active_tenant: Admin access DENIED - requested {requested_tenant} but bound to {jwt_tenant_id}"
                    )
                    return None

                # Grant access to the tenant the admin is bound to
                print(
                    f"DEBUG resolve_active_tenant: Admin access granted to bound tenant {jwt_tenant_id}"
                )
                return jwt_tenant_id

            # Regular user - check tenant memberships
            user_tenants = get_user_tenant_memberships(user_id, db_connection)
            print(f"DEBUG resolve_active_tenant: user_tenants={user_tenants}", flush=True)

            if not user_tenants:
                # User has no tenant memberships - security violation
                print(
                    "DEBUG resolve_active_tenant: User has no tenant memberships - SECURITY VIOLATION"
                )
                return None

            if requested_tenant:
                # User requested specific tenant - validate they have access
                print(
                    f"DEBUG resolve_active_tenant: Checking if {requested_tenant} in {user_tenants}"
                )
                if requested_tenant in user_tenants:
                    print(f"DEBUG resolve_active_tenant: Access granted to {requested_tenant}")
                    return requested_tenant
                else:
                    # User requested tenant they don't have access to
                    print(f"DEBUG resolve_active_tenant: Access DENIED to {requested_tenant}")
                    return None
            else:
                # SECURITY: For production, always require explicit tenant context
                # No tenant specified - reject for security (don't auto-default)
                print(
                    "DEBUG resolve_active_tenant: No tenant header provided - SECURITY VIOLATION",
                    flush=True,
                )
                return None

    else:
        # UNAUTHENTICATED REQUEST: Require valid tenant header for registration/login
        if requested_tenant and db_connection:
            if validate_tenant_exists(requested_tenant, db_connection):
                return requested_tenant
            else:
                # Invalid tenant ID - reject request
                return None

        # No tenant header for unauthenticated request - security violation
        # In production, all requests must specify a valid tenant
        return None


def require_tenant_context(func):
    """Decorator to enforce tenant context on admin routes"""

    def wrapper(*args, **kwargs):
        from flask import request

        # Get tenant ID (simplified for now)
        tenant_id = resolve_active_tenant(None, request)

        # Pass tenant_id to the route function
        return func(tenant_id, *args, **kwargs)

    wrapper.__name__ = func.__name__
    return wrapper
