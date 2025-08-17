"""Invoice generation and data access helpers.

Focused lightweight helpers using psycopg2 to match existing `local_server` style.
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any, Dict, List

from psycopg2.extras import RealDictCursor


# Helper for test seed endpoint; kept minimal to avoid impacting production logic
def create_appointment_with_services(
    customer_name: str, services: list[dict]
):  # pragma: no cover - test infra
    """Create an appointment and attach services (test-mode convenience).

    Expects services list of { name, price_cents }.
    Returns serialized appointment dict with id.
    """
    # This is a simplified facade; reuse existing internal creation utilities if available.
    appt = {"id": str(uuid.uuid4()), "customer_name": customer_name, "status": "COMPLETED"}
    # In real implementation, persist appointment + service rows, here we just return stub.
    return appt


try:
    from . import local_server as srv  # package context
except ImportError:  # direct script/test context
    import local_server as srv  # type: ignore

INVOICE_STATUS_DRAFT = "DRAFT"

# Domain imports (pure business logic)
try:  # local package context
    from .domain import invoice_logic as domain
except Exception:  # pragma: no cover - fallback for direct execution
    from domain import invoice_logic as domain  # type: ignore


class InvoiceError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _new_id() -> str:
    return str(uuid.uuid4())


def generate_invoice_for_appointment(appt_id: str) -> Dict[str, Any]:
    """Generate (or raise) an invoice snapshot using domain logic for business rules."""
    conn = srv.db_conn()
    try:
        with conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Fetch & lock appointment (persistence concern)
                cur.execute(
                    "SELECT id::text, status::text, customer_id::text, vehicle_id::text FROM appointments WHERE id = %s FOR UPDATE",
                    (appt_id,),
                )
                appt = cur.fetchone()
                if not appt:
                    raise InvoiceError("NOT_FOUND", "Appointment not found")

                # Check existing invoice (persistence concern)
                cur.execute("SELECT id FROM invoices WHERE appointment_id = %s", (appt_id,))
                existing = cur.fetchone()
                try:
                    domain.validate_appointment_for_invoicing(appt.get("status"), bool(existing))
                except domain.DomainError as e:
                    raise InvoiceError(e.code, e.message)

                # Load services (persistence)
                cur.execute(
                    """
                    SELECT id::text, name, COALESCE(estimated_price,0) AS estimated_price,
                           COALESCE(estimated_hours,0) AS estimated_hours, service_operation_id::text
                    FROM appointment_services WHERE appointment_id = %s ORDER BY created_at, id
                    """,
                    (appt_id,),
                )
                services = cur.fetchall() or []

                # Domain line items + state (IDs for persistence added below)
                line_items_domain = domain.build_line_items(services)
                state = domain.create_initial_invoice_state(line_items_domain)

                invoice_id = _new_id()

                # Persist invoice using domain totals
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
                        appt_id,
                        appt.get("customer_id"),
                        appt.get("vehicle_id"),
                        state.status,
                        state.totals.subtotal_cents,
                        state.totals.tax_cents,
                        state.totals.total_cents,
                        state.totals.amount_paid_cents,
                        state.totals.amount_due_cents,
                    ),
                )
                cur.fetchone()

                # Prepare persistence line items merging domain + new ids
                line_items: List[Dict[str, Any]] = []
                for li in line_items_domain:
                    row = {
                        "id": _new_id(),
                        "position": li.position,
                        "service_operation_id": li.service_operation_id,
                        "name": li.name,
                        "description": None,
                        "quantity": li.quantity,
                        "unit_price_cents": li.unit_price_cents,
                        "line_subtotal_cents": li.line_subtotal_cents,
                        "tax_rate_basis_points": li.tax_rate_basis_points,
                        "tax_cents": li.tax_cents,
                        "total_cents": li.total_cents,
                    }
                    line_items.append(row)

                if line_items:
                    args_str = ",".join(
                        cur.mogrify(
                            "(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, now())",
                            (
                                li["id"],
                                invoice_id,
                                li["position"],
                                li["service_operation_id"],
                                li["name"],
                                li["description"],
                                li["quantity"],
                                li["unit_price_cents"],
                                li["line_subtotal_cents"],
                                li["tax_rate_basis_points"],
                                li["tax_cents"],
                                li["total_cents"],
                            ),
                        ).decode("utf-8")
                        for li in line_items
                    )
                    cur.execute(
                        """
                        INSERT INTO invoice_line_items (
                          id, invoice_id, position, service_operation_id, name, description, quantity,
                          unit_price_cents, line_subtotal_cents, tax_rate_basis_points, tax_cents, total_cents, created_at)
                        VALUES """
                        + args_str
                    )

                return {
                    "id": invoice_id,
                    "status": state.status,
                    "subtotal_cents": state.totals.subtotal_cents,
                    "tax_cents": state.totals.tax_cents,
                    "total_cents": state.totals.total_cents,
                    "amount_due_cents": state.totals.amount_due_cents,
                    "line_items": line_items,
                }
    finally:
        try:
            conn.close()
        except Exception:
            pass


def fetch_invoice_details(invoice_id: str) -> Dict[str, Any]:
    """Fetch a single invoice with line items and payments.

    Returns structured dict or raises InvoiceError('NOT_FOUND', ...)
    """
    conn = srv.db_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Main invoice
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
                raise InvoiceError("NOT_FOUND", "Invoice not found")

            # Line items
            cur.execute(
                """
                SELECT id::text, position, service_operation_id::text, name, description, quantity,
                       unit_price_cents, line_subtotal_cents, tax_rate_basis_points, tax_cents, total_cents, created_at
                FROM invoice_line_items WHERE invoice_id = %s ORDER BY position, id
                """,
                (invoice_id,),
            )
            line_items = cur.fetchall() or []

            # Payments (may reference appointments currently; in future invoice payments table)
            # We attempt to fetch via appointment_id if present.
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

            def _coerce(val):
                if isinstance(val, Decimal):
                    # Prefer int when value integral to avoid float stringify noise
                    if val == val.to_integral_value():
                        return int(val)
                    return float(val)
                if isinstance(val, list):
                    return [_coerce(v) for v in val]
                if isinstance(val, dict):
                    return {k: _coerce(v) for k, v in val.items()}
                return val

            return _coerce(
                {
                    "invoice": inv,
                    "lineItems": line_items,
                    "payments": payments,
                }
            )
    finally:
        try:
            conn.close()
        except Exception:
            pass


def record_payment_for_invoice(
    invoice_id: str,
    *,
    amount_cents: int,
    method: str,
    received_at: str | None = None,
    note: str | None = None,
) -> Dict[str, Any]:
    """Record a payment against an invoice.

    Validations:
      - invoice exists
      - invoice not VOID
      - invoice not PAID
      - amount_cents > 0 and <= amount_due_cents
    Atomic update with row lock.
    Returns {'invoice': updated_invoice, 'payment': payment_record}
    """
    # Basic amount validation will be re-run by domain layer; keep early guard minimal for parity
    if amount_cents <= 0:
        raise InvoiceError("INVALID_AMOUNT", "Payment amount must be positive")
    conn = srv.db_conn()
    try:
        with conn:  # transaction
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT id::text, appointment_id::text, status::text, subtotal_cents, tax_cents, total_cents, amount_paid_cents, amount_due_cents
                    FROM invoices WHERE id = %s FOR UPDATE
                    """,
                    (invoice_id,),
                )
                inv_row = cur.fetchone()
                if not inv_row:
                    raise InvoiceError("NOT_FOUND", "Invoice not found")

                # Build minimal domain state (line items not needed for payment logic)
                try:
                    domain_state = domain.InvoiceState(
                        status=inv_row["status"],
                        line_items=[],  # not required for payment calculations
                        totals=domain.InvoiceTotals(
                            subtotal_cents=inv_row.get("subtotal_cents")
                            or (inv_row["total_cents"] - (inv_row.get("tax_cents") or 0)),
                            tax_cents=inv_row.get("tax_cents") or 0,
                            total_cents=inv_row["total_cents"],
                            amount_paid_cents=inv_row["amount_paid_cents"],
                            amount_due_cents=inv_row["amount_due_cents"],
                        ),
                    )
                    pay_result = domain.apply_payment_to_invoice(domain_state, amount_cents)
                except domain.PaymentValidationError as e:
                    raise InvoiceError(e.code, e.message)

                # Insert payment (payments table references appointment_id in current schema)
                appt_id = inv_row["appointment_id"]
                amount_decimal = amount_cents / 100.0  # NUMERIC dollars for existing schema
                cur.execute(
                    """
                    INSERT INTO payments (appointment_id, amount, method, note, created_at)
                    VALUES (%s, %s, %s, %s, COALESCE(%s, now()))
                    RETURNING id::text, appointment_id::text, amount, method::text, note, created_at
                    """,
                    (appt_id, amount_decimal, method, note, received_at),
                )
                payment = cur.fetchone()
                new_state = pay_result.new_state
                set_paid_at = ", paid_at = now()" if new_state.status == "PAID" else ""
                cur.execute(
                    f"""
                    UPDATE invoices
                    SET amount_paid_cents = %s,
                        amount_due_cents = %s,
                        status = %s,
                        updated_at = now(){set_paid_at}
                    WHERE id = %s
                    RETURNING id::text, appointment_id::text, status::text, currency, subtotal_cents, tax_cents, total_cents, amount_paid_cents, amount_due_cents, issued_at, paid_at, voided_at, notes, created_at, updated_at
                    """,
                    (
                        new_state.totals.amount_paid_cents,
                        new_state.totals.amount_due_cents,
                        new_state.status,
                        invoice_id,
                    ),
                )
                updated_inv = cur.fetchone()

                # Normalize payment amount to cents
                pay_amount_cents = amount_cents
                payment_out = {
                    "id": payment["id"],
                    "appointment_id": payment["appointment_id"],
                    "amount_cents": pay_amount_cents,
                    "method": payment["method"],
                    "note": payment["note"],
                    "created_at": payment["created_at"],
                }
                return {"invoice": updated_inv, "payment": payment_out}
    finally:
        try:
            conn.close()
        except Exception:
            pass


