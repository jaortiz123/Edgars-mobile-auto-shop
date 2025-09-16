import uuid
import pytest

from local_server import app as flask_app


@pytest.fixture()
def client(pg_container):  # reuse session-scoped container
    flask_app.config["TESTING"] = True
    with flask_app.test_client() as c:
        yield c


@pytest.mark.integration
def test_customer_register_and_login_flow(client):
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    password = "secretpw"
    r = client.post(
        "/api/customers/register", json={"email": email, "password": password, "name": "Test User"}
    )
    assert r.status_code == 200, r.data
    data = r.get_json()["data"]
    token = data["token"]
    cust_id = str(data["customer"]["id"])
    assert data["customer"]["email"] == email

    # Login
    r2 = client.post("/api/customers/login", json={"email": email, "password": password})
    assert r2.status_code == 200, r2.data
    token2 = r2.get_json()["data"]["token"]
    assert token2

    # Self profile
    r3 = client.get(
        f"/api/admin/customers/{cust_id}/profile", headers={"Authorization": f"Bearer {token2}"}
    )
    assert r3.status_code == 200, r3.data
    prof = r3.get_json()["data"]
    assert prof["customer"]["id"] == cust_id


@pytest.mark.integration
def test_customer_login_wrong_password(client):
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    password = "secretpw"
    client.post("/api/customers/register", json={"email": email, "password": password})
    bad = client.post("/api/customers/login", json={"email": email, "password": "nope"})
    assert bad.status_code == 401
    body = bad.get_json()
    assert body["error"]["code"] == "invalid_credentials"


@pytest.mark.integration
def test_customer_register_conflict(client):
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    password = "secretpw"
    first = client.post("/api/customers/register", json={"email": email, "password": password})
    assert first.status_code == 200
    second = client.post("/api/customers/register", json={"email": email, "password": password})
    assert second.status_code == 409
