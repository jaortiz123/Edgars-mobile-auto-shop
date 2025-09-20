"""
Flask app factory for Edgar's Mobile Auto Shop
Eliminates import order brittleness and creates clean extraction foundation
"""

from typing import Any, Dict, Optional

from flask import Flask


def create_app(config: Optional[Dict[str, Any]] = None) -> Flask:
    """
    App factory - eliminates import order chaos and creates clean bootstrap foundation

    This replaces the current monolithic import pattern with proper dependency injection
    and ordered initialization that preserves all existing middleware behavior.
    """
    app = Flask(__name__)

    # Load configuration
    if config:
        app.config.update(config)

    # Phase 1: Initialize extensions (DB, CORS, logging)
    from backend.extensions import init_extensions

    init_extensions(app)

    # Phase 2: Install middleware layers (request/response processing)
    from backend.middleware import init_middleware

    init_middleware(app)

    # Phase 3: Set up dependency injection (repository bindings)
    setup_dependency_injection(app)

    # Phase 4: Register blueprints AFTER middleware and DI are ready
    register_blueprints(app)

    return app


def setup_dependency_injection(app: Flask) -> None:
    """
    Set up dependency injection for repositories

    Binds concrete repository implementations to interfaces, enabling
    clean extraction of services without tight coupling to database code.
    """

    from backend.domain.appointments.repository import SqlAppointmentRepository
    from backend.domain.appointments.service import AppointmentService
    from backend.infra.repositories import (
        PostgresAppointmentRepository,
        PostgresCustomerRepository,
    )

    db = app.db
    app.repositories = {
        "customer": PostgresCustomerRepository(db),
        "appointment": PostgresAppointmentRepository(db),
    }

    # Wire services
    appointment_repo = SqlAppointmentRepository(db)
    appointment_service = AppointmentService(appointment_repo)

    from backend.domain.customers.repository import SqlCustomerRepository
    from backend.domain.customers.service import CustomerService

    customer_repo = SqlCustomerRepository(db)
    customer_service = CustomerService(customer_repo)

    from backend.domain.vehicles.repository import SqlVehicleRepository
    from backend.domain.vehicles.service import VehicleService

    vehicle_repo = SqlVehicleRepository(db)
    vehicle_service = VehicleService(vehicle_repo)

    from backend.domain.invoices.repository import SqlInvoiceRepository
    from backend.domain.invoices.service import InvoiceService

    invoice_repo = SqlInvoiceRepository(db)
    invoice_service = InvoiceService(invoice_repo)

    app.config["deps"] = {
        "appointment_service": appointment_service,
        "customer_service": customer_service,
        "vehicle_service": vehicle_service,
        "invoice_service": invoice_service,
    }


def register_blueprints(app: Flask) -> None:
    """
    Register all blueprints

    For now, import the entire monolith to preserve existing routes
    As we extract services, replace these with individual blueprint imports
    """

    # Register extracted blueprints first
    from backend.api.v1.admin.appointments.routes import bp as admin_appt_bp
    from backend.api.v1.admin.customers.routes import bp as admin_customers_bp
    from backend.api.v1.admin.invoices.routes import bp as admin_invoices_bp
    from backend.api.v1.admin.vehicles.routes import bp as admin_vehicles_bp
    from backend.api.v1.customers.profile import bp as customers_profile_bp

    app.register_blueprint(customers_profile_bp)
    app.register_blueprint(admin_appt_bp)
    app.register_blueprint(admin_customers_bp)
    app.register_blueprint(admin_vehicles_bp)
    app.register_blueprint(admin_invoices_bp)

    try:
        # Import monolith to register all existing routes
        # This is temporary during the transition period
        from backend import local_server  # This will register all existing routes

        # TODO Phase C: Replace with extracted blueprints:
        # from backend.api.v1.admin import admin_bp
        # from backend.api.v1.appointments import appointments_bp
        # from backend.api.v1.customers import customers_bp
        # from backend.api.v1.auth import auth_bp
        #
        # app.register_blueprint(admin_bp, url_prefix='/api/admin')
        # app.register_blueprint(appointments_bp, url_prefix='/api/appointments')
        # app.register_blueprint(customers_bp, url_prefix='/api/customers')
        # app.register_blueprint(auth_bp, url_prefix='/api/auth')

    except ImportError as e:
        # Graceful fallback if monolith import fails
        app.logger.warning(f"Could not import monolith routes: {e}")


# Entry point for development
def create_dev_app() -> Flask:
    """Create app with development configuration"""
    dev_config = {
        "DEBUG": True,
        "TESTING": False,
    }
    return create_app(dev_config)


# Entry point for production
def create_prod_app() -> Flask:
    """Create app with production configuration for AWS deployment"""
    prod_config = {
        "DEBUG": False,
        "TESTING": False,
        "PRODUCTION": True,
    }
    app = Flask(__name__)
    app.config.update(prod_config)

    # Use production extensions for AWS deployment (Secrets Manager, Aurora)
    from backend.production import init_production_extensions

    init_production_extensions(app)

    # Phase 2: Install middleware layers (request/response processing)
    from backend.middleware import init_middleware

    init_middleware(app)

    # Phase 3: Set up dependency injection (repository bindings)
    setup_dependency_injection(app)

    # Phase 4: Register blueprints (API routes)
    register_blueprints(app)

    return app
