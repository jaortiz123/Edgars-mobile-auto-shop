"""Mobile appointments API blueprint."""

from datetime import datetime, timezone
from http import HTTPStatus
from typing import Optional

from flask import Blueprint, abort, g, request

from backend.services.appointments_service import AppointmentListItem, AppointmentsService
from backend.util.response import _error, _ok

mobile_appointments_bp = Blueprint(
    "mobile_appointments",
    __name__,
    url_prefix="/api/appointments",
)


_service = AppointmentsService()


@mobile_appointments_bp.route("", methods=["GET"])
def list_mobile_appointments():
    """List appointments for the mobile app."""

    tenant_id = getattr(g, "tenant_id", None)
    if not tenant_id:
        return _error(HTTPStatus.FORBIDDEN, "missing_tenant", "Tenant context required")

    query_params = request.args.to_dict(flat=True)
    try:
        result = _service.list_mobile(tenant_id, query_params)
    except ValueError as exc:
        return _error(HTTPStatus.BAD_REQUEST, "bad_request", str(exc))

    items = [_serialize_item(item) for item in result.items]
    payload = {
        "items": items,
        "page": result.page,
        "pageSize": result.page_size,
        "nextCursor": result.next_cursor,
    }
    return _ok(payload)


@mobile_appointments_bp.route("/<appointment_id>", methods=["GET"])
def get_mobile_appointment(appointment_id: str):
    """Retrieve a single appointment by id."""

    abort(501, description="get_mobile_appointment pending implementation")


@mobile_appointments_bp.route("", methods=["POST"])
def create_mobile_appointment():
    """Create a new appointment via the mobile app."""

    abort(501, description="create_mobile_appointment pending implementation")


@mobile_appointments_bp.route("/<appointment_id>/status", methods=["PATCH"])
def update_mobile_appointment_status(appointment_id: str):
    """Patch appointment status."""

    abort(501, description="update_mobile_appointment_status pending implementation")


def _serialize_item(item: AppointmentListItem) -> dict:
    return {
        "id": item.id,
        "status": item.status,
        "title": item.title,
        "startAt": _to_iso(item.start_at),
        "endAt": _to_iso(item.end_at),
        "customerName": item.customer_name,
        "vehicleLabel": item.vehicle_label,
        "totalAmountCents": item.total_amount_cents,
    }


def _to_iso(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    iso = value.isoformat()
    if iso.endswith("+00:00"):
        iso = iso[:-6] + "Z"
    return iso
