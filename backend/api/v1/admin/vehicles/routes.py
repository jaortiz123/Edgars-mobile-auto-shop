"""
Admin Vehicles Blueprint - Vehicle Management Endpoints
Extracted from monolith with preserved response shapes and headers
"""

from flask import Blueprint, current_app, jsonify, request

from backend.domain.vehicles.errors import VehicleNotFoundError

from .schemas import ListQuery, VehicleIn

bp = Blueprint("admin_vehicles", __name__, url_prefix="/api/admin/vehicles")


@bp.route("", methods=["GET"])
def list_vehicles():
    """List vehicles with optional filters"""
    try:
        # Parse query parameters
        query = ListQuery(
            page=int(request.args.get("page", 1)),
            page_size=int(request.args.get("page_size", 20)),
            customer_id=request.args.get("customer_id"),
            vin=request.args.get("vin"),
            make=request.args.get("make"),
            model=request.args.get("model"),
            year=request.args.get("year"),
        )

        # Get service from DI
        vehicle_service = current_app.config["deps"]["vehicle_service"]

        # Delegate to service
        result = vehicle_service.list(query)

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("", methods=["POST"])
def create_vehicle():
    """Create new vehicle for customer"""
    try:
        # Validate input
        data = VehicleIn(**request.json)

        # Get service from DI
        vehicle_service = current_app.config["deps"]["vehicle_service"]

        # Delegate to service
        result = vehicle_service.create(data.dict())

        return jsonify(result), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/<vehicle_id>", methods=["GET"])
def get_vehicle(vehicle_id: str):
    """Get vehicle details by ID"""
    try:
        # Get service from DI
        vehicle_service = current_app.config["deps"]["vehicle_service"]

        # Delegate to service
        result = vehicle_service.get(vehicle_id)

        if not result:
            raise VehicleNotFoundError(f"Vehicle {vehicle_id} not found")

        return jsonify(result)

    except VehicleNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/<vehicle_id>", methods=["PATCH"])
def patch_vehicle(vehicle_id: str):
    """Partial update vehicle"""
    try:
        # Get service from DI
        vehicle_service = current_app.config["deps"]["vehicle_service"]

        # Delegate to service
        result = vehicle_service.patch(vehicle_id, request.json or {})

        if not result:
            raise VehicleNotFoundError(f"Vehicle {vehicle_id} not found")

        return jsonify(result)

    except VehicleNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/search", methods=["GET"])
def search_vehicles():
    """VIN lookup endpoint"""
    try:
        vin = request.args.get("vin")
        if not vin:
            return jsonify({"error": "vin parameter required"}), 400

        # Get service from DI
        vehicle_service = current_app.config["deps"]["vehicle_service"]

        # Delegate to service
        result = vehicle_service.search_vin(vin)

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500
