"""
Native Lambda function handler
Bypasses Lambda Web Adapter to avoid communication issues
"""

import json
import logging
import os
import uuid
from typing import Any, Dict
from urllib.parse import unquote

from backend.domain.appointments.service import AppointmentService
from backend.infra.lazy_db import get_db_manager

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


# Correlation ID for request tracking
def get_correlation_id() -> str:
    return str(uuid.uuid4())[:8]


def get_app_version() -> str:
    return os.getenv("GIT_SHA", os.getenv("APP_VERSION", "unknown"))


# HTTP envelope for consistent responses
def make_response(
    status_code: int, data: Any = None, error: str = None, correlation_id: str = None
) -> Dict[str, Any]:
    """Create standardized HTTP response envelope"""
    headers = {"Content-Type": "application/json", "X-App-Version": get_app_version()}
    if correlation_id:
        headers["X-Correlation-Id"] = correlation_id

    body = {"ok": status_code < 400}
    if data is not None:
        body["data"] = data
    if error:
        body["error"] = error

    return {"statusCode": status_code, "headers": headers, "body": json.dumps(body, default=str)}


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Native Lambda handler for Function URL events

    Args:
        event: Lambda event (Function URL format)
        context: Lambda context object

    Returns:
        HTTP response in Function URL format
    """
    correlation_id = get_correlation_id()

    try:
        # Log the event for debugging
        logger.info(f"[{correlation_id}] Lambda event: {json.dumps(event, default=str)}")

        # Extract HTTP method and path
        http_method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
        raw_path = event.get("rawPath", "/")

        # Normalize path - remove duplicate slashes and ensure it starts with /
        path = "/" + "/".join(part for part in raw_path.split("/") if part)
        if raw_path == "/":  # Special case for root
            path = "/"

        query_params = event.get("queryStringParameters") or {}

        logger.info(f"[{correlation_id}] Processing {http_method} {path} (raw: {raw_path})")

        # Route the request
        return route_request(http_method, path, query_params, event, correlation_id)

    except Exception as e:
        logger.error(f"[{correlation_id}] Lambda handler error: {e}", exc_info=True)
        return make_response(500, error=str(e), correlation_id=correlation_id)


def route_request(
    method: str, path: str, query_params: Dict[str, str], event: Dict[str, Any], correlation_id: str
) -> Dict[str, Any]:
    """Route HTTP requests to appropriate handlers"""

    # Health check
    if path == "/healthz" and method == "GET":
        return handle_health_check(correlation_id)

    # Root endpoint
    elif path == "/" and method == "GET":
        return handle_root(correlation_id)

    # Test DB connection endpoint
    elif path == "/api/test/db" and method == "GET":
        return handle_test_db(correlation_id)

    # Initialize database schema (admin endpoint)
    elif path == "/api/admin/init-db" and method == "POST":
        return handle_init_db(correlation_id)

    # Debug SQL endpoint
    elif path == "/debug/sql" and method == "POST":
        body = event.get("body", "{}")
        return handle_debug_sql(body, correlation_id)

    # Admin API routes - Customers
    elif path == "/api/admin/customers" and method == "GET":
        return handle_list_customers(query_params, correlation_id)

    elif path == "/api/admin/customers" and method == "POST":
        body = event.get("body", "{}")
        return handle_create_customer(body, correlation_id)

    elif path.startswith("/api/admin/customers/") and method == "GET":
        # Extract customer ID and check for sub-resource
        path_parts = path.split("/")
        if len(path_parts) >= 5:  # /api/admin/customers/{id}/...
            customer_id = path_parts[4]
            if len(path_parts) == 5:  # /api/admin/customers/{id}
                return handle_get_customer(customer_id, correlation_id)
            elif (
                len(path_parts) == 6 and path_parts[5] == "vehicles"
            ):  # /api/admin/customers/{id}/vehicles
                return handle_get_customer_vehicles(customer_id, correlation_id)

    elif path.startswith("/api/admin/customers/") and method == "PATCH":
        # Extract customer ID from path: /api/admin/customers/{id}
        path_parts = path.split("/")
        if len(path_parts) >= 5:
            customer_id = path_parts[4]
            body = event.get("body", "{}")
            return handle_patch_customer(customer_id, body, correlation_id)

    # Vehicle API routes
    elif path == "/api/admin/vehicles" and method == "GET":
        return handle_list_vehicles(query_params, correlation_id)

    elif path == "/api/admin/vehicles" and method == "POST":
        body = event.get("body", "{}")
        return handle_create_vehicle(body, correlation_id)

    elif path.startswith("/api/admin/vehicles/") and method == "GET":
        # Extract vehicle ID from path: /api/admin/vehicles/{id}
        path_parts = path.split("/")
        if len(path_parts) >= 5:
            vehicle_id = path_parts[4]
            return handle_get_vehicle(vehicle_id, correlation_id)

    elif path.startswith("/api/admin/vehicles/") and method == "PATCH":
        # Extract vehicle ID from path: /api/admin/vehicles/{id}
        path_parts = path.split("/")
        if len(path_parts) >= 5:
            vehicle_id = path_parts[4]
            body = event.get("body", "{}")
            return handle_patch_vehicle(vehicle_id, body, correlation_id)

    # Service API routes
    elif path == "/api/admin/services" and method == "GET":
        return handle_list_services(query_params, correlation_id)

    elif path == "/api/admin/services" and method == "POST":
        body = event.get("body", "{}")
        return handle_create_service(body, correlation_id)

    elif path.startswith("/api/admin/services/") and method == "GET":
        # Extract service ID from path: /api/admin/services/{id}
        path_parts = path.split("/")
        if len(path_parts) >= 5:
            service_id = path_parts[4]
            return handle_get_service(service_id, correlation_id)

    elif path.startswith("/api/admin/services/") and method == "PATCH":
        # Extract service ID from path: /api/admin/services/{id}
        path_parts = path.split("/")
        if len(path_parts) >= 5:
            service_id = path_parts[4]
            body = event.get("body", "{}")
            return handle_patch_service(service_id, body, correlation_id)

    # Status Board API routes
    elif path == "/api/admin/appointments/board" and method == "GET":
        return handle_get_board(query_params, correlation_id)

    elif (
        path.startswith("/api/admin/appointments/") and path.endswith("/move") and method == "POST"
    ):
        # Extract appointment ID from path: /api/admin/appointments/{id}/move
        path_parts = path.split("/")
        if len(path_parts) >= 5:
            appointment_id = path_parts[4]
            body = event.get("body", "{}")
            return handle_move_appointment(appointment_id, body, correlation_id)

    elif path == "/api/admin/dashboard/stats" and method == "GET":
        return handle_dashboard_stats(query_params, correlation_id)

    # Appointment API routes
    elif path == "/api/admin/appointments" and method == "GET":
        return handle_list_appointments(query_params, correlation_id)

    elif path == "/api/admin/appointments" and method == "POST":
        body = event.get("body", "{}")
        return handle_create_appointment(body, correlation_id)

    elif path.startswith("/api/admin/appointments/") and method == "GET":
        # Extract appointment ID from path: /api/admin/appointments/{id}
        path_parts = path.split("/")
        if len(path_parts) >= 5:
            appointment_id = path_parts[4]
            return handle_get_appointment(appointment_id, correlation_id)

    elif path.startswith("/api/admin/appointments/") and method == "PATCH":
        # Extract appointment ID from path: /api/admin/appointments/{id}
        path_parts = path.split("/")
        if len(path_parts) >= 5:
            appointment_id = path_parts[4]
            body = event.get("body", "{}")
            return handle_patch_appointment(appointment_id, body, correlation_id)

    return handle_not_found(path, correlation_id)


def handle_health_check(correlation_id: str) -> Dict[str, Any]:
    """Health check endpoint"""
    data = {
        "status": "ok",
        "service": "edgar-auto-shop",
        "runtime": "native-lambda",
        "version": get_app_version(),
    }
    return make_response(200, data=data, correlation_id=correlation_id)


def handle_root(correlation_id: str) -> Dict[str, Any]:
    """Root endpoint"""
    data = {
        "message": "Edgar's Mobile Auto Shop API",
        "status": "running",
        "runtime": "native-lambda",
        "health_endpoint": "/healthz",
        "api_endpoints": [
            "GET /api/test/db",
            "GET /api/admin/customers",
            "POST /api/admin/customers",
            "GET /api/admin/customers/{id}",
            "PATCH /api/admin/customers/{id}",
            "GET /api/admin/customers/{id}/vehicles",
        ],
        "version": get_app_version(),
    }
    return make_response(200, data=data, correlation_id=correlation_id)


# Service layer setup
def get_customer_service():
    """Get customer service with lazy DB initialization"""
    from backend.domain.customers.repository import SqlCustomerRepository
    from backend.domain.customers.service import CustomerService
    from backend.infra.lazy_db import get_db_manager

    db_manager = get_db_manager()
    repository = SqlCustomerRepository(db_manager)
    return CustomerService(repository)


def get_vehicle_service():
    """Get vehicle service with lazy DB initialization"""
    from backend.domain.vehicles.repository import SqlVehicleRepository
    from backend.domain.vehicles.service import VehicleService
    from backend.infra.lazy_db import get_db_manager

    db_manager = get_db_manager()
    repository = SqlVehicleRepository(db_manager)
    return VehicleService(repository)


def get_service_service():
    """Get service service with lazy DB initialization"""
    from backend.domain.services.service import ServiceService
    from backend.infra.lazy_db import get_db_manager

    db_manager = get_db_manager()
    return ServiceService(db_manager)


def get_appointment_service():
    """Get appointment service with lazy DB initialization"""
    from backend.domain.appointments.service import AppointmentService
    from backend.infra.lazy_db import get_db_manager

    db_manager = get_db_manager()
    return AppointmentService(db_manager)


def handle_list_customers(query_params: Dict[str, str], correlation_id: str) -> Dict[str, Any]:
    """List customers with pagination and search"""
    try:
        # Parse query parameters - use the schema structure
        from backend.domain.customers.repository import ListQuery

        page = int(query_params.get("page", "1"))
        page_size = min(int(query_params.get("pageSize", "25")), 200)  # Cap at 200
        search = query_params.get("search", "").strip() or None

        logger.info(
            f"[{correlation_id}] Listing customers: page={page}, page_size={page_size}, search={search}"
        )

        # Create query object
        list_query = ListQuery(page=page, page_size=page_size, search=search)

        # Call service layer
        service = get_customer_service()
        result = service.list(list_query)

        return make_response(200, data=result, correlation_id=correlation_id)

    except (ValueError, TypeError) as e:
        logger.error(f"[{correlation_id}] Invalid query parameters: {e}")
        return make_response(
            400, error=f"Invalid query parameters: {e}", correlation_id=correlation_id
        )
    except Exception as e:
        logger.error(f"[{correlation_id}] Error listing customers: {e}", exc_info=True)
        return make_response(500, error="Internal server error", correlation_id=correlation_id)


def handle_test_db(correlation_id: str) -> Dict[str, Any]:
    """Test database connection and lazy initialization"""
    try:
        import time

        from backend.infra.lazy_db import USE_PG8000, get_db_manager

        logger.info(f"[{correlation_id}] Testing database connection...")
        start_time = time.time()

        db = get_db_manager()

        # Test query - verify database connection
        result = db.query("SELECT current_database(), version()")
        db_info = result[0] if result else {}

        # Test query - list available tables
        tables_result = db.query(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
            LIMIT 10
        """
        )

        available_tables = [row["table_name"] for row in tables_result]

        init_time = time.time() - start_time

        data = {
            "database_status": "connected",
            "database_name": db_info.get("current_database", "unknown"),
            "postgres_version": (
                db_info.get("version", "unknown")[:50] + "..."
                if db_info.get("version")
                else "unknown"
            ),
            "available_tables": available_tables,
            "initialization_time_ms": round(init_time * 1000, 2),
            "secrets_manager": os.getenv("SECRETS_MANAGER_NAME", "not_set"),
            "driver": "pg8000" if USE_PG8000 else "psycopg2",
        }

        logger.info(f"[{correlation_id}] DB test completed in {init_time:.3f}s")
        return make_response(200, data=data, correlation_id=correlation_id)

    except Exception as e:
        logger.error(f"[{correlation_id}] Database test failed: {e}", exc_info=True)
        error_data = {
            "database_status": "error",
            "error_type": type(e).__name__,
            "secrets_manager": os.getenv("SECRETS_MANAGER_NAME", "not_set"),
        }
        return make_response(500, data=error_data, error=str(e), correlation_id=correlation_id)


