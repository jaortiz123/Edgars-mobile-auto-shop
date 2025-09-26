"""HTTP contract coverage for the mobile appointments list endpoint."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Iterator

import pytest

pytestmark = pytest.mark.unit


@pytest.fixture(autouse=True)
def mobile_appointments_memory(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Seed the mobile appointments service with deterministic in-memory data."""
    from backend.routes.mobile import appointments as mobile_mod
    from backend.services.appointments_repository import AppointmentsRepository
    from backend.services.appointments_service import AppointmentsService

    monkeypatch.setenv("FALLBACK_TO_MEMORY", "true")
    monkeypatch.setattr(
        "backend.services.appointments_repository.safe_conn",
        lambda: (None, True, None),
    )

    repository = AppointmentsRepository()
    base_start = datetime(2024, 1, 1, tzinfo=timezone.utc)
    rows = []
    for idx in range(1, 121):
        start = base_start + timedelta(minutes=idx)
        end = start + timedelta(minutes=45)
        created = base_start - timedelta(minutes=idx)
        rows.append(
            {
                "id": f"apt-{idx:03d}",
                "status": "SCHEDULED" if idx % 4 else "IN_PROGRESS",
                "title": f"Appointment {idx}",
                "start_ts": start,
                "end_ts": end,
                "customer_name": f"Customer {idx}",
                "vehicle_label": f"Vehicle {idx}",
                "total_amount": (Decimal("80.25") + Decimal(idx)).quantize(Decimal("0.01")),
                "created_at": created,
                "customer_id": idx,
            }
        )
    repository.seed_memory(rows)

    patched_service = AppointmentsService(appointment_repository=repository)
    original_service = mobile_mod._service
    mobile_mod._service = patched_service
    try:
        yield
    finally:
        mobile_mod._service = original_service


def _get_mobile_payload(client, **query):
    response = client.get("/api/appointments", query_string=query)
    assert response.status_code == 200
    payload = response.get_json()
    assert isinstance(payload, dict)
    assert "data" in payload
    assert "meta" in payload
    return payload


def test_mobile_list_clamps_page_size(client):
    payload = _get_mobile_payload(client, pageSize=500)
    data = payload["data"]
    assert data["page"] == 1
    assert data["pageSize"] == 100
    assert len(data["items"]) == 100
    assert data["nextCursor"] is None
    assert isinstance(payload["meta"].get("request_id"), str)


def test_mobile_list_is_deterministic(client):
    payload_one = _get_mobile_payload(client, pageSize=40)
    payload_two = _get_mobile_payload(client, pageSize=40)

    items_one = payload_one["data"]["items"]
    items_two = payload_two["data"]["items"]

    assert len(items_one) == len(items_two) == 40
    assert items_one[0]["id"] == items_two[0]["id"]
    assert items_one[-1]["id"] == items_two[-1]["id"]


def test_mobile_list_money_in_cents_and_utc(client):
    payload = _get_mobile_payload(client, pageSize=10)
    item = payload["data"]["items"][0]

    assert isinstance(item["totalAmountCents"], int)
    assert item["totalAmountCents"] > 0
    assert item["startAt"].endswith("Z")
    assert item["endAt"].endswith("Z")


def test_cors_preflight_and_board_contract_intact(client, monkeypatch):
    # Ensure admin board uses memory fallback without hitting a real database.
    monkeypatch.setattr("backend.local_server.safe_conn", lambda: (None, True, None))

    origin = "http://localhost:5173"
    preflight = client.open(
        "/api/admin/appointments/board",
        method="OPTIONS",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
        },
    )
    assert preflight.status_code == 204
    assert preflight.headers.get("Access-Control-Allow-Origin") == origin
    assert "GET" in preflight.headers.get("Access-Control-Allow-Methods", "")

    board_response = client.get("/api/admin/appointments/board")
    assert board_response.status_code == 200
    board_payload = board_response.get_json()
    assert isinstance(board_payload, dict)
    assert "data" not in board_payload
    assert "columns" in board_payload and "cards" in board_payload
    # Board endpoint intentionally retains legacy payload shape (no `_ok` envelope).
