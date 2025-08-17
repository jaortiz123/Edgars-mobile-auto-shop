"""Invoice Domain Logic (Pure / Deterministic)
================================================

Purpose
-------
This module encapsulates all business rules for invoice generation, payments, and voiding
as pure functions and immutable dataclasses. It has **no Flask, database, or I/O imports**
so it can be exhaustively unit tested in milliseconds. This dramatically shortens feedback
loops and allows safe refactors without spinning up infrastructure.

Design Principles
-----------------
1. Immutability: Functions return new `InvoiceState` instances instead of mutating inputs.
2. Deterministic Money Handling: All monetary values stored as integer cents; conversion
    from user input uses `Decimal` with HALF_UP rounding once at the boundary.
3. Minimal Surface: Only expose primitives + dataclasses; orchestration (DB fetch/persist)
    is handled in `invoice_service.py` which becomes a thin adapter layer.
4. Explicit Errors: Domain violations raise `DomainError` or `PaymentValidationError` with
    stable short codes; the service layer maps them to HTTP/API error shapes.
5. Forward-Compatible: Tax calculation is stubbed; line items carry tax fields so a future
    tax engine can plug in without changing API contracts.

Test Pyramid Alignment
----------------------
Layered strategy post Phase 4 cleanup:
* Domain tests (this module) – fast, isolated business rule coverage.
* Single API workflow test – integration safety net across persistence + service adapter.
* One slim E2E UI test – verifies the critical user path (paying an invoice shows PAID badge).
The previous heavy 2+ minute UI lifecycle test was removed after these layers were in place
yielding a ~98% runtime reduction (2m -> ~2.5s for equivalent confidence slice).

Preserved Historical Quirks
---------------------------
* Void operation retains `amount_due_cents` (does not zero it) to maintain backward
  compatibility with existing reporting & downstream expectations. Any change would require
  coordinated migration + analytics update; documented here intentionally.

Extension Hooks
---------------
* To add tax: implement a tax calculator and adjust `calculate_invoice_totals`.
* To add discounts: include discount lines or modify totals derivation before returning.
* To add multi-quantity services: extend `create_line_item_from_service` with quantity logic.

All invariants are enforced in validation helpers; orchestration code should favor constructing
minimal `InvoiceState` objects from persisted rows then delegating to these pure functions.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Iterable, List

BILLABLE_APPOINTMENT_STATUSES = {"COMPLETED", "DONE", "FINISHED"}
INITIAL_INVOICE_STATUS = "DRAFT"


@dataclass(frozen=True)
class ServiceSnapshot:
    name: str
    estimated_price: Decimal  # dollars (source input)
    estimated_hours: Decimal | None = None
    service_operation_id: str | None = None


@dataclass(frozen=True)
class LineItem:
    position: int
    name: str
    quantity: int
    unit_price_cents: int
    line_subtotal_cents: int
    tax_rate_basis_points: int
    tax_cents: int
    total_cents: int
    service_operation_id: str | None = None


@dataclass(frozen=True)
class InvoiceTotals:
    subtotal_cents: int
    tax_cents: int
    total_cents: int
    amount_paid_cents: int
    amount_due_cents: int


@dataclass(frozen=True)
class InvoiceState:
    status: str
    line_items: List[LineItem]
    totals: InvoiceTotals


class DomainError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class PaymentValidationError(ValueError):
    """Raised for payment-specific validation failures (keeps simple ValueError type).

    Codes align with service layer (INVALID_AMOUNT, INVALID_STATE, ALREADY_PAID, OVERPAYMENT).
    """

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


# ---------------------------- Generation ----------------------------------


def validate_appointment_for_invoicing(status: str, has_existing_invoice: bool) -> None:
    status_u = (status or "").upper()
    if status_u not in BILLABLE_APPOINTMENT_STATUSES:
        raise DomainError("INVALID_STATE", f"Appointment status {status_u} not billable")
    if has_existing_invoice:
        raise DomainError("ALREADY_EXISTS", "Invoice already exists for appointment")


# Price conversion helper (float -> cents) using Decimal for deterministic rounding
_DEF_QUANT = Decimal("0.01")


def _dollars_to_cents(amount: Decimal | float | int) -> int:
    if not isinstance(amount, Decimal):
        amount = Decimal(str(amount))
    return int((amount.quantize(_DEF_QUANT, rounding=ROUND_HALF_UP) * 100).to_integral_value())


def create_line_item_from_service(idx: int, service: dict) -> LineItem:
    raw_price = service.get("estimated_price") or 0
    unit_cents = _dollars_to_cents(raw_price)
    return LineItem(
        position=idx,
        name=service.get("name") or "Service",
        quantity=1,
        unit_price_cents=unit_cents,
        line_subtotal_cents=unit_cents,
        tax_rate_basis_points=0,
        tax_cents=0,
        total_cents=unit_cents,
        service_operation_id=service.get("service_operation_id"),
    )


def build_line_items(services: Iterable[dict]) -> List[LineItem]:
    return [create_line_item_from_service(i, s) for i, s in enumerate(services)]


def calculate_invoice_totals(line_items: Iterable[LineItem]) -> InvoiceTotals:
    subtotal = sum(li.line_subtotal_cents for li in line_items)
    tax = 0  # Placeholder for future tax engine
    total = subtotal + tax
    amount_paid = 0
    amount_due = total
    return InvoiceTotals(
        subtotal_cents=subtotal,
        tax_cents=tax,
        total_cents=total,
        amount_paid_cents=amount_paid,
        amount_due_cents=amount_due,
    )


def create_initial_invoice_state(line_items: List[LineItem]) -> InvoiceState:
    totals = calculate_invoice_totals(line_items)
    return InvoiceState(status=INITIAL_INVOICE_STATUS, line_items=line_items, totals=totals)


# ---------------------------- Payments ------------------------------------


@dataclass(frozen=True)
class PaymentResult:
    new_state: InvoiceState
    payment: dict  # { amount_cents, previous_amount_paid_cents, new_amount_paid_cents, new_amount_due_cents, status_changed, new_status }


def validate_payment(invoice_state: InvoiceState, amount_cents: int) -> None:
    if amount_cents <= 0:
        raise PaymentValidationError("INVALID_AMOUNT", "Payment amount must be positive")
    if invoice_state.status == "VOID":
        raise PaymentValidationError("INVALID_STATE", "Cannot pay a void invoice")
    if invoice_state.status == "PAID" or invoice_state.totals.amount_due_cents == 0:
        raise PaymentValidationError("ALREADY_PAID", "Invoice already fully paid")
    if amount_cents > invoice_state.totals.amount_due_cents:
        raise PaymentValidationError("OVERPAYMENT", "Payment exceeds remaining balance")


def apply_payment_to_invoice(invoice_state: InvoiceState, amount_cents: int) -> PaymentResult:
    """Apply a payment returning a new immutable invoice state + payment metadata.

    Status rules:
      - If resulting amount_due == 0 -> PAID
      - Else -> PARTIALLY_PAID (even if first payment from DRAFT)
    """
    validate_payment(invoice_state, amount_cents)
    prev_paid = invoice_state.totals.amount_paid_cents
    prev_due = invoice_state.totals.amount_due_cents
    new_paid = prev_paid + amount_cents
    new_due = prev_due - amount_cents
    new_status = "PAID" if new_due == 0 else "PARTIALLY_PAID"
    status_changed = new_status != invoice_state.status
    new_totals = InvoiceTotals(
        subtotal_cents=invoice_state.totals.subtotal_cents,
        tax_cents=invoice_state.totals.tax_cents,
        total_cents=invoice_state.totals.total_cents,
        amount_paid_cents=new_paid,
        amount_due_cents=new_due,
    )
    new_state = InvoiceState(
        status=new_status, line_items=invoice_state.line_items, totals=new_totals
    )
    payment_meta = {
        "amount_cents": amount_cents,
        "previous_amount_paid_cents": prev_paid,
        "new_amount_paid_cents": new_paid,
        "new_amount_due_cents": new_due,
        "status_changed": status_changed,
        "new_status": new_status,
    }
    return PaymentResult(new_state=new_state, payment=payment_meta)


__all__ = [
    "ServiceSnapshot",
    "LineItem",
    "InvoiceTotals",
    "InvoiceState",
    "DomainError",
    "validate_appointment_for_invoicing",
    "create_line_item_from_service",
    "build_line_items",
    "calculate_invoice_totals",
    "create_initial_invoice_state",
    "PaymentValidationError",
    "validate_payment",
    "apply_payment_to_invoice",
    "PaymentResult",
    "validate_void",
    "void_invoice",
]

# ---------------------------- Void ---------------------------------------


def validate_void(invoice_state: InvoiceState) -> None:
    """Validate that an invoice can be voided.

    Rules:
      - Cannot void if already VOID (ALREADY_VOID)
      - Cannot void if PAID (CANNOT_VOID_PAID)  (differs from service layer which uses ALREADY_PAID)
    """
    if invoice_state.status == "VOID":
        raise DomainError("ALREADY_VOID", "Invoice already void")
    if invoice_state.status == "PAID":
        # Use explicit code to clarify intent (service layer may map to ALREADY_PAID for backward compatibility)
        raise DomainError("CANNOT_VOID_PAID", "Paid invoices cannot be voided")


def void_invoice(invoice_state: InvoiceState) -> InvoiceState:
    """Return a new voided invoice state (immutably) preserving amount_due.

    NOTE: Business rule quirk - amount_due_cents is preserved when voiding to satisfy
    existing database constraint logic and historical reporting expectations.
    Typical accounting might set amount_due to 0; we intentionally retain it for
    backward compatibility (see Phase 2 extraction notes).
    """
    validate_void(invoice_state)
    # Preserve totals exactly; only status changes.
    return InvoiceState(
        status="VOID", line_items=invoice_state.line_items, totals=invoice_state.totals
    )