def handle_create_customer(body: str, correlation_id: str) -> Dict[str, Any]:
    """Create new customer"""
    try:
        import json

        from backend.api.v1.admin.customers.schemas import CustomerIn, CustomerOut

        logger.info(f"[{correlation_id}] Creating customer")

        # Parse and validate input
        if not body:
            return make_response(
                400, error="Request body is required", correlation_id=correlation_id
            )

        data = json.loads(body)
        customer_input = CustomerIn.model_validate(data)

        # Call service layer
        service = get_customer_service()
        customer = service.create(customer_input.model_dump())

        # Return with proper schema
        customer_output = CustomerOut(**customer)
        return make_response(201, data=customer_output.model_dump(), correlation_id=correlation_id)

    except json.JSONDecodeError as e:
        logger.error(f"[{correlation_id}] Invalid JSON: {e}")
        return make_response(
            400, error="Invalid JSON in request body", correlation_id=correlation_id
        )
    except Exception as e:
        logger.error(f"[{correlation_id}] Error creating customer: {e}", exc_info=True)
        return make_response(500, error="Internal server error", correlation_id=correlation_id)


def handle_get_customer(customer_id: str, correlation_id: str) -> Dict[str, Any]:
    """Get customer by ID"""
    try:
        # Validate customer_id format
        customer_id = unquote(customer_id).strip()
        if not customer_id:
            return make_response(
                400, error="Customer ID is required", correlation_id=correlation_id
            )

        logger.info(f"[{correlation_id}] Getting customer: {customer_id}")

        # Call service layer
        service = get_customer_service()
        customer = service.get(customer_id)

        if not customer:
            return make_response(404, error="Customer not found", correlation_id=correlation_id)

        # Return with proper schema
        from backend.api.v1.admin.customers.schemas import CustomerOut

        customer_output = CustomerOut(**customer)
        return make_response(200, data=customer_output.model_dump(), correlation_id=correlation_id)

    except Exception as e:
        logger.error(f"[{correlation_id}] Error getting customer {customer_id}: {e}", exc_info=True)
        return make_response(500, error="Internal server error", correlation_id=correlation_id)


