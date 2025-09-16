import uuid
import re
import pytest
from typing import Optional

from local_server import app as flask_app


@pytest.fixture()
def client(pg_container):
    flask_app.config["TESTING"] = True
    with flask_app.test_client() as c:
        yield c


def _get_cookie(resp, name: str) -> Optional[str]:
    hdr = resp.headers.get("Set-Cookie", "")
    # naive parse across multiple Set-Cookie lines handled by werkzeug joining into a single header
    cookies = re.findall(r"(^|, )([^=]+)=([^;]+);", hdr)
    for _, k, v in cookies:
        if k.strip() == name:
            return v
    return None


@pytest.mark.integration
def test_cookie_auth_and_csrf_block(client):
    # create tenant
    import psycopg2, os

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
    conn.close()

    # seed advisor membership
    conn = psycopg2.connect(dsn)
    with conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO staff_tenant_memberships(staff_id, tenant_id, role) VALUES ('advisor', %s::uuid, 'Advisor') ON CONFLICT DO NOTHING",
                (tid,),
            )
    conn.close()

    # login advisor to get cookies
    r_login = client.post("/api/admin/login", json={"username": "advisor", "password": "x"})
    assert r_login.status_code == 200
    access_cookie = _get_cookie(r_login, "__Host_access_token")
    xsrf_cookie = _get_cookie(r_login, "XSRF-TOKEN")
    assert access_cookie, "missing access cookie"
    assert xsrf_cookie, "missing xsrf cookie"

    # attempt POST without X-CSRF-Token header → 403
    payload = {"status": "SCHEDULED", "start": "2025-01-01T10:00:00Z"}
    r_forbidden = client.post(
        "/api/admin/appointments",
        json=payload,
        headers={
            "Cookie": f"__Host_access_token={access_cookie}; XSRF-TOKEN={xsrf_cookie}",
            "X-Tenant-Id": tid,
        },
    )
    assert r_forbidden.status_code == 403

    # same request with correct CSRF header → should not 403 (expect 201/200 or validation error if payload off)
    r_ok = client.post(
        "/api/admin/appointments",
        json=payload,
        headers={
            "Cookie": f"__Host_access_token={access_cookie}; XSRF-TOKEN={xsrf_cookie}",
            "X-Tenant-Id": tid,
            "X-CSRF-Token": xsrf_cookie,
        },
    )
    assert r_ok.status_code in (200, 201, 400), r_ok.data
