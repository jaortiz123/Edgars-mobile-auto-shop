"""
Integration tests for Admin Appointments Repository
Tests real database operations with verbatim monolith SQL
"""

import os

import pytest

from backend.domain.appointments.repository import SqlAppointmentRepository
from backend.domain.appointments.service import ListQuery
from backend.infra.repositories import DatabaseManager


@pytest.fixture
def db_manager():
    """Create database manager with test environment"""
    # Ensure DB env vars are set
    required_vars = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"]
    missing = [var for var in required_vars if not os.getenv(var)]
    if missing:
        pytest.skip(f"Database integration tests require env vars: {missing}")

    db = DatabaseManager()

    # Initialize with fake app for env var reading
    class FakeApp:
        config = {}

    db.init_app(FakeApp())
    return db


@pytest.fixture
def repository(db_manager):
    """Create appointment repository"""
    return SqlAppointmentRepository(db_manager)


@pytest.fixture
def clean_test_data(db_manager):
    """Clean up test data before and after tests"""

    def cleanup():
        try:
            with db_manager.get_connection() as conn:
                with conn.cursor() as cur:
                    # Clean up test appointments
                    cur.execute("DELETE FROM appointments WHERE notes LIKE 'TEST_%'")
                    # Clean up test customers/vehicles if created
                    cur.execute("DELETE FROM customers WHERE name LIKE 'TEST_%'")
                    cur.execute("DELETE FROM vehicles WHERE make LIKE 'TEST_%'")
                    conn.commit()
        except Exception:
            pass  # Ignore cleanup errors

    cleanup()  # Clean before test
    yield
    cleanup()  # Clean after test


def test_repository_create_and_get(repository, clean_test_data):
    """Test create appointment then get() must match"""
    # Create test data
    test_data = {
        "customer_id": "test-customer-123",
        "vehicle_id": "test-vehicle-456",
        "service_code": "OIL_CHANGE",
        "scheduled_at": "2024-01-01T10:00:00Z",
        "notes": "TEST_INTEGRATION_CREATE",
        "status": "SCHEDULED",
        "total_amount": 89.99,
    }

    # Create appointment
    created = repository.create(test_data)

    # Verify creation
    assert created is not None
    assert created["id"] is not None
    assert created["status"] == "SCHEDULED"
    assert created["notes"] == "TEST_INTEGRATION_CREATE"

    # Get appointment by ID
    retrieved = repository.get(created["id"])

    # Verify get() matches create()
    assert retrieved is not None
    assert retrieved["id"] == created["id"]
    assert retrieved["status"] == created["status"]
    assert retrieved["notes"] == created["notes"]


def test_repository_list_pagination(repository, clean_test_data):
    """Test list() pagination and status filtering"""
    # Create multiple test appointments
    base_data = {
        "customer_id": "test-customer-list",
        "vehicle_id": "test-vehicle-list",
        "service_code": "TEST_SERVICE",
        "scheduled_at": "2024-01-01T10:00:00Z",
    }

    created_ids = []
    for i in range(5):
        data = base_data.copy()
        data["notes"] = f"TEST_LIST_ITEM_{i}"
        data["status"] = "SCHEDULED" if i < 3 else "IN_PROGRESS"
        created = repository.create(data)
        created_ids.append(created["id"])

    # Test pagination
    query = ListQuery(page=1, page_size=3)
    result = repository.list(query)

    assert "appointments" in result
    assert len(result["appointments"]) <= 3

    # Test status filtering
    query = ListQuery(status="SCHEDULED")
    result = repository.list(query)

    # Should find at least our 3 SCHEDULED test appointments
    scheduled_count = len([a for a in result["appointments"] if a["status"] == "SCHEDULED"])
    assert scheduled_count >= 3


def test_repository_list_search(repository, clean_test_data):
    """Test list() search functionality"""
    # Create appointment with searchable data
    test_data = {
        "customer_id": "test-customer-search",
        "vehicle_id": "test-vehicle-search",
        "service_code": "UNIQUE_SEARCH_SERVICE",
        "scheduled_at": "2024-01-01T10:00:00Z",
        "notes": "TEST_SEARCHABLE_APPOINTMENT",
    }

    created = repository.create(test_data)

    # Search by notes content
    query = ListQuery(search="SEARCHABLE")
    result = repository.list(query)

    # Should find our test appointment
    found = any(a["id"] == created["id"] for a in result["appointments"])
    assert found, f"Search for 'SEARCHABLE' should find appointment {created['id']}"


def test_repository_patch_status(repository, clean_test_data):
    """Test patch_status() updates appointment status"""
    # Create test appointment
    test_data = {
        "customer_id": "test-customer-patch",
        "vehicle_id": "test-vehicle-patch",
        "service_code": "PATCH_TEST",
        "scheduled_at": "2024-01-01T10:00:00Z",
        "notes": "TEST_PATCH_STATUS",
        "status": "SCHEDULED",
    }

    created = repository.create(test_data)
    assert created["status"] == "SCHEDULED"

    # Patch status
    updated = repository.patch_status(created["id"], "IN_PROGRESS")

    # Verify status changed
    assert updated["status"] == "IN_PROGRESS"
    assert updated["id"] == created["id"]

    # Verify persistence
    retrieved = repository.get(created["id"])
    assert retrieved["status"] == "IN_PROGRESS"


def test_repository_update(repository, clean_test_data):
    """Test update() method"""
    # Create test appointment
    test_data = {
        "customer_id": "test-customer-update",
        "vehicle_id": "test-vehicle-update",
        "service_code": "UPDATE_TEST",
        "scheduled_at": "2024-01-01T10:00:00Z",
        "notes": "TEST_UPDATE_ORIGINAL",
        "total_amount": 100.00,
    }

    created = repository.create(test_data)

    # Update appointment
    update_data = {"notes": "TEST_UPDATE_MODIFIED", "total_amount": 150.00, "status": "IN_PROGRESS"}

    updated = repository.update(created["id"], update_data)

    # Verify updates
    assert updated["notes"] == "TEST_UPDATE_MODIFIED"
    assert float(updated["total_amount"]) == 150.00
    assert updated["status"] == "IN_PROGRESS"
    assert updated["id"] == created["id"]


# Test idempotency (manual test - requires API layer)
def test_create_idempotency_note():
    """
    NOTE: Full idempotency testing requires X-Idempotency-Key headers
    which are handled at the API/middleware layer, not repository layer.

    For complete idempotency testing, use:

    curl -X POST \\
      -H 'Content-Type: application/json' \\
      -H 'X-Idempotency-Key: test-key-123' \\
      -d '{"customer_id":"c1","vehicle_id":"v1","service_code":"S1","scheduled_at":"2024-01-01T00:00:00Z"}' \\
      http://localhost:3001/api/admin/appointments

    (Run twice with same idempotency key to verify same response)
    """
    pass
