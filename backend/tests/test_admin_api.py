import pytest
from backend.local_server import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_get_admin_appointments(client):
    """Test the GET /api/admin/appointments endpoint."""
    response = client.get('/api/admin/appointments')
    assert response.status_code == 200
    j = response.get_json()
    # Envelope response shape
    assert 'data' in j
    assert 'appointments' in j['data']
    assert 'nextCursor' in j['data']
    assert j['errors'] is None
    assert 'request_id' in j['meta']

def test_get_admin_appointments_with_filters(client):
    """Test the GET /api/admin/appointments endpoint with filters."""
    response = client.get('/api/admin/appointments?status=scheduled&limit=10')
    assert response.status_code == 200
    j = response.get_json()
    # Envelope response shape with data filters
    assert 'data' in j
    assert 'appointments' in j['data']
    assert len(j['data']['appointments']) <= 10
    assert j['errors'] is None
    assert 'request_id' in j['meta']

def test_error_handler(client):
    """Test the global error handler."""
    # This endpoint does not exist, so it should trigger the error handler
    response = client.get('/api/non_existent_endpoint')
    assert response.status_code == 404