def handle_patch_customer(customer_id: str, body: str, correlation_id: str) -> Dict[str, Any]:
    """Update customer"""
    try:
        import json

        from backend.api.v1.admin.customers.schemas import CustomerOut

        # Validate customer_id format
        customer_id = unquote(customer_id).strip()
        if not customer_id:
            return make_response(
                400, error="Customer ID is required", correlation_id=correlation_id
            )

        logger.info(f"[{correlation_id}] Updating customer: {customer_id}")

        # Parse input
        if not body:
            return make_response(
                400, error="Request body is required", correlation_id=correlation_id
            )

        data = json.loads(body)

        # Call service layer
        service = get_customer_service()
        customer = service.patch(customer_id, data)

        if not customer:
            return make_response(404, error="Customer not found", correlation_id=correlation_id)

        # Return with proper schema
        customer_output = CustomerOut(**customer)
        return make_response(200, data=customer_output.model_dump(), correlation_id=correlation_id)

    except json.JSONDecodeError as e:
        logger.error(f"[{correlation_id}] Invalid JSON: {e}")
        return make_response(
            400, error="Invalid JSON in request body", correlation_id=correlation_id
        )
    except Exception as e:
        logger.error(
            f"[{correlation_id}] Error updating customer {customer_id}: {e}", exc_info=True
        )
        return make_response(500, error="Internal server error", correlation_id=correlation_id)


