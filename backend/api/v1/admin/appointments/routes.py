# backend/api/v1/admin/appointments/routes.py
from flask import Blueprint, jsonify, request
from flask import current_app as app

from backend.domain.appointments.service import AppointmentService

from .schemas import AppointmentIn, AppointmentOut, ListQuery

bp = Blueprint("admin_appointments", __name__, url_prefix="/api/admin/appointments")


def _svc() -> AppointmentService:
    return app.config["deps"]["appointment_service"]


@bp.route("", methods=["GET"])
def list_appointments():
    q = ListQuery.model_validate({**request.args})
    result = _svc().list(q)
    # envelope handled by middleware; just return data
    return jsonify(result), 200


@bp.route("", methods=["POST"])
def create_appointment():
    payload = AppointmentIn.model_validate_json(request.data)
    appt = _svc().create(payload)
    return jsonify(AppointmentOut(**appt).model_dump()), 201


@bp.route("/<appt_id>", methods=["GET"])
def get_appointment(appt_id: str):
    appt = _svc().get(appt_id)
    if not appt:
        return {"error": {"code": 404, "message": "Not found"}}, 404
    return jsonify(AppointmentOut(**appt).model_dump()), 200


@bp.route("/<appt_id>", methods=["PUT"])
def update_appointment(appt_id: str):
    payload = AppointmentIn.model_validate_json(request.data)
    appt = _svc().update(appt_id, payload)
    return jsonify(AppointmentOut(**appt).model_dump()), 200


@bp.route("/<appt_id>/status", methods=["PATCH"])
def patch_status(appt_id: str):
    # Preserve E2E shortcut flag behavior through middleware (already extracted)
    body = request.get_json(silent=True) or {}
    appt = _svc().patch_status(appt_id, body.get("status"))
    return jsonify(AppointmentOut(**appt).model_dump()), 200
