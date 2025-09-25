"""
Unit tests for appointment service layer
"""

from backend.domain.appointments.service import AppointmentService, ListQuery


class FakeRepo:
    def list(self, q):
        return {"items": [], "page": q.page, "page_size": q.page_size}

    def create(self, d):
        return {"id": "seed-appt-1", **d}

    def get(self, i):
        return None

    def update(self, i, d):
        return {"id": i, **d}

    def patch_status(self, i, s):
        return {"id": i, "status": s}


def test_service_happy_paths():
    """Test basic service operations with fake repo"""
    svc = AppointmentService(FakeRepo())

    # Test create
    out = svc.create(
        {
            "customer_id": "c1",
            "vehicle_id": "v1",
            "service_code": "S1",
            "scheduled_at": "2024-01-01T00:00:00Z",
        }
    )
    assert out["id"].startswith("seed-appt-")

    # Test list
    query = ListQuery(page=1, page_size=10)
    result = svc.list(query)
    assert result["page"] == 1
    assert result["page_size"] == 10
    assert "items" in result

    # Test get (returns None from fake)
    appt = svc.get("seed-appt-1")
    assert appt is None

    # Test update
    updated = svc.update("seed-appt-1", {"notes": "updated"})
    assert updated["id"] == "seed-appt-1"
    assert updated["notes"] == "updated"

    # Test patch_status
    patched = svc.patch_status("seed-appt-1", "completed")
    assert patched["id"] == "seed-appt-1"
    assert patched["status"] == "completed"
