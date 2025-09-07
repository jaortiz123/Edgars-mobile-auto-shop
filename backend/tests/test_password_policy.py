import uuid

import pytest

from local_server import app as flask_app


@pytest.fixture()
def client(pg_container):
    flask_app.config["TESTING"] = True
    with flask_app.test_client() as c:
        yield c


def test_registration_rejects_weak_password(client):
    # Create a tenant to attach registration against
    import os
    import psycopg2

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

    # Weak password should be rejected (too short / missing complexity)
    r = client.post(
        "/api/customers/register",
        json={"email": f"u{uuid.uuid4().hex[:6]}@ex.com", "password": "short"},
        headers={"X-Tenant-Id": tid},
    )
    assert r.status_code == 400
    assert b"Password" in r.data or b"password" in r.data
