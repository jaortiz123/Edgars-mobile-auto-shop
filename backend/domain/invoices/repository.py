"""
Invoice Repository - Data access layer with verbatim SQL from monolith
Preserves exact SQL patterns, id::text casts, money formatting
"""

import uuid
from typing import Any, Dict, List, Optional

from psycopg2.extras import RealDictCursor

from backend.infra.repositories import DatabaseManager

from .errors import InvoiceError


class SqlInvoiceRepository:
    """SQL-based invoice repository with verbatim monolith SQL"""

    def __init__(self, db: DatabaseManager):
        self.db = db

    def list(self, query_params: Dict[str, Any]) -> Dict[str, Any]:
        """List invoices with pagination and filters - verbatim SQL from monolith"""
        page = max(1, query_params.get("page", 1))
        page_size = max(1, min(100, query_params.get("page_size", 20)))
        customer_id = query_params.get("customer_id")
        status_filter = query_params.get("status")

        offset = (page - 1) * page_size
        where = []
        params: List[Any] = []

        # Build where conditions exactly as in monolith
        if customer_id and customer_id.isdigit():
            where.append("customer_id = %s")
            params.append(int(customer_id))
        if status_filter:
            where.append("status = %s")
            params.append(status_filter)

        with self.db.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Set tenant context for RLS policies - verbatim from monolith
                tenant_id = self._get_tenant_id()
                cur.execute("SELECT set_config('app.tenant_id', %s, true)", (tenant_id,))

                # Use psycopg2.sql for safe composition - verbatim pattern from monolith
                from psycopg2 import sql as _sql

                # Main query - verbatim SELECT from monolith
                base_select = _sql.SQL(
                    "SELECT id::text, customer_id, status::text, subtotal_cents, total_cents, amount_paid_cents, amount_due_cents FROM invoices"
                )
                where_clause = _sql.SQL("")
                if where:
                    where_clause = _sql.SQL(" WHERE ") + _sql.SQL(" AND ").join(
                        [_sql.SQL(w) for w in where]
                    )
                order_limit = _sql.SQL(" ORDER BY created_at DESC, id DESC LIMIT %s OFFSET %s")
                query = base_select + where_clause + order_limit
                cur.execute(query, params + [page_size, offset])
                rows = cur.fetchall() or []

                # Count query - verbatim pattern from monolith
                count_query = _sql.SQL("SELECT COUNT(*) AS cnt FROM invoices") + (
                    _sql.SQL("")
                    if not where
                    else _sql.SQL(" WHERE ") + _sql.SQL(" AND ").join([_sql.SQL(w) for w in where])
                )
                cur.execute(count_query, params)
                total = cur.fetchone()["cnt"] if cur.rowcount != -1 else len(rows)

        return {
            "page": page,
            "page_size": page_size,
            "total_items": total,
            "items": rows,
        }

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create invoice - using domain logic patterns from monolith"""
        invoice_id = str(uuid.uuid4())

        with self.db.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Set tenant context - verbatim from monolith
                tenant_id = self._get_tenant_id()
                cur.execute("SET LOCAL app.tenant_id = %s", (tenant_id,))

                # Fetch appointment for validation - verbatim pattern from monolith
                cur.execute(
                    "SELECT id::text, status::text, customer_id::text, vehicle_id::text FROM appointments WHERE id = %s FOR UPDATE",
                    (data["appointment_id"],),
                )
                appt = cur.fetchone()
                if not appt:
                    raise InvoiceError("NOT_FOUND", "Appointment not found")

                # Check existing invoice - verbatim from monolith
                cur.execute(
                    "SELECT id FROM invoices WHERE appointment_id = %s", (data["appointment_id"],)
                )
                existing = cur.fetchone()
                if existing:
                    raise InvoiceError("DUPLICATE", "Invoice already exists for this appointment")

                # Load services for totals calculation - verbatim SQL from monolith
                try:
                    cur.execute(
                        """
                        SELECT id::text, name, COALESCE(estimated_price,0) AS estimated_price,
                               COALESCE(estimated_hours,0) AS estimated_hours, service_operation_id::text
                        FROM appointment_services WHERE appointment_id = %s ORDER BY created_at, id
                        """,
                        (data["appointment_id"],),
                    )
                except Exception as e:
                    # Fallback for schemas without service_operation_id - verbatim from monolith
                    msg = str(e).lower()
                    if "service_operation_id" in msg and "appointment_services" in msg:
                        cur.execute(
                            """
                            SELECT id::text, name, COALESCE(estimated_price,0) AS estimated_price,
                                   COALESCE(estimated_hours,0) AS estimated_hours, NULL::text AS service_operation_id
                            FROM appointment_services WHERE appointment_id = %s ORDER BY created_at, id
                            """,
                            (data["appointment_id"],),
                        )
                    else:
                        raise
                services = cur.fetchall() or []

                # Calculate totals (simplified version, preserving cents precision)
                subtotal_cents = 0
                for service in services:
                    try:
                        price = float(service.get("estimated_price", 0))
                        subtotal_cents += int(round(price * 100))
                    except (TypeError, ValueError):
                        pass

                tax_cents = 0  # Tax calculation stubbed for now
                total_cents = subtotal_cents + tax_cents

                # Insert invoice - verbatim SQL from monolith
                cur.execute(
                    """
                    INSERT INTO invoices (
                      id, appointment_id, customer_id, vehicle_id, status, currency,
                      subtotal_cents, tax_cents, total_cents, amount_paid_cents, amount_due_cents, created_at, updated_at)
                    VALUES (%s,%s,%s,%s,%s,'USD',%s,%s,%s,%s,%s, now(), now())
                    RETURNING id::text
                    """,
                    (
                        invoice_id,
                        data["appointment_id"],
                        appt.get("customer_id"),
                        appt.get("vehicle_id"),
                        "DRAFT",
                        subtotal_cents,
                        tax_cents,
                        total_cents,
                        0,  # amount_paid_cents
                        total_cents,  # amount_due_cents
                    ),
                )

                # Insert line items for services
                for i, service in enumerate(services):
                    line_item_id = str(uuid.uuid4())
                    cur.execute(
                        """
                        INSERT INTO invoice_line_items (
                          id, invoice_id, position, service_operation_id, name, description, quantity,
                          unit_price_cents, line_subtotal_cents, tax_rate_basis_points, tax_cents, total_cents, created_at)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, now())
                        """,
                        (
                            line_item_id,
                            invoice_id,
                            i + 1,  # position
                            service.get("service_operation_id"),
                            service.get("name", ""),
                            service.get("name", ""),  # description defaults to name
                            1,  # quantity
                            int(
                                round(float(service.get("estimated_price", 0)) * 100)
                            ),  # unit_price_cents
                            int(
                                round(float(service.get("estimated_price", 0)) * 100)
                            ),  # line_subtotal_cents
                            0,  # tax_rate_basis_points
                            0,  # tax_cents
                            int(
                                round(float(service.get("estimated_price", 0)) * 100)
                            ),  # total_cents
                        ),
                    )

                # Return created invoice data
                return {
                    "id": invoice_id,
                    "appointment_id": data["appointment_id"],
                    "customer_id": appt.get("customer_id"),
                    "vehicle_id": appt.get("vehicle_id"),
                    "status": "DRAFT",
                    "subtotal_cents": subtotal_cents,
                    "tax_cents": tax_cents,
                    "total_cents": total_cents,
                    "amount_paid_cents": 0,
                    "amount_due_cents": total_cents,
                    "currency": "USD",
                }

    def get(self, invoice_id: str) -> Optional[Dict[str, Any]]:
        """Get invoice details with line items - verbatim SQL from monolith"""
        with self.db.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Set tenant context - verbatim from monolith
                tenant_id = self._get_tenant_id()
                cur.execute("SET LOCAL app.tenant_id = %s", (tenant_id,))

                # Main invoice query - verbatim SQL from monolith
                cur.execute(
                    """
                    SELECT id::text, appointment_id::text, customer_id::text, vehicle_id::text, status::text, currency,
                           subtotal_cents, tax_cents, total_cents, amount_paid_cents, amount_due_cents,
                           issued_at, paid_at, voided_at, notes, created_at, updated_at
                    FROM invoices WHERE id = %s
                    """,
                    (invoice_id,),
                )
                inv = cur.fetchone()
                if not inv:
                    return None

                # Line items query - verbatim SQL from monolith
                cur.execute(
                    """
                    SELECT id::text, position, service_operation_id::text, name, description, quantity,
                           unit_price_cents, line_subtotal_cents, tax_rate_basis_points, tax_cents, total_cents, created_at
                    FROM invoice_line_items WHERE invoice_id = %s ORDER BY position, id
                    """,
                    (invoice_id,),
                )
                line_items = cur.fetchall() or []

                # Payments query - verbatim SQL from monolith
                payments: List[Dict[str, Any]] = []
                appt_id = inv.get("appointment_id")
                if appt_id:
                    cur.execute(
                        """
                        SELECT id::text, appointment_id::text, amount, method::text, note, created_at
                        FROM payments WHERE appointment_id = %s ORDER BY created_at, id
                        """,
                        (appt_id,),
                    )
                    payments = cur.fetchall() or []

                return {
                    "invoice": dict(inv),
                    "lineItems": [dict(item) for item in line_items],
                    "payments": [dict(payment) for payment in payments],
                }

    def patch(self, invoice_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update invoice fields (status, notes) - basic implementation"""
        with self.db.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Set tenant context
                tenant_id = self._get_tenant_id()
                cur.execute("SET LOCAL app.tenant_id = %s", (tenant_id,))

                # Build update query for allowed fields
                update_fields = []
                params = []

                if "status" in data:
                    update_fields.append("status = %s")
                    params.append(data["status"])

                if "notes" in data:
                    update_fields.append("notes = %s")
                    params.append(data["notes"])

                if not update_fields:
                    # No valid fields to update, just fetch current
                    cur.execute(
                        "SELECT id::text, status::text, notes FROM invoices WHERE id = %s",
                        (invoice_id,),
                    )
                    result = cur.fetchone()
                    return dict(result) if result else None

                # Update with timestamp
                update_fields.append("updated_at = now()")
                params.append(invoice_id)

                update_sql = f"""
                    UPDATE invoices
                    SET {', '.join(update_fields)}
                    WHERE id = %s
                    RETURNING id::text, status::text, notes, updated_at
                """

                cur.execute(update_sql, params)
                result = cur.fetchone()
                return dict(result) if result else None

    def _get_tenant_id(self) -> str:
        """Get tenant ID from Flask context or test default - verbatim pattern from monolith"""
        import os

        try:
            from flask import g

            tenant_id = getattr(g, "tenant_id", None)
            if not tenant_id:
                # Test fallback - verbatim from monolith
                tenant_id = os.getenv("DEFAULT_TEST_TENANT", "00000000-0000-0000-0000-000000000001")
            return tenant_id
        except Exception:
            return os.getenv("DEFAULT_TEST_TENANT", "00000000-0000-0000-0000-000000000001")