def handle_get_customer_vehicles(customer_id: str, correlation_id: str) -> Dict[str, Any]:
    """Get vehicles for customer"""
    try:
        # Validate customer_id format
        customer_id = unquote(customer_id).strip()
        if not customer_id:
            return make_response(
                400, error="Customer ID is required", correlation_id=correlation_id
            )

        logger.info(f"[{correlation_id}] Getting vehicles for customer: {customer_id}")

        # Call service layer
        service = get_customer_service()
        vehicles = service.vehicles(customer_id)

        return make_response(200, data={"vehicles": vehicles}, correlation_id=correlation_id)

    except Exception as e:
        logger.error(
            f"[{correlation_id}] Error getting vehicles for customer {customer_id}: {e}",
            exc_info=True,
        )
        return make_response(500, error="Internal server error", correlation_id=correlation_id)


# Vehicle handlers
def handle_list_vehicles(query_params: Dict[str, str], correlation_id: str) -> Dict[str, Any]:
    """List vehicles with optional filters"""
    try:
        from backend.api.v1.admin.vehicles.schemas import ListQuery

        logger.info(f"[{correlation_id}] Listing vehicles with filters: {query_params}")

        # Parse query parameters with defaults
        query = ListQuery(
            page=int(query_params.get("page", "1")),
            page_size=int(query_params.get("page_size", "20")),
            customer_id=query_params.get("customer_id"),
            vin=query_params.get("vin"),
            make=query_params.get("make"),
            model=query_params.get("model"),
            year=query_params.get("year"),
        )

        # Call service layer
        service = get_vehicle_service()
        result = service.list(query)

        return make_response(200, data=result, correlation_id=correlation_id)

    except Exception as e:
        logger.error(f"[{correlation_id}] Error listing vehicles: {e}", exc_info=True)
        return make_response(500, error="Internal server error", correlation_id=correlation_id)


def handle_create_vehicle(body: str, correlation_id: str) -> Dict[str, Any]:
    """Create new vehicle"""
    try:
        from backend.api.v1.admin.vehicles.schemas import VehicleIn

        # Parse request body
        data = json.loads(body)
        logger.info(f"[{correlation_id}] Creating vehicle: {data}")

        # Validate input schema
        vehicle_data = VehicleIn(**data)

        # Call service layer
        service = get_vehicle_service()
        result = service.create(vehicle_data.dict())

        return make_response(201, data=result, correlation_id=correlation_id)

    except json.JSONDecodeError:
        return make_response(
            400, error="Invalid JSON in request body", correlation_id=correlation_id
        )
    except ValueError as e:
        return make_response(
            400, error=f"Validation error: {str(e)}", correlation_id=correlation_id
        )
    except Exception as e:
        logger.error(f"[{correlation_id}] Error creating vehicle: {e}", exc_info=True)
        return make_response(500, error="Internal server error", correlation_id=correlation_id)


def handle_get_vehicle(vehicle_id: str, correlation_id: str) -> Dict[str, Any]:
    """Get vehicle by ID"""
    try:
        # Validate vehicle_id format
        vehicle_id = unquote(vehicle_id).strip()
        if not vehicle_id:
            return make_response(400, error="Vehicle ID is required", correlation_id=correlation_id)

        logger.info(f"[{correlation_id}] Getting vehicle: {vehicle_id}")

        # Call service layer
        service = get_vehicle_service()
        result = service.get(vehicle_id)

        if not result:
            return make_response(
                404, error=f"Vehicle {vehicle_id} not found", correlation_id=correlation_id
            )

        return make_response(200, data=result, correlation_id=correlation_id)

    except Exception as e:
        # Check if it's a not found error from the service layer
        if "not found" in str(e).lower():
            return make_response(
                404, error=f"Vehicle {vehicle_id} not found", correlation_id=correlation_id
            )

        logger.error(f"[{correlation_id}] Error getting vehicle {vehicle_id}: {e}", exc_info=True)
        return make_response(500, error="Internal server error", correlation_id=correlation_id)


def handle_patch_vehicle(vehicle_id: str, body: str, correlation_id: str) -> Dict[str, Any]:
    """Patch vehicle by ID"""
    try:
        # Validate vehicle_id format
        vehicle_id = unquote(vehicle_id).strip()
        if not vehicle_id:
            return make_response(400, error="Vehicle ID is required", correlation_id=correlation_id)

        # Parse request body
        try:
            patch_data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            return make_response(
                400, error="Invalid JSON in request body", correlation_id=correlation_id
            )

        logger.info(f"[{correlation_id}] Patching vehicle {vehicle_id}: {patch_data}")

        # Call service layer
        service = get_vehicle_service()
        result = service.patch(vehicle_id, patch_data)

        if not result:
            return make_response(
                404, error=f"Vehicle {vehicle_id} not found", correlation_id=correlation_id
            )

        return make_response(200, data=result, correlation_id=correlation_id)

    except Exception as e:
        # Check if it's a not found error from the service layer
        if "not found" in str(e).lower():
            return make_response(
                404, error=f"Vehicle {vehicle_id} not found", correlation_id=correlation_id
            )

        logger.error(f"[{correlation_id}] Error patching vehicle {vehicle_id}: {e}", exc_info=True)
        return make_response(500, error="Internal server error", correlation_id=correlation_id)


