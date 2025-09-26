from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from backend.services.appointments_repository import AppointmentsRepository
from backend.services.appointments_service import AppointmentsService


class _StubRepository:
    def __init__(self) -> None:
        self.calls = []

    def list(self, *, tenant_id, filters, limit, offset):  # pragma: no cover - exercised in tests
        self.calls.append(
            {
                "tenant_id": tenant_id,
                "filters": filters,
                "limit": limit,
                "offset": offset,
            }
        )
        return []


@pytest.mark.unit
def test_list_mobile_clamps_page_size() -> None:
    repo = _StubRepository()
    service = AppointmentsService(repo)

    result = service.list_mobile(
        "tenant-123",
        {
            "page": "2",
            "pageSize": "500",
        },
    )

    assert result.page == 2
    assert result.page_size == 100
    assert repo.calls[0]["limit"] == 100
    assert repo.calls[0]["offset"] == 100


@pytest.mark.unit
def test_list_mobile_rejects_invalid_status() -> None:
    service = AppointmentsService(_StubRepository())

    with pytest.raises(ValueError, match="status is invalid"):
        service.list_mobile(
            "tenant-123",
            {
                "status": "bogus",
            },
        )


@pytest.fixture()
def memory_repo(monkeypatch):
    repo = AppointmentsRepository()

    monkeypatch.setattr(
        "backend.services.appointments_repository.safe_conn",
        lambda: (None, True, None),
    )

    base = datetime(2025, 1, 1, 9, 0, tzinfo=timezone.utc)
    repo.seed_memory(
        [
            {
                "id": "B",
                "status": "scheduled",
                "title": "Brake job",
                "start_ts": (base + timedelta(hours=1)).isoformat(),
                "end_ts": (base + timedelta(hours=2)).isoformat(),
                "total_amount": Decimal("12.345"),
                "created_at": (base + timedelta(minutes=5)).isoformat(),
                "customer_id": 10,
            },
            {
                "id": "A",
                "status": "scheduled",
                "title": "Oil change",
                "start_ts": (base + timedelta(hours=1)).isoformat(),
                "end_ts": (base + timedelta(hours=1, minutes=30)).isoformat(),
                "total_amount": Decimal("42.5"),
                "created_at": base.isoformat(),
                "customer_id": 20,
            },
            {
                "id": "C",
                "status": "ready",
                "title": "Detailing",
                "start_ts": None,
                "end_ts": None,
                "total_amount": Decimal("0"),
                "created_at": (base - timedelta(days=1)).isoformat(),
                "customer_id": 30,
            },
        ]
    )
    return repo


@pytest.mark.unit
def test_repository_memory_sort_is_deterministic(memory_repo) -> None:
    first_run = memory_repo.list(tenant_id="tenant", filters={}, limit=10, offset=0)
    second_run = memory_repo.list(tenant_id="tenant", filters={}, limit=10, offset=0)

    ids = [item.id for item in first_run]
    assert ids == ["B", "A", "C"]
    assert [item.id for item in second_run] == ids
    assert first_run[0].total_amount_cents == 1235
    assert first_run[0].start_ts.tzinfo == timezone.utc
    assert first_run[0].end_ts.tzinfo == timezone.utc


@pytest.mark.unit
def test_service_filters_and_serializes(memory_repo) -> None:
    service = AppointmentsService(memory_repo)

    result = service.list_mobile(
        "tenant-123",
        {
            "status": "ready",
            "pageSize": "15",
        },
    )

    assert result.page == 1
    assert result.page_size == 15
    assert [item.id for item in result.items] == ["C"]
    assert result.items[0].status == "READY"
    assert result.items[0].start_at is None
    assert result.items[0].total_amount_cents == 0
    # Zero amount + null scheduling surfaces `None` serialization path.
