# backend/api/v1/admin/customers/routes.py
from flask import Blueprint, jsonify, request
from flask import current_app as app

from backend.domain.customers.service import CustomerService

from .schemas import CustomerIn, CustomerOut, ListQuery

bp = Blueprint("admin_customers", __name__, url_prefix="/api/admin/customers")


def _svc() -> CustomerService:
    return app.config["deps"]["customer_service"]


@bp.route("", methods=["GET"])
def list_customers():
    """List customers with pagination and search"""
    q = ListQuery.model_validate({**request.args})
    result = _svc().list(q)
    return jsonify(result), 200


@bp.route("", methods=["POST"])
def create_customer():
    """Create new customer with idempotency support"""
    payload = CustomerIn.model_validate_json(request.data)
    customer = _svc().create(payload)
    return jsonify(CustomerOut(**customer).model_dump()), 201


@bp.route("/<customer_id>", methods=["GET"])
def get_customer(customer_id: str):
    """Get customer by ID"""
    customer = _svc().get(customer_id)
    if not customer:
        return {"error": {"code": 404, "message": "Customer not found"}}, 404
    return jsonify(CustomerOut(**customer).model_dump()), 200


@bp.route("/<customer_id>", methods=["PATCH"])
def patch_customer(customer_id: str):
    """Partial update customer"""
    payload = request.get_json(silent=True) or {}
    customer = _svc().patch(customer_id, payload)
    return jsonify(CustomerOut(**customer).model_dump()), 200


@bp.route("/<customer_id>/vehicles", methods=["GET"])
def get_customer_vehicles(customer_id: str):
    """Get vehicles for customer"""
    vehicles = _svc().vehicles(customer_id)
    return jsonify({"vehicles": vehicles}), 200