def handle_not_found(path: str, correlation_id: str) -> Dict[str, Any]:
    """404 handler"""
    available_paths = [
        "GET /",
        "GET /healthz",
        "GET /api/test/db",
        "GET /api/admin/customers",
        "POST /api/admin/customers",
        "GET /api/admin/customers/{id}",
        "PATCH /api/admin/customers/{id}",
        "GET /api/admin/customers/{id}/vehicles",
        "GET /api/admin/vehicles",
        "POST /api/admin/vehicles",
        "GET /api/admin/vehicles/{id}",
        "PATCH /api/admin/vehicles/{id}",
        "GET /api/admin/services",
        "POST /api/admin/services",
        "GET /api/admin/services/{id}",
        "PATCH /api/admin/services/{id}",
        "GET /api/admin/appointments",
        "POST /api/admin/appointments",
        "GET /api/admin/appointments/{id}",
        "PATCH /api/admin/appointments/{id}",
    ]
    error_msg = f"Path not found: {path}"
    data = {"available_paths": available_paths}
    return make_response(404, data=data, error=error_msg, correlation_id=correlation_id)


def handle_debug_sql(body: str, correlation_id: str) -> Dict[str, Any]:
    """Debug SQL execution"""
    try:
        data = json.loads(body)
        query = data.get("query", "")

        logger.info(f"[{correlation_id}] Executing debug SQL: {query[:100]}...")

        db_manager = get_db_manager()
        result = db_manager.query(query)

        return make_response(200, {"query": query, "result": result}, correlation_id=correlation_id)

    except Exception as e:
        logger.error(f"[{correlation_id}] Error in debug SQL: {e}", exc_info=True)
        return make_response(500, error=str(e), correlation_id=correlation_id)


# ===== SERVICE HANDLERS =====


def handle_list_services(query_params: Dict[str, str], correlation_id: str) -> Dict[str, Any]:
    """List services with pagination and filtering"""
    try:
        # Parse query parameters
        page = int(query_params.get("page", "1"))
        page_size = min(int(query_params.get("page_size", "50")), 100)  # Max 100
        search = query_params.get("search")
        is_active = query_params.get("is_active")

        # Convert string to boolean for is_active
        if is_active is not None:
            is_active = is_active.lower() in ["true", "1", "yes"]

        logger.info(
            f"[{correlation_id}] Listing services: page={page}, page_size={page_size}, search={search}, is_active={is_active}"
        )

        # Call service layer
        service = get_service_service()
        result = service.list_services(
            page=page, page_size=page_size, search=search, is_active=is_active
        )

        return make_response(200, data=result, correlation_id=correlation_id)

    except Exception as e:
        logger.error(f"[{correlation_id}] Error listing services: {e}", exc_info=True)
        return make_response(500, error="Internal server error", correlation_id=correlation_id)


def handle_create_service(body: str, correlation_id: str) -> Dict[str, Any]:
    """Create new service"""
    try:
        # Parse and validate request body
        try:
            service_data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            return make_response(
                400, error="Invalid JSON in request body", correlation_id=correlation_id
            )

        # Validate using Pydantic schema
        from backend.api.v1.admin.services.schemas import ServiceCreate

        try:
            validated_data = ServiceCreate(**service_data)
        except ValueError as e:
            return make_response(400, error=f"Validation error: {e}", correlation_id=correlation_id)

        logger.info(f"[{correlation_id}] Creating service: {validated_data.dict()}")

        # Call service layer
        service = get_service_service()
        result = service.create_service(validated_data.dict())

        return make_response(201, data=result, correlation_id=correlation_id)

    except ValueError as e:
        # Business logic errors (e.g., duplicate code)
        return make_response(400, error=str(e), correlation_id=correlation_id)
    except Exception as e:
        logger.error(f"[{correlation_id}] Error creating service: {e}", exc_info=True)
        return make_response(500, error="Internal server error", correlation_id=correlation_id)


def handle_get_service(service_id: str, correlation_id: str) -> Dict[str, Any]:
    """Get service by ID"""
    try:
        logger.info(f"[{correlation_id}] Getting service {service_id}")

        # Call service layer
        service = get_service_service()
        result = service.get_service(service_id)

        if not result:
            return make_response(
                404, error=f"Service {service_id} not found", correlation_id=correlation_id
            )

        return make_response(200, data=result, correlation_id=correlation_id)

    except Exception as e:
        logger.error(f"[{correlation_id}] Error getting service {service_id}: {e}", exc_info=True)
        return make_response(500, error="Internal server error", correlation_id=correlation_id)


def handle_patch_service(service_id: str, body: str, correlation_id: str) -> Dict[str, Any]:
    """Update service"""
    try:
        # Parse request body
        try:
            patch_data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            return make_response(
                400, error="Invalid JSON in request body", correlation_id=correlation_id
            )

        # Validate using Pydantic schema
        from backend.api.v1.admin.services.schemas import ServicePatch

        try:
            validated_data = ServicePatch(**patch_data)
            # Only include non-None fields
            patch_dict = {k: v for k, v in validated_data.dict().items() if v is not None}
        except ValueError as e:
            return make_response(400, error=f"Validation error: {e}", correlation_id=correlation_id)

        logger.info(f"[{correlation_id}] Patching service {service_id}: {patch_dict}")

        # Call service layer
        service = get_service_service()
        result = service.update_service(service_id, patch_dict)

        if not result:
            return make_response(
                404, error=f"Service {service_id} not found", correlation_id=correlation_id
            )

        return make_response(200, data=result, correlation_id=correlation_id)

    except ValueError as e:
        # Business logic errors (e.g., duplicate code)
        return make_response(400, error=str(e), correlation_id=correlation_id)
    except Exception as e:
        logger.error(f"[{correlation_id}] Error patching service {service_id}: {e}", exc_info=True)
        return make_response(500, error="Internal server error", correlation_id=correlation_id)


