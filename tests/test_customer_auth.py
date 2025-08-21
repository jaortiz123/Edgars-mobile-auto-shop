import os
import uuid

import pytest

try:
    pytest.pg_container  # type: ignore[attr-defined]
except Exception:  # provide lightweight container fixture if backend/tests not loaded
    from pathlib import Path

    import psycopg2
    from testcontainers.postgres import PostgresContainer

    @pytest.fixture(scope="session")
    def pg_container():  # pragma: no cover - simple infra
        with PostgresContainer("postgres:15-alpine") as postgres:
            raw_db_url = postgres.get_connection_url()
            db_url = raw_db_url.replace("postgresql+psycopg2://", "postgresql://")
            os.environ["DATABASE_URL"] = db_url
            # Apply schema
            schema_file = Path("backend/tests/test_schema.sql")
            with open(schema_file) as f:
                schema_sql = f.read()
            conn = psycopg2.connect(db_url)
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute(schema_sql)
            conn.close()
            yield {"db_url": db_url}


# Ensure we import the single app instance
from backend import local_server as srv  # noqa

app = srv.app


@pytest.fixture()
def client(pg_container, monkeypatch):  # depends on DB container from backend/tests/conftest.py
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def test_customer_register_and_login_flow(client):
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    password = "secretpw"

    # Register
    r = client.post(
        "/api/customers/register", json={"email": email, "password": password, "name": "Test User"}
    )
    assert r.status_code == 200, r.data
    data = r.get_json()["data"]
    assert "token" in data
    cust = data["customer"]
    assert cust["email"] == email
    cust_id = str(cust["id"])

    # Login
    r2 = client.post("/api/customers/login", json={"email": email, "password": password})
    assert r2.status_code == 200, r2.data
    token2 = r2.get_json()["data"]["token"]
    assert token2

    # Access profile (self)
    r3 = client.get(
        f"/api/admin/customers/{cust_id}/profile", headers={"Authorization": f"Bearer {token2}"}
    )
    assert r3.status_code == 200, r3.data
    prof = r3.get_json()["data"]
    assert prof["customer"]["id"] == cust_id


def test_customer_login_wrong_password(client):
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    password = "secretpw"
    client.post("/api/customers/register", json={"email": email, "password": password})
    bad = client.post("/api/customers/login", json={"email": email, "password": "nope"})
    assert bad.status_code == 401
    body = bad.get_json()
    assert body["error"]["code"] == "invalid_credentials"


def test_customer_register_conflict(client):
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    password = "secretpw"
    first = client.post("/api/customers/register", json={"email": email, "password": password})
    assert first.status_code == 200
    second = client.post("/api/customers/register", json={"email": email, "password": password})
    assert second.status_code == 409
