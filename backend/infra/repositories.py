"""
Concrete repository implementations for Edgar's Mobile Auto Shop
Implements the repository interfaces using PostgreSQL
"""

from typing import Any, Dict, List, Optional, Tuple

import psycopg2
from psycopg2.extras import RealDictCursor

from backend.domain.interfaces import (
    AppointmentRepository,
    CustomerRepository,
    InvoiceRepository,
    VehicleRepository,
)


class PostgresCustomerRepository(CustomerRepository):
    """PostgreSQL implementation of CustomerRepository"""

    def __init__(self, db_manager):
        self.db = db_manager

    def get_by_id(self, customer_id: str) -> Optional[Dict[str, Any]]:
        """
        Get customer by ID
        Uses existing SQL logic from local_server.py _get_customer_row()
        """
        # TODO: Extract exact SQL from local_server.py _get_customer_row() function
        with self.db.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM customers WHERE customer_id = %s", (customer_id,))
                row = cur.fetchone()
                return dict(row) if row else None

    def update(self, customer_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update customer with patch data
        Uses existing validation and SQL logic from local_server.py
        """
        # TODO: Extract exact validation from _validate_customer_patch()
        # TODO: Extract exact SQL UPDATE logic from PATCH endpoint

        with self.db.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Simplified placeholder - replace with exact monolith SQL
                set_clauses = []
                params = []

                for key, value in patch.items():
                    if key in ["email", "phone", "contact_preferences"]:
                        set_clauses.append(f"{key} = %s")
                        params.append(value)

                if not set_clauses:
                    raise ValueError("No valid fields to update")

                params.append(customer_id)

                cur.execute(
                    f"UPDATE customers SET {', '.join(set_clauses)} WHERE customer_id = %s RETURNING *",
                    params,
                )

                updated_row = cur.fetchone()
                conn.commit()

                return dict(updated_row) if updated_row else None

    def search(
        self, query: str, limit: int = 25, offset: int = 0
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Search customers
        Uses existing search logic from local_server.py
        """
        # TODO: Extract exact search SQL from /api/customers/lookup endpoint

        with self.db.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Simplified placeholder - replace with exact monolith SQL
                search_sql = """
                    SELECT * FROM customers
                    WHERE email ILIKE %s OR phone ILIKE %s
                    LIMIT %s OFFSET %s
                """

                count_sql = """
                    SELECT COUNT(*) FROM customers
                    WHERE email ILIKE %s OR phone ILIKE %s
                """

                search_param = f"%{query}%"

                # Get total count
                cur.execute(count_sql, (search_param, search_param))
                total_count = cur.fetchone()["count"]

                # Get results
                cur.execute(search_sql, (search_param, search_param, limit, offset))
                rows = cur.fetchall()

                return [dict(row) for row in rows], total_count

    def create(self, customer_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new customer"""
        # TODO: Extract exact creation logic from local_server.py
        pass


class PostgresAppointmentRepository(AppointmentRepository):
    """PostgreSQL implementation of AppointmentRepository"""

    def __init__(self, db_manager):
        self.db = db_manager

    def get_by_id(self, appointment_id: str) -> Optional[Dict[str, Any]]:
        """Get appointment by ID"""
        # TODO: Extract exact SQL from local_server.py appointment handlers
        pass

    def create(self, appointment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new appointment"""
        # TODO: Extract exact creation logic from POST /api/appointments
        pass

    def update(self, appointment_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
        """Update appointment"""
        # TODO: Extract exact update logic from PATCH /api/appointments/{id}
        pass

    def list_by_criteria(
        self,
        customer_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 25,
        offset: int = 0,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """List appointments by criteria"""
        # TODO: Extract exact listing logic from GET /api/admin/appointments
        pass


class PostgresVehicleRepository(VehicleRepository):
    """PostgreSQL implementation of VehicleRepository"""

    def __init__(self, db_manager):
        self.db = db_manager

    def get_by_id(self, vehicle_id: str) -> Optional[Dict[str, Any]]:
        """Get vehicle by ID"""
        # TODO: Extract exact SQL from _get_vehicle_row() in local_server.py
        pass

    def get_by_customer(self, customer_id: str) -> List[Dict[str, Any]]:
        """Get all vehicles for customer"""
        # TODO: Extract exact SQL from customer vehicle endpoints
        pass

    def create(self, vehicle_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new vehicle"""
        # TODO: Extract exact creation logic from POST /api/admin/vehicles
        pass

    def update(self, vehicle_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
        """Update vehicle"""
        # TODO: Extract exact update logic and validation from _validate_vehicle_patch()
        pass


class PostgresInvoiceRepository(InvoiceRepository):
    """PostgreSQL implementation of InvoiceRepository"""

    def __init__(self, db_manager):
        self.db = db_manager

    def get_by_id(self, invoice_id: str) -> Optional[Dict[str, Any]]:
        """Get invoice by ID"""
        # TODO: Extract exact SQL from get_invoice() function in local_server.py
        pass

    def create(self, invoice_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new invoice"""
        # TODO: Extract exact creation logic from invoice endpoints
        pass

    def list_by_customer(
        self, customer_id: str, limit: int = 25, offset: int = 0
    ) -> Tuple[List[Dict[str, Any]], int]:
        """List invoices for customer"""
        # TODO: Extract exact SQL from GET /api/admin/invoices
        pass

    def update_payment_status(
        self, invoice_id: str, status: str, payment_data: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Update invoice payment status"""
        # TODO: Extract exact payment logic from create_invoice_payment()
        pass


# Legacy DatabaseManager - kept for Flask app compatibility
# For Lambda, use LazyDatabaseManager from lazy_db.py
import os
import time

from psycopg2 import OperationalError

from .lazy_db import get_db_manager


class DatabaseManager:
    """
    Legacy database manager for Flask app compatibility
    For Lambda, use get_db_manager() from lazy_db.py
    """

    def __init__(self):
        self.connection_string = None
        self.max_retries = 3
        self.retry_delay = 0.5

    def init_app(self, app):
        """Initialize database with Flask app - read env vars"""
        # Read environment variables for DSN connection
        db_host = os.getenv("DB_HOST", "localhost")
        db_port = os.getenv("DB_PORT", "5432")
        db_name = os.getenv("DB_NAME", "edgar_shop")
        db_user = os.getenv("DB_USER", "postgres")
        db_password = os.getenv("DB_PASSWORD", "")
        db_sslmode = os.getenv("DB_SSLMODE", "prefer")

        self.connection_string = (
            f"host={db_host} port={db_port} dbname={db_name} "
            f"user={db_user} password={db_password} sslmode={db_sslmode}"
        )

        # Store in app config for access by services
        app.config["db_manager"] = self

    def get_connection(self):
        """Get database connection with retry logic"""
        if not self.connection_string:
            raise RuntimeError("DatabaseManager not initialized - call init_app() first")

        for attempt in range(self.max_retries):
            try:
                conn = psycopg2.connect(self.connection_string)
                return conn
            except OperationalError as e:
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay * (2**attempt))  # exponential backoff
                    continue
                raise e

    def query(self, sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
        """Execute query and return all rows as list of dicts"""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
                return [dict(row) for row in rows] if rows else []

    def one(self, sql: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
        """Execute query and return single row as dict"""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(sql, params)
                row = cur.fetchone()
                return dict(row) if row else None


# For Lambda runtime - use this instead of DatabaseManager
def get_lambda_db():
    """Get lazy-initialized database manager for Lambda runtime"""
    return get_db_manager()
