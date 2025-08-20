import jwt
from http import HTTPStatus
import pytest
from typing import List, Tuple

import backend.local_server as srv
from .fake_db import FakeConn

JWT_SECRET = getattr(srv, "JWT_SECRET", "dev-secret")
JWT_ALG = getattr(srv, "JWT_ALG", "HS256")

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


def make_token(role: str):
    payload = {"sub": f"user-{role.lower()}", "role": role}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


@pytest.fixture()
def client():
    srv.app.config.update(TESTING=True)
    # Ensure DEV_NO_AUTH is disabled so RBAC enforced
    srv.DEV_NO_AUTH = False  # type: ignore
    # Patch db_conn to avoid real DB calls (return minimal fake)
    fake = FakeConn()
    srv.db_conn = lambda: fake  # type: ignore
    with srv.app.test_client() as c:
        yield c


def _request(client, method: str, path: str, token: str):
    # Support query params already embedded in path
    func = getattr(client, method.lower())
    return func(path, headers={"Authorization": f"Bearer {token}"})


@pytest.mark.parametrize("method,path", ENDPOINTS)
@pytest.mark.parametrize("role", sorted(list(AUTHORIZED_ROLES | UNAUTHORIZED_ROLES)))
def test_rbac_matrix(method: str, path: str, role: str, client):
    token = make_token(role)
    resp = _request(client, method, path, token)

    # If endpoint returns 404 for test IDs that's fine; we only assert RBAC (403 forbidden) behavior
    if role in UNAUTHORIZED_ROLES:
        assert (
            resp.status_code == HTTPStatus.FORBIDDEN
        ), f"Expected 403 for role={role} {method} {path}, got {resp.status_code}"
    else:
        assert (
            resp.status_code != HTTPStatus.FORBIDDEN
        ), f"Unexpected 403 for authorized role={role} {method} {path}"
