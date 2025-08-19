from backend.domain import invoice_logic as il
import pytest


def _state(status: str, subtotal: int = 5000, paid: int = 0) -> il.InvoiceState:
    item = il.LineItem(
        position=0,
        name="Svc",
        quantity=1,
        unit_price_cents=subtotal,
        line_subtotal_cents=subtotal,
        tax_rate_basis_points=0,
        tax_cents=0,
        total_cents=subtotal,
        service_operation_id=None,
    )
    totals = il.InvoiceTotals(
        subtotal_cents=subtotal,
        tax_cents=0,
        total_cents=subtotal,
        amount_paid_cents=paid,
        amount_due_cents=subtotal - paid,
    )
    return il.InvoiceState(status=status, line_items=[item], totals=totals)


def test_void_draft_invoice():
    st = _state(il.INITIAL_INVOICE_STATUS)
    voided = il.void_invoice(st)
    assert voided.status == "VOID"
    assert voided.totals.amount_due_cents == st.totals.amount_due_cents  # preserved


def test_void_partially_paid_preserves_due():
    st = _state("PARTIALLY_PAID", subtotal=8000, paid=3000)
    voided = il.void_invoice(st)
    assert voided.status == "VOID"
    assert voided.totals.amount_due_cents == 5000


def test_void_already_void():
    st = _state("VOID")
    with pytest.raises(il.DomainError) as ei:
        il.void_invoice(st)
    assert ei.value.code == "ALREADY_VOID"


def test_void_paid_disallowed():
    st = _state("PAID", subtotal=4000, paid=4000)
    with pytest.raises(il.DomainError) as ei:
        il.void_invoice(st)
    assert ei.value.code == "CANNOT_VOID_PAID"


def test_amount_due_preserved_documented_quirk():
    st = _state("PARTIALLY_PAID", subtotal=6000, paid=1000)
    voided = il.void_invoice(st)
    assert voided.totals.amount_due_cents == 5000  # explicit check of quirk
