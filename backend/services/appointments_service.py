"""Domain-level operations for mobile appointments endpoints."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .appointments_repository import AppointmentRecord, AppointmentsRepository

ALLOWED_STATUSES = {
    "SCHEDULED",
    "IN_PROGRESS",
    "READY",
    "COMPLETED",
    "NO_SHOW",
    "CANCELED",
}


@dataclass
class AppointmentListParams:
    """Input parameters for listing appointments."""

    tenant_id: str
    page: int
    page_size: int
    status: Optional[str]
    start_from: Optional[datetime]
    start_to: Optional[datetime]
    customer_id: Optional[int]

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    def as_filters(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "from": self.start_from,
            "to": self.start_to,
            "customer_id": self.customer_id,
        }


@dataclass(frozen=True)
class AppointmentListItem:
    id: str
    status: str
    title: Optional[str]
    start_at: Optional[datetime]
    end_at: Optional[datetime]
    customer_name: Optional[str]
    vehicle_label: Optional[str]
    total_amount_cents: int


@dataclass(frozen=True)
class AppointmentListResult:
    items: List[AppointmentListItem]
    page: int
    page_size: int
    next_cursor: Optional[str]


class AppointmentsService:
    """Pure domain service powering the mobile appointments API."""

    def __init__(self, appointment_repository: Optional[AppointmentsRepository] = None):
        self._appointments = appointment_repository or AppointmentsRepository()

    # ------------------------------------------------------------------
    # Listing
    # ------------------------------------------------------------------
    def list_mobile(self, tenant_id: str, raw_filters: Dict[str, Any]) -> AppointmentListResult:
        params = _build_list_params(tenant_id, raw_filters)
        records = self._appointments.list(
            tenant_id=params.tenant_id,
            filters=params.as_filters(),
            limit=params.page_size,
            offset=params.offset,
        )
        items = [self._record_to_item(rec) for rec in records]
        return AppointmentListResult(
            items=items, page=params.page, page_size=params.page_size, next_cursor=None
        )

    def get_appointment(self, appointment_id: str) -> Optional[Dict[str, Any]]:
        """Fetch a single appointment by ID."""

        raise NotImplementedError

    def create_appointment(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new appointment using the repository."""

        raise NotImplementedError

    def update_status(self, appointment_id: str, new_status: str) -> Dict[str, Any]:
        """Update appointment status, enforcing domain invariants."""

        raise NotImplementedError

    @staticmethod
    def _record_to_item(record: AppointmentRecord) -> AppointmentListItem:
        return AppointmentListItem(
            id=record.id,
            status=record.status,
            title=record.title,
            start_at=record.start_ts,
            end_at=record.end_ts,
            customer_name=record.customer_name,
            vehicle_label=record.vehicle_label,
            total_amount_cents=record.total_amount_cents,
        )


def _build_list_params(tenant_id: str, raw_filters: Dict[str, Any]) -> AppointmentListParams:
    page = _parse_positive_int(raw_filters.get("page", 1), "page", minimum=1)
    page_size = _parse_positive_int(raw_filters.get("pageSize", 20), "pageSize", minimum=1)
    if page_size > 100:
        page_size = 100

    status = _normalize_status(raw_filters.get("status"))
    start_from = _parse_datetime(raw_filters.get("from"))
    start_to = _parse_datetime(raw_filters.get("to"))
    customer_id = _parse_optional_int(raw_filters.get("customerId"), "customerId")

    return AppointmentListParams(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        status=status,
        start_from=start_from,
        start_to=start_to,
        customer_id=customer_id,
    )


def _parse_positive_int(value: Any, label: str, minimum: int) -> int:
    try:
        integer = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{label} must be an integer")
    if integer < minimum:
        raise ValueError(f"{label} must be >= {minimum}")
    return integer


def _parse_optional_int(value: Any, label: str) -> Optional[int]:
    if value in (None, "", "null"):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{label} must be an integer")


def _normalize_status(value: Any) -> Optional[str]:
    if value in (None, "", "null"):
        return None
    norm = str(value).strip().upper().replace("-", "_").replace(" ", "_")
    if norm not in ALLOWED_STATUSES:
        raise ValueError("status is invalid")
    return norm


def _parse_datetime(value: Any) -> Optional[datetime]:
    if value in (None, "", "null"):
        return None
    raw = str(value).strip()
    try:
        if len(raw) == 10 and raw.count("-") == 2:
            raw = f"{raw}T00:00:00+00:00"
        raw = raw.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(raw)
        return _ensure_utc(parsed)
    except Exception as exc:
        raise ValueError("date filters must be ISO-8601") from exc


def _ensure_utc(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