# ===== APPOINTMENT HANDLERS =====


def handle_list_appointments(query_params: Dict[str, str], correlation_id: str) -> Dict[str, Any]:
    """List appointments with pagination and filtering"""
    try:
        # Parse query parameters
        page = int(query_params.get("page", "1"))
        page_size = min(int(query_params.get("page_size", "50")), 100)  # Max 100
        customer_id = query_params.get("customer_id")
        vehicle_id = query_params.get("vehicle_id")
        status = query_params.get("status")
        from_date = query_params.get("from_date")
        to_date = query_params.get("to_date")

        logger.info(f"[{correlation_id}] Listing appointments: page={page}, filters={query_params}")

        # Call service layer
        service = get_appointment_service()
        result = service.list_appointments(
            page=page,
            page_size=page_size,
            customer_id=customer_id,
            vehicle_id=vehicle_id,
            status=status,
            from_date=from_date,
            to_date=to_date,
        )

        return make_response(200, data=result, correlation_id=correlation_id)

    except Exception as e:
        logger.error(f"[{correlation_id}] Error listing appointments: {e}", exc_info=True)
        return make_response(500, error="Internal server error", correlation_id=correlation_id)


def handle_create_appointment(body: str, correlation_id: str) -> Dict[str, Any]:
    """Create new appointment"""
    try:
        # Parse and validate request body
        try:
            appointment_data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            return make_response(
                400, error="Invalid JSON in request body", correlation_id=correlation_id
            )

        # Validate using Pydantic schema
        from backend.api.v1.admin.appointments.schemas import AppointmentCreate

        try:
            validated_data = AppointmentCreate(**appointment_data)
        except ValueError as e:
            return make_response(400, error=f"Validation error: {e}", correlation_id=correlation_id)

        logger.info(f"[{correlation_id}] Creating appointment: {validated_data.dict()}")

        # Call service layer
        service = get_appointment_service()
        result = service.create_appointment(validated_data.dict())

        return make_response(201, data=result, correlation_id=correlation_id)

    except ValueError as e:
        # Business logic errors (e.g., invalid times, missing services)
        return make_response(400, error=str(e), correlation_id=correlation_id)
    except Exception as e:
        logger.error(f"[{correlation_id}] Error creating appointment: {e}", exc_info=True)
        return make_response(500, error="Internal server error", correlation_id=correlation_id)


def handle_get_appointment(appointment_id: str, correlation_id: str) -> Dict[str, Any]:
    """Get appointment by ID"""
    try:
        logger.info(f"[{correlation_id}] Getting appointment {appointment_id}")

        # Call service layer
        service = get_appointment_service()
        result = service.get_appointment(appointment_id)

        if not result:
            return make_response(
                404, error=f"Appointment {appointment_id} not found", correlation_id=correlation_id
            )

        return make_response(200, data=result, correlation_id=correlation_id)

    except Exception as e:
        logger.error(
            f"[{correlation_id}] Error getting appointment {appointment_id}: {e}", exc_info=True
        )
        return make_response(500, error="Internal server error", correlation_id=correlation_id)


def handle_patch_appointment(appointment_id: str, body: str, correlation_id: str) -> Dict[str, Any]:
    """Update appointment"""
    try:
        # Parse request body
        try:
            patch_data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            return make_response(
                400, error="Invalid JSON in request body", correlation_id=correlation_id
            )

        # Validate using Pydantic schema
        from backend.api.v1.admin.appointments.schemas import AppointmentPatch

        try:
            validated_data = AppointmentPatch(**patch_data)
            # Only include non-None fields
            patch_dict = {k: v for k, v in validated_data.dict().items() if v is not None}
        except ValueError as e:
            return make_response(400, error=f"Validation error: {e}", correlation_id=correlation_id)

        logger.info(f"[{correlation_id}] Patching appointment {appointment_id}: {patch_dict}")

        # Call service layer
        service = get_appointment_service()
        result = service.update_appointment(appointment_id, patch_dict)

        if not result:
            return make_response(
                404, error=f"Appointment {appointment_id} not found", correlation_id=correlation_id
            )

        return make_response(200, data=result, correlation_id=correlation_id)

    except ValueError as e:
        # Business logic errors (e.g., invalid status transitions)
        return make_response(400, error=str(e), correlation_id=correlation_id)
    except Exception as e:
        logger.error(
            f"[{correlation_id}] Error patching appointment {appointment_id}: {e}", exc_info=True
        )
        return make_response(500, error="Internal server error", correlation_id=correlation_id)


