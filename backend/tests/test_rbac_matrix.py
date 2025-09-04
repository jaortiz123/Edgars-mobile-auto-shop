from http import HTTPStatus
import pytest
from typing import List, Tuple
import uuid

import backend.local_server as srv
from .fake_db import FakeConn

# Define RBAC expectations: roles considered authorized for admin endpoints.
AUTHORIZED_ROLES = {"Owner", "Advisor", "Accountant"}
UNAUTHORIZED_ROLES = {"Customer", "Technician"}  # include a test-only role

# Collect a representative subset of admin endpoints. For brevity we focus on those
# that exercise different HTTP methods and resource types. Extend as needed.
# Each entry: (method, path)
ENDPOINTS: List[Tuple[str, str]] = [
    ("GET", "/api/admin/invoices/inv-test/estimate.pdf"),
    ("GET", "/api/admin/invoices/inv-test/receipt.pdf"),
    ("GET", "/api/admin/invoices/inv-test/estimate.html"),
    ("GET", "/api/admin/invoices/inv-test/receipt.html"),
    ("POST", "/api/admin/invoices/inv-test/send"),
    ("GET", "/api/admin/vehicles/123/profile?customer_id=456"),  # triggers ownership decorator
]


@pytest.fixture()
def rbac_client(no_auto_auth_client, monkeypatch):
    """Client for RBAC tests with DB mocked and tenant enforcement bypassed."""
    # Ensure RBAC enforced (no dev bypass)
    try:
        srv.DEV_NO_AUTH = False  # type: ignore
    except Exception:
        pass
    # Patch db_conn to fake
    fake = FakeConn()
    monkeypatch.setattr(srv, "db_conn", lambda: fake)
    # Bypass strict tenant membership in before_request for fake DB
    monkeypatch.setenv("SKIP_TENANT_ENFORCEMENT", "true")
    return no_auto_auth_client


def _request(client, method: str, path: str, token: str, tenant_id: str):
    # Support query params already embedded in path
    func = getattr(client, method.lower())
    return func(path, headers={"Authorization": f"Bearer {token}", "X-Tenant-Id": tenant_id})


@pytest.mark.parametrize("method,path", ENDPOINTS)
@pytest.mark.parametrize("role", sorted(list(AUTHORIZED_ROLES | UNAUTHORIZED_ROLES)))
def test_rbac_matrix(method: str, path: str, role: str, rbac_client, rbac_utils):
    # fabricate token per-role; use synthetic tenant id (before_request trusts header in fake-db path)
    token = rbac_utils.token_for(role, sub=("1" if role == "Customer" else f"user-{role.lower()}"))
    tid = str(uuid.uuid4())
    resp = _request(rbac_client, method, path, token, tid)

    # If endpoint returns 404 for test IDs that's fine; we only assert RBAC (403 forbidden) behavior
    if role in UNAUTHORIZED_ROLES:
        assert (
            resp.status_code == HTTPStatus.FORBIDDEN
        ), f"Expected 403 for role={role} {method} {path}, got {resp.status_code}"
    else:
        assert (
            resp.status_code != HTTPStatus.FORBIDDEN
        ), f"Unexpected 403 for authorized role={role} {method} {path}"
