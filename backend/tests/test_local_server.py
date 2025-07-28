
import pytest
from backend import local_server

@pytest.fixture
def client():
    local_server.app.config['TESTING'] = True
    with local_server.app.test_client() as client:
        yield client

def test_get_board_happy_path(client):
    """Test the /api/admin/appointments/board endpoint with a valid request."""
    response = client.get('/api/admin/appointments/board')
    assert response.status_code == 200
    data = response.get_json()
    assert 'columns' in data
    assert 'cards' in data

def test_get_board_empty_dataset(client, mocker):
    """Test the /api/admin/appointments/board endpoint with an empty dataset."""
    mocker.patch('backend.local_server.db_conn', return_value=None)
    response = client.get('/api/admin/appointments/board')
    assert response.status_code == 200
    data = response.get_json()
    assert data['cards'] == []
    assert len(data['columns']) > 0

def test_get_stats_happy_path(client, fake_db):
    """Test the /api/admin/dashboard/stats endpoint with a valid request."""
    response = client.get('/api/admin/dashboard/stats')
    assert response.status_code == 200
    data = response.get_json()
    assert 'jobsToday' in data
    assert 'carsOnPremises' in data
    assert 'unpaidTotal' in data

def test_get_stats_db_error(client, mocker):
    """Test the /api/admin/dashboard/stats endpoint with a database error."""
    mocker.patch('backend.local_server.db_conn', side_effect=Exception("DB Error"))
    response = client.get('/api/admin/dashboard/stats')
    assert response.status_code == 500