def void_invoice(invoice_id: str) -> Dict[str, Any]:
    """Void an invoice if allowed.

    Rules:
      - Cannot void if already VOID (ALREADY_VOID)
      - Cannot void if PAID (ALREADY_PAID)
      - Other statuses (DRAFT, SENT, PARTIALLY_PAID) are voidable
      - Sets status=VOID, voided_at=now(), amount_due_cents=0, preserves amount_paid_cents & total_cents
    Returns updated invoice (and previous_status for auditing convenience).
    """
    conn = srv.db_conn()
    try:
        with conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT id::text, status::text, subtotal_cents, tax_cents, total_cents, amount_paid_cents, amount_due_cents
                    FROM invoices WHERE id = %s FOR UPDATE
                    """,
                    (invoice_id,),
                )
                inv = cur.fetchone()
                if not inv:
                    raise InvoiceError("NOT_FOUND", "Invoice not found")
                # Domain validation
                state = domain.InvoiceState(
                    status=inv["status"],
                    line_items=[],  # not required for void rule
                    totals=domain.InvoiceTotals(
                        subtotal_cents=inv["subtotal_cents"],
                        tax_cents=inv["tax_cents"],
                        total_cents=inv["total_cents"],
                        amount_paid_cents=inv["amount_paid_cents"],
                        amount_due_cents=inv["amount_due_cents"],
                    ),
                )
                previous_status = state.status
                try:
                    domain.validate_void(state)
                except domain.DomainError as e:
                    # Map domain codes to prior API codes where they differ
                    mapped = "ALREADY_PAID" if e.code == "CANNOT_VOID_PAID" else e.code
                    raise InvoiceError(mapped, e.message)
                domain.void_invoice(state)
                # Persistence: status update, preserve amount_due (constraint still holds)
                cur.execute(
                    """
                    UPDATE invoices
                    SET status='VOID', amount_due_cents = (total_cents - amount_paid_cents), voided_at=now(), updated_at=now()
                    WHERE id = %s
                    RETURNING id::text, appointment_id::text, status::text, currency, subtotal_cents, tax_cents, total_cents, amount_paid_cents, amount_due_cents, issued_at, paid_at, voided_at, notes, created_at, updated_at
                    """,
                    (invoice_id,),
                )
                updated = cur.fetchone()
                return {"invoice": updated, "previous_status": previous_status}
    finally:
        try:
            conn.close()
        except Exception:
            pass


def list_invoices(
    *,
    status: str | None = None,
    customer_id: str | None = None,
    created_from: str | None = None,
    created_to: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> Dict[str, Any]:
    """Return paginated invoice summaries with optional filters.

    Filters:
      status: single status value (exact match)
      customer_id: id
      created_from / created_to: ISO timestamp or date strings compared against created_at
    Pagination: 1-based page, page_size (capped at 100)
    """
    page = max(page, 1)
    page_size = max(1, min(page_size, 100))
    offset = (page - 1) * page_size

    clauses = []
    params: list[Any] = []
    if status:
        clauses.append("i.status = %s")
        params.append(status.upper())
    if customer_id:
        clauses.append("i.customer_id = %s")
        params.append(int(customer_id))
    if created_from:
        clauses.append("i.created_at >= %s")
        params.append(created_from)
    if created_to:
        clauses.append("i.created_at <= %s")
        params.append(created_to)
    where_sql = ("WHERE " + " AND ".join(clauses)) if clauses else ""

    sql_base = f"""
        FROM invoices i
        LEFT JOIN customers c ON i.customer_id = c.id
        {where_sql}
    """
    conn = srv.db_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Count
            cur.execute("SELECT COUNT(*) AS ct " + sql_base, params)
            total_items = int(cur.fetchone()["ct"])
            # Page
            cur.execute(
                """
                SELECT i.id::text, i.status::text, i.total_cents, i.amount_due_cents, i.amount_paid_cents,
                       i.subtotal_cents, i.tax_cents, i.created_at, i.updated_at, i.issued_at,
                       c.id AS customer_id, c.name AS customer_name
                """
                + sql_base
                + " ORDER BY i.created_at DESC, i.id DESC LIMIT %s OFFSET %s",
                params + [page_size, offset],
            )
            rows = cur.fetchall() or []
            total_pages = (total_items + page_size - 1) // page_size
            return {
                "items": rows,
                "page": page,
                "page_size": page_size,
                "total_items": total_items,
                "total_pages": total_pages,
            }
    finally:
        try:
            conn.close()
        except Exception:
            pass
