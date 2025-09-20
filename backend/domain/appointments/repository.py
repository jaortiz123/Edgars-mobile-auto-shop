"""
Appointments repository - Data access layer for appointment operations
Uses LazyDatabaseManager for connection management
"""

import random
import time
from typing import Any, Dict, List, Optional


class AppointmentRepository:
    """Appointment repository using LazyDatabaseManager"""

    def __init__(self, db):
        self.db = db

    def list(
        self,
        page: int = 1,
        page_size: int = 20,
        customer_id: Optional[str] = None,
        vehicle_id: Optional[str] = None,
        status: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
    ) -> tuple:
        """List appointments with pagination and filters"""
        offset = (page - 1) * page_size

        # Build WHERE conditions
        conditions = ["1=1"]
        params = []
        param_idx = 1

        if customer_id:
            conditions.append(f"a.customer_id = ${param_idx}")
            params.append(customer_id)
            param_idx += 1

        if vehicle_id:
            conditions.append(f"a.vehicle_id = ${param_idx}")
            params.append(vehicle_id)
            param_idx += 1

        if status:
            conditions.append(f"a.status = ${param_idx}")
            params.append(status)
            param_idx += 1

        if from_date:
            conditions.append(f"a.appt_start >= ${param_idx}")
            params.append(from_date)
            param_idx += 1

        if to_date:
            conditions.append(f"a.appt_start <= ${param_idx}")
            params.append(to_date)
            param_idx += 1

        # Main query
        where_clause = " AND ".join(conditions)
        query = f"""
        SELECT a.id::text, a.customer_id::text, a.vehicle_id::text, a.appt_start, a.appt_end,
               a.status, a.notes, a.created_at, a.updated_at
        FROM appointments a
        WHERE {where_clause}
        ORDER BY a.appt_start DESC
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
        """

        params.extend([page_size, offset])
        rows = self.db.query(query, params)

        # Count query
        count_query = f"""
        SELECT COUNT(*) AS n
        FROM appointments a
        WHERE {where_clause}
        """

        total = self.db.one(count_query, params[:-2])["n"]  # Remove LIMIT/OFFSET params

        # Convert timestamps to ISO format
        items = []
        for row in rows:
            appt = dict(row)
            for ts_field in ["appt_start", "appt_end", "created_at", "updated_at"]:
                if appt.get(ts_field):
                    appt[ts_field] = appt[ts_field].isoformat()
            items.append(appt)

        return items, total

    def create(self, data: Dict[str, Any], service_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Create new appointment with services"""
        # 1) Create appointment
        appt_query = """
        INSERT INTO appointments(customer_id, vehicle_id, appt_start, appt_end, notes)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id::text, customer_id::text, vehicle_id::text, appt_start, appt_end, status, notes, created_at, updated_at
        """

        appt_row = self.db.one(
            appt_query,
            [
                data["customer_id"],
                data["vehicle_id"],
                data["appt_start"],
                data["appt_end"],
                data.get("notes"),
            ],
        )

        appt = dict(appt_row)
        appt_id = appt["id"]

        # 2) Attach services
        for service in service_rows:
            service_query = """
            INSERT INTO appointment_services(appointment_id, service_id, qty, price_cents)
            VALUES ($1, $2, $3, $4)
            """

            self.db.query(
                service_query,
                [
                    appt_id,
                    service["id"],
                    1,  # Default quantity
                    service["base_price_cents"],
                ],
            )

        # Convert timestamps to ISO format
        for ts_field in ["appt_start", "appt_end", "created_at", "updated_at"]:
            if appt.get(ts_field):
                appt[ts_field] = appt[ts_field].isoformat()

        # Add empty services list (will be populated by get method if needed)
        appt["services"] = []

        return appt

    def get(self, appointment_id: str) -> Optional[Dict[str, Any]]:
        """Get appointment by ID with services"""
        # 1) Get appointment
        appt_query = """
        SELECT id::text, customer_id::text, vehicle_id::text, appt_start, appt_end,
               status, notes, created_at, updated_at
        FROM appointments
        WHERE id = $1
        """

        try:
            appt_row = self.db.one(appt_query, [appointment_id])
            if not appt_row:
                return None

            appt = dict(appt_row)

            # 2) Get services
            services_query = """
            SELECT s.id::text, s.code, s.name, s.description, s.base_price_cents, s.est_minutes,
                   aps.qty, aps.price_cents
            FROM appointment_services aps
            JOIN services s ON aps.service_id = s.id
            WHERE aps.appointment_id = $1
            ORDER BY s.name
            """

            service_rows = self.db.query(services_query, [appointment_id])
            services = []
            for row in service_rows:
                service_dict = dict(row)
                services.append(service_dict)

            appt["services"] = services

            # Convert timestamps to ISO format
            for ts_field in ["appt_start", "appt_end", "created_at", "updated_at"]:
                if appt.get(ts_field):
                    appt[ts_field] = appt[ts_field].isoformat()

            return appt

        except Exception as e:
            self.db.logger.error(f"Error getting appointment {appointment_id}: {e}")
            return None

    def patch(self, appointment_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update appointment fields"""
        # Build dynamic SET clause
        set_clauses = []
        params = []
        param_idx = 1

        allowed_fields = ["appt_start", "appt_end", "status", "notes"]

        for field in allowed_fields:
            if field in data and data[field] is not None:
                set_clauses.append(f"{field} = ${param_idx}")
                params.append(data[field])
                param_idx += 1

        if not set_clauses:
            return self.get(appointment_id)

        # Always update timestamp
        set_clauses.append("updated_at = CURRENT_TIMESTAMP")

        query = f"""
        UPDATE appointments
        SET {', '.join(set_clauses)}
        WHERE id = ${param_idx}
        """
        params.append(appointment_id)

        try:
            self.db.query(query, params)
            return self.get(appointment_id)
        except Exception as e:
            self.db.logger.error(f"Error patching appointment {appointment_id}: {e}")
            return None

    def list_board(self, target_date: str) -> Dict[str, List[Dict[str, Any]]]:
        """Get appointments for status board grouped by status for a specific date"""
        query = """
        SELECT a.id::text, a.customer_id::text, a.vehicle_id::text,
               a.appt_start, a.appt_end, a.status, a.position,
               a.check_in_at, a.check_out_at, a.tech_id::text,
               a.total_amount, a.paid_amount, a.version, a.notes,
               c.name as customer_name, c.phone as customer_phone,
               v.make, v.model, v.year
        FROM appointments a
        JOIN customers c ON a.customer_id = c.id
        JOIN vehicles v ON a.vehicle_id = v.id
        WHERE DATE(a.appt_start) = $1
        ORDER BY a.status, a.position, a.appt_start
        """

        rows = self.db.query(query, [target_date])

        # Group by status
        board = {"scheduled": [], "in_progress": [], "ready": [], "completed": [], "no_show": []}

        for row in rows:
            appt = dict(row)
            # Convert timestamps to ISO format
            for ts_field in ["appt_start", "appt_end", "check_in_at", "check_out_at"]:
                if appt.get(ts_field):
                    appt[ts_field] = appt[ts_field].isoformat()

            # Convert decimals to float for JSON serialization
            if appt.get("total_amount"):
                appt["total_amount"] = float(appt["total_amount"])
            if appt.get("paid_amount"):
                appt["paid_amount"] = float(appt["paid_amount"])

            status = appt.get("status", "scheduled")
            if status in board:
                board[status].append(appt)
            else:
                board["scheduled"].append(appt)

        return board

    def move(
        self,
        appointment_id: str,
        new_status: str,
        new_position: int,
        current_version: int,
        **kwargs,
    ) -> Optional[Dict[str, Any]]:
        """Move appointment to new status/position with optimistic concurrency control"""

        # Build dynamic SET clause for additional fields
        set_clauses = [
            "status = $1",
            "position = $2",
            "version = version + 1",
            "updated_at = CURRENT_TIMESTAMP",
        ]
        params = [new_status, new_position]
        param_idx = 3

        # Handle optional timestamp updates
        if "check_in_at" in kwargs:
            set_clauses.append(f"check_in_at = ${param_idx}")
            params.append(kwargs["check_in_at"])
            param_idx += 1

        if "check_out_at" in kwargs:
            set_clauses.append(f"check_out_at = ${param_idx}")
            params.append(kwargs["check_out_at"])
            param_idx += 1

        if "tech_id" in kwargs:
            set_clauses.append(f"tech_id = ${param_idx}")
            params.append(kwargs["tech_id"])
            param_idx += 1

        if "total_amount" in kwargs:
            set_clauses.append(f"total_amount = ${param_idx}")
            params.append(kwargs["total_amount"])
            param_idx += 1

        if "paid_amount" in kwargs:
            set_clauses.append(f"paid_amount = ${param_idx}")
            params.append(kwargs["paid_amount"])
            param_idx += 1

        # Add WHERE conditions for ID and version
        params.extend([appointment_id, current_version])

        query = f"""
        UPDATE appointments
        SET {', '.join(set_clauses)}
        WHERE id = ${param_idx} AND version = ${param_idx + 1}
        RETURNING id::text
        """

        # Retry logic for transient deadlocks only (max 1 retry)
        max_retries = 1
        for attempt in range(max_retries + 1):
            try:
                result = self.db.query(query, params)
                if not result:
                    # Version conflict - return None to indicate failure
                    # This is NOT a deadlock, don't retry
                    return None

                # Return updated appointment
                return self.get(appointment_id)

            except Exception as e:
                error_message = str(e).lower()

                # Check if this is a transient deadlock that might benefit from retry
                is_deadlock = any(
                    keyword in error_message
                    for keyword in [
                        "deadlock",
                        "lock timeout",
                        "could not serialize access",
                        "serialization failure",
                        "concurrent update",
                    ]
                )

                if is_deadlock and attempt < max_retries:
                    # Add jittered backoff for deadlock retry (10-25ms)
                    backoff_ms = 10 + random.randint(0, 15)
                    time.sleep(backoff_ms / 1000.0)
                    self.db.logger.warning(
                        f"Deadlock detected for appointment {appointment_id}, retrying after {backoff_ms}ms (attempt {attempt + 1})"
                    )
                    continue

                # Not a deadlock or max retries exceeded - log and fail
                self.db.logger.error(
                    f"Error moving appointment {appointment_id} (attempt {attempt + 1}): {e}"
                )
                return None
