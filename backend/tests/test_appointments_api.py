import pytest
import pytest

@pytest.fixture()
def client():
    # Import local_server here to ensure a fresh app instance for each test
    from backend.local_server import app as flask_app_instance
    flask_app_instance.testing = True
    flask_app_instance.config["PROPAGATE_EXCEPTIONS"] = False
    with flask_app_instance.test_client() as c:
        yield c

def test_get_admin_appointments_returns_empty_list_if_no_db(client):
    r = client.get("/api/admin/appointments")
    assert r.status_code == 200
    j = r.get_json()
    assert j["appointments"] == []
    assert j["nextCursor"] is None

# You would add more comprehensive tests here once you have a database setup
# and can insert test data.