def handle_get_board(query_params: Dict[str, str], correlation_id: str) -> Dict[str, Any]:
    """Get status board for appointments on a specific date"""
    try:
        logger.info(f"[{correlation_id}] Getting status board")

        # Get target date from query params (default to today)
        from datetime import datetime

        target_date = query_params.get("date", datetime.now().strftime("%Y-%m-%d"))

        # Get database manager and create service
        db = get_db_manager()
        service = AppointmentService(db)

        # Get board data
        board_result = service.get_board(target_date)

        # Format response to match API spec
        columns = {}
        for status, appointments in board_result["board"].items():
            columns[status] = {"items": appointments}

        # Format stats to match API spec
        stats = {
            "jobsToday": board_result["stats"]["total_appointments"],
            "onPrem": board_result["stats"]["in_progress"] + board_result["stats"]["ready"],
            "statusCounts": {
                "scheduled": board_result["stats"]["scheduled"],
                "in_progress": board_result["stats"]["in_progress"],
                "ready": board_result["stats"]["ready"],
                "completed": board_result["stats"]["completed"],
                "no_show": board_result["stats"]["no_show"],
            },
        }

        result = {"date": target_date, "columns": columns, "stats": stats}

        logger.info(
            f"[{correlation_id}] Status board retrieved successfully for date: {target_date}"
        )
        return make_response(200, data=result, correlation_id=correlation_id)

    except Exception as e:
        logger.error(f"[{correlation_id}] Error getting status board: {e}", exc_info=True)
        return make_response(500, error="Internal server error", correlation_id=correlation_id)


def handle_move_appointment(appointment_id: str, body: str, correlation_id: str) -> Dict[str, Any]:
    """Move appointment to new status/position with optimistic concurrency"""
    try:
        logger.info(f"[{correlation_id}] Moving appointment {appointment_id}")

        # Parse request body
        data = json.loads(body) if body else {}

        # Extract required fields
        new_status = data.get("new_status")
        new_position = data.get("new_position", 0)
        current_version = data.get("expected_version")

        if not new_status:
            return make_response(400, error="new_status is required", correlation_id=correlation_id)

        if current_version is None:
            return make_response(
                400,
                error="expected_version is required for optimistic concurrency",
                correlation_id=correlation_id,
            )

        # Get database manager and create service
        db = get_db_manager()
        service = AppointmentService(db)

        # Extract additional optional fields
        kwargs = {}
        for field in ["check_in_at", "check_out_at", "tech_id", "total_amount", "paid_amount"]:
            if field in data:
                kwargs[field] = data[field]

        # Move appointment
        result = service.move_appointment(
            appointment_id=appointment_id,
            new_status=new_status,
            new_position=new_position,
            current_version=current_version,
            **kwargs,
        )

        logger.info(f"[{correlation_id}] Appointment {appointment_id} moved successfully")
        # Return simplified response format as per API spec
        move_result = {
            "id": str(result["id"]),
            "status": result["status"],
            "position": result["position"],
            "version": result["version"],
        }
        return make_response(200, data=move_result, correlation_id=correlation_id)

    except Exception as e:
        # Import the exception classes first
        from backend.domain.appointments.service import InvalidTransition, VersionConflict

        if isinstance(e, VersionConflict):
            return make_response(409, error=str(e), correlation_id=correlation_id)
        elif isinstance(e, InvalidTransition):
            return make_response(422, error=str(e), correlation_id=correlation_id)
        elif isinstance(e, ValueError):
            # Other business logic errors
            return make_response(400, error=str(e), correlation_id=correlation_id)
    except json.JSONDecodeError:
        return make_response(
            400, error="Invalid JSON in request body", correlation_id=correlation_id
        )
    except Exception as e:
        logger.error(
            f"[{correlation_id}] Error moving appointment {appointment_id}: {e}", exc_info=True
        )
        return make_response(500, error="Internal server error", correlation_id=correlation_id)


def handle_dashboard_stats(query_params: Dict[str, str], correlation_id: str) -> Dict[str, Any]:
    """Get dashboard statistics for a specific date"""
    try:
        logger.info(f"[{correlation_id}] Getting dashboard stats")

        # Get target date from query params (default to today)
        from datetime import datetime

        target_date = query_params.get("date", datetime.now().strftime("%Y-%m-%d"))

        # Get database manager and create service
        db = get_db_manager()
        service = AppointmentService(db)

        # Get dashboard stats
        result = service.get_dashboard_stats(target_date)

        logger.info(
            f"[{correlation_id}] Dashboard stats retrieved successfully for date: {target_date}"
        )
        return make_response(200, data=result, correlation_id=correlation_id)

    except Exception as e:
        logger.error(f"[{correlation_id}] Error getting dashboard stats: {e}", exc_info=True)
        return make_response(500, error="Internal server error", correlation_id=correlation_id)


