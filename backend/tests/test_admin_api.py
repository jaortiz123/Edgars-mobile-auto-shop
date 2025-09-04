import uuid
import os
import psycopg2
import pytest


def _ensure_tenant_and_owner(client):
    """Create a tenant and seed owner membership; return (tenant_id, token)."""
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
                "INSERT INTO tenants(id, slug, name, plan, status) VALUES (%s::uuid,%s,%s,'starter','active') ON CONFLICT DO NOTHING",
                (tid, f"t-{uuid.uuid4().hex[:6]}", "T"),
            )
            # Seed Owner membership for user 'owner'
            cur.execute(
                "INSERT INTO staff_tenant_memberships(staff_id, tenant_id, role) VALUES ('owner', %s::uuid, 'Owner') ON CONFLICT DO NOTHING",
                (tid,),
            )
            # Debug: verify row exists
            cur.execute(
                "SELECT COUNT(*) FROM staff_tenant_memberships WHERE staff_id='owner' AND tenant_id=%s::uuid",
                (tid,),
            )
            cnt = cur.fetchone()[0]
            print("DBG membership count:", cnt)
    # Verify the membership exists via same predicate used by server
    with psycopg2.connect(dsn) as chk:
        with chk.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM staff_tenant_memberships WHERE staff_id = %s AND tenant_id = %s::uuid",
                ("owner", tid),
            )
            print("DBG membership server check:", bool(cur.fetchone()))
    conn.close()

    # Login as owner to get token
    r_login = client.post("/api/admin/login", json={"username": "owner", "password": "pw"})
    assert r_login.status_code == 200, r_login.data
    token = r_login.get_json()["data"]["token"]
    return tid, token


def test_get_admin_appointments(client):
    """Test the GET /api/admin/appointments endpoint."""
    tenant_id, token = _ensure_tenant_and_owner(client)
    response = client.get(
        "/api/admin/appointments",
        headers={"Authorization": f"Bearer {token}", "X-Tenant-Id": tenant_id},
    )
    # Debug aid when hardening tests against new auth/tenant model
    if response.status_code != 200:
        try:
            print("DBG status:", response.status_code, "body:", response.get_json())
        except Exception:
            print("DBG status:", response.status_code, "raw:", response.data)
    assert response.status_code == 200
    j = response.get_json()
    # Envelope response shape
    assert "data" in j
    assert "appointments" in j["data"]
    assert "nextCursor" in j["data"]
    assert "errors" not in j
    assert "request_id" in j["meta"]


def test_get_admin_appointments_with_filters(client):
    """Test the GET /api/admin/appointments endpoint with filters."""
    tenant_id, token = _ensure_tenant_and_owner(client)
    response = client.get(
        "/api/admin/appointments?status=scheduled&limit=10",
        headers={"Authorization": f"Bearer {token}", "X-Tenant-Id": tenant_id},
    )
    assert response.status_code == 200
    j = response.get_json()
    # Envelope response shape with data filters
    assert "data" in j
    assert "appointments" in j["data"]
    assert len(j["data"]["appointments"]) <= 10
    assert "errors" not in j
    assert "request_id" in j["meta"]


def test_error_handler(client):
    """Test the global error handler."""
    # This endpoint does not exist, so it should trigger the error handler
    response = client.get("/api/non_existent_endpoint")
    assert response.status_code == 404
