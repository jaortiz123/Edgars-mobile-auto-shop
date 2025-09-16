import uuid
import pytest

from local_server import app as flask_app


@pytest.fixture()
def client(pg_container):  # reuse session-scoped container
    flask_app.config["TESTING"] = True
    with flask_app.test_client() as c:
        yield c


def _create_tenant(client, slug: str, name: str) -> str:
    # Direct DB insert via test DB connection is preferable, but reuse API where possible
    # Here we hit a debug admin endpoint is not available; fallback to raw SQL through migration runner is out of scope.
    # Instead, we rely on the fact that tenants table exists and use a helper route if added later.
    # As a portable fallback, use a synthetic UUID and insert via direct SQL using the test container's DB.
    import psycopg2
    import os

    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        host = os.environ.get("POSTGRES_HOST", "localhost")
        port = int(os.environ.get("POSTGRES_PORT", 5432))
        db = os.environ.get("POSTGRES_DB", "test_autoshop")
        user = os.environ.get("POSTGRES_USER", "test_user")
        password = os.environ.get("POSTGRES_PASSWORD", "test_password")
        dsn = f"postgresql://{user}:{password}@{host}:{port}/{db}"

    tid = str(uuid.uuid4())
    conn = psycopg2.connect(dsn)
    with conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO tenants(id, slug, name, plan, status) VALUES (%s::uuid, %s, %s, 'starter', 'active') ON CONFLICT (id) DO NOTHING",
                (tid, slug, name),
            )
    conn.close()
    return tid


@pytest.mark.integration
def test_customer_forbidden_across_tenant(client):
    # Arrange: two tenants
    tenant_a = _create_tenant(client, f"t-a-{uuid.uuid4().hex[:6]}", "Tenant A")
    tenant_b = _create_tenant(client, f"t-b-{uuid.uuid4().hex[:6]}", "Tenant B")

    email = f"tmember_{uuid.uuid4().hex[:8]}@example.com"
    password = "secretpw"

    # Register under tenant A (header drives membership and customer.tenant_id)
    r = client.post(
        "/api/customers/register",
        json={"email": email, "password": password, "name": "Tenant User"},
        headers={"X-Tenant-Id": tenant_a},
    )
    assert r.status_code == 200, r.data
    data = r.get_json()["data"]
    token = data["token"]
    cust_id = str(data["customer"]["id"])

    # Act: access profile with mismatched tenant header (Tenant B)
    r2 = client.get(
        f"/api/admin/customers/{cust_id}/profile",
        headers={"Authorization": f"Bearer {token}", "X-Tenant-Id": tenant_b},
    )

    # Assert: forbidden due to lack of membership in tenant B
    assert r2.status_code == 403, r2.data
    body = r2.get_json()
    assert body and body.get("error", {}).get("code") in {"forbidden", "FORBIDDEN"}


def _insert_staff_membership(staff_id: str, tenant_id: str):
    import psycopg2, os

    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        host = os.environ.get("POSTGRES_HOST", "localhost")
        port = int(os.environ.get("POSTGRES_PORT", 5432))
        db = os.environ.get("POSTGRES_DB", "test_autoshop")
        user = os.environ.get("POSTGRES_USER", "test_user")
        password = os.environ.get("POSTGRES_PASSWORD", "test_password")
        dsn = f"postgresql://{user}:{password}@{host}:{port}/{db}"
    conn = psycopg2.connect(dsn)
    with conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO staff_tenant_memberships(staff_id, tenant_id, role) VALUES (%s,%s::uuid,'Advisor') ON CONFLICT DO NOTHING",
                (staff_id, tenant_id),
            )
    conn.close()


@pytest.mark.integration
def test_advisor_forbidden_across_tenant(client):
    # tenants
    tenant_a = _create_tenant(client, f"t-a-{uuid.uuid4().hex[:6]}", "Tenant A")
    tenant_b = _create_tenant(client, f"t-b-{uuid.uuid4().hex[:6]}", "Tenant B")

    # customer under tenant A
    email = f"tmember_{uuid.uuid4().hex[:8]}@example.com"
    password = "secretpw"
    r = client.post(
        "/api/customers/register",
        json={"email": email, "password": password, "name": "Tenant User"},
        headers={"X-Tenant-Id": tenant_a},
    )
    assert r.status_code == 200, r.data
    cust_id = str(r.get_json()["data"]["customer"]["id"])

    # seed advisor membership only in tenant A
    _insert_staff_membership("advisor", tenant_a)

    # login as advisor
    r_login = client.post("/api/admin/login", json={"username": "advisor", "password": "pw"})
    assert r_login.status_code == 200
    token = r_login.get_json()["data"]["token"]

    # attempt to access with tenant B header → expect 403
    r2 = client.get(
        f"/api/admin/customers/{cust_id}/profile",
        headers={"Authorization": f"Bearer {token}", "X-Tenant-Id": tenant_b},
    )
    assert r2.status_code == 403, r2.data
    body = r2.get_json()
    assert body and body.get("error", {}).get("code") in {"forbidden", "FORBIDDEN"}