def handle_init_db(correlation_id: str) -> Dict[str, Any]:
    """Initialize database schema with essential tables only"""
    try:
        logger.info(f"[{correlation_id}] Initializing database schema...")

        # Get database connection
        db = get_db_manager()

        # Drop existing tables first to ensure clean schema
        drop_statements = [
            "DROP TABLE IF EXISTS appointments CASCADE",
            "DROP TABLE IF EXISTS services CASCADE",
            "DROP TABLE IF EXISTS vehicles CASCADE",
            "DROP TABLE IF EXISTS customers CASCADE",
        ]

        # Execute drops first
        for stmt in drop_statements:
            try:
                logger.info(f"[{correlation_id}] Executing: {stmt}")
                conn = db.get_connection()
                cur = conn.cursor()
                cur.execute(stmt)
                conn.commit()
                cur.close()
                conn.close()
            except Exception as e:
                logger.warning(f"[{correlation_id}] Drop statement failed (expected): {e}")

        # Essential schema - just the core tables needed for customer operations
        essential_tables = [
            """
            CREATE TABLE customers (
              id SERIAL PRIMARY KEY,
              name VARCHAR(255) NOT NULL,
              phone VARCHAR(20),
              email VARCHAR(255),
              address_line1 VARCHAR(255),
              address_line2 VARCHAR(255),
              city VARCHAR(100),
              state VARCHAR(50),
              zip_code VARCHAR(20),
              is_vip BOOLEAN NOT NULL DEFAULT FALSE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE vehicles (
              id SERIAL PRIMARY KEY,
              customer_id INTEGER REFERENCES customers(id),
              make VARCHAR(100),
              model VARCHAR(100),
              year INTEGER,
              vin VARCHAR(32),
              trim VARCHAR(100),
              color VARCHAR(50),
              license_plate VARCHAR(20),
              mileage INTEGER,
              notes TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE services (
              id            BIGSERIAL PRIMARY KEY,
              code          TEXT UNIQUE NOT NULL,
              name          TEXT NOT NULL,
              description   TEXT,
              base_price_cents INTEGER NOT NULL DEFAULT 0,
              est_minutes   INTEGER NOT NULL DEFAULT 30,
              is_active     BOOLEAN NOT NULL DEFAULT TRUE,
              created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """,
            """
            CREATE TABLE appointments (
              id             BIGSERIAL PRIMARY KEY,
              customer_id    BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
              vehicle_id     BIGINT NOT NULL REFERENCES vehicles(id)  ON DELETE CASCADE,
              appt_start     TIMESTAMPTZ NOT NULL,
              appt_end       TIMESTAMPTZ NOT NULL,
              status         TEXT NOT NULL DEFAULT 'scheduled',
              position       INTEGER NOT NULL DEFAULT 0,
              check_in_at    TIMESTAMPTZ,
              check_out_at   TIMESTAMPTZ,
              tech_id        BIGINT,
              total_amount   DECIMAL(10,2) DEFAULT 0.00,
              paid_amount    DECIMAL(10,2) DEFAULT 0.00,
              version        INTEGER NOT NULL DEFAULT 1,
              notes          TEXT,
              created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """,
            """
            CREATE TABLE appointment_services (
              appointment_id BIGINT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
              service_id     BIGINT NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
              qty            INTEGER NOT NULL DEFAULT 1,
              price_cents    INTEGER NOT NULL,
              PRIMARY KEY (appointment_id, service_id)
            )
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_appointments_customer_start
              ON appointments(customer_id, appt_start DESC)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_appointments_status_position
              ON appointments(status, position)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_appointments_date_status
              ON appointments(DATE(appt_start), status)
            """,
        ]

        results = []
        for i, stmt in enumerate(essential_tables):
            try:
                logger.info(f"[{correlation_id}] Creating table {i+1}/{len(essential_tables)}")
                # Use raw connection for DDL statements
                conn = db.get_connection()
                with conn.cursor() as cur:
                    cur.execute(stmt.strip())
                    conn.commit()  # Ensure the DDL is committed
                results.append(f"Table {i+1}: SUCCESS")
            except Exception as e:
                error_msg = f"Table {i+1}: ERROR - {str(e)}"
                logger.error(f"[{correlation_id}] {error_msg}")
                results.append(error_msg)

        # Verify tables were created
        tables_query = """
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        """

        rows = db.query(tables_query)
        tables = [row["table_name"] if isinstance(row, dict) else row[0] for row in rows]

        logger.info(f"[{correlation_id}] Database initialization completed - tables: {tables}")

        return make_response(
            200,
            data={
                "message": "Database initialized successfully",
                "tables_created": len(tables),
                "results": results,
                "available_tables": tables,
            },
            correlation_id=correlation_id,
        )

    except Exception as e:
        logger.error(f"[{correlation_id}] Database initialization failed: {e}", exc_info=True)
        return make_response(
            500, error=f"Database initialization failed: {str(e)}", correlation_id=correlation_id
        )


# Route table for debugging and testing
route_table = {
    "GET /": "Root endpoint with API information",
    "GET /healthz": "Health check endpoint",
    "GET /api/test/db": "Test database connection and lazy initialization",
    "POST /api/admin/init-db": "Initialize database schema (admin only)",
    "GET /api/admin/customers": "List customers with pagination/search",
    "POST /api/admin/customers": "Create new customer",
    "GET /api/admin/customers/{id}": "Get customer by ID",
    "PATCH /api/admin/customers/{id}": "Update customer",
    "GET /api/admin/customers/{id}/vehicles": "Get customer vehicles",
    "GET /api/admin/appointments": "List appointments with filtering",
    "POST /api/admin/appointments": "Create new appointment",
    "GET /api/admin/appointments/{id}": "Get appointment by ID",
    "PATCH /api/admin/appointments/{id}": "Update appointment",
    "GET /api/admin/appointments/board": "Get status board for date",
    "POST /api/admin/appointments/{id}/move": "Move appointment to new status",
    "GET /api/admin/dashboard/stats": "Get dashboard statistics",
}

# Export for Lambda runtime
handler = lambda_handler
