from backend.domain import invoice_logic as il
import pytest
from decimal import Decimal

# ------------------ validate_appointment_for_invoicing ------------------

def test_validate_appointment_ok():
    il.validate_appointment_for_invoicing("COMPLETED", False)

@pytest.mark.parametrize("status", ["SCHEDULED", "READY", "", None])
def test_validate_appointment_invalid(status):
    with pytest.raises(il.DomainError) as ei:
        il.validate_appointment_for_invoicing(status, False)  # type: ignore
    assert ei.value.code == "INVALID_STATE"


def test_validate_appointment_duplicate():
    with pytest.raises(il.DomainError) as ei:
        il.validate_appointment_for_invoicing("COMPLETED", True)
    assert ei.value.code == "ALREADY_EXISTS"

# ------------------ line item creation & totals ------------------------

def test_create_line_item_rounding():
    svc = {"name": "Oil Change", "estimated_price": 12.3456}
    li = il.create_line_item_from_service(0, svc)
    # 12.3456 -> 12.35 -> 1235 cents
    assert li.unit_price_cents == 1235


def test_build_line_items_and_totals_empty():
    items = il.build_line_items([])
    assert items == []
    totals = il.calculate_invoice_totals(items)
    assert totals.subtotal_cents == 0
    assert totals.amount_due_cents == 0


def test_build_line_items_and_totals_multiple():
    services = [
        {"name": "A", "estimated_price": 10},
        {"name": "B", "estimated_price": 2.499},  # 2.50 -> 250
    ]
    items = il.build_line_items(services)
    assert [li.unit_price_cents for li in items] == [1000, 250]
    totals = il.calculate_invoice_totals(items)
    assert totals.subtotal_cents == 1250
    assert totals.total_cents == 1250
    assert totals.amount_due_cents == 1250


def test_create_initial_invoice_state():
    services = [{"name": "Svc", "estimated_price": Decimal("19.99")}]  # 1999 cents
    items = il.build_line_items(services)
    state = il.create_initial_invoice_state(items)
    assert state.status == il.INITIAL_INVOICE_STATUS
    assert state.totals.total_cents == 1999
    assert state.totals.amount_paid_cents == 0
    assert state.totals.amount_due_cents == 1999
