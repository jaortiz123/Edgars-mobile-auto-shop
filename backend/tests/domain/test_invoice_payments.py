from backend.domain import invoice_logic as il
import pytest


def _state(total_cents: int) -> il.InvoiceState:
    # Build a trivial invoice state with one line item so totals are coherent
    item = il.LineItem(
        position=0,
        name="Svc",
        quantity=1,
        unit_price_cents=total_cents,
        line_subtotal_cents=total_cents,
        tax_rate_basis_points=0,
        tax_cents=0,
        total_cents=total_cents,
        service_operation_id=None,
    )
    totals = il.InvoiceTotals(
        subtotal_cents=total_cents,
        tax_cents=0,
        total_cents=total_cents,
        amount_paid_cents=0,
        amount_due_cents=total_cents,
    )
    return il.InvoiceState(status=il.INITIAL_INVOICE_STATUS, line_items=[item], totals=totals)


def test_full_payment_sets_paid():
    st = _state(5000)
    res = il.apply_payment_to_invoice(st, 5000)
    assert res.new_state.status == "PAID"
    assert res.new_state.totals.amount_due_cents == 0
    assert res.payment["amount_cents"] == 5000


def test_partial_payment_sets_partially_paid():
    st = _state(5000)
    res = il.apply_payment_to_invoice(st, 2000)
    assert res.new_state.status == "PARTIALLY_PAID"
    assert res.new_state.totals.amount_due_cents == 3000


def test_multiple_partial_payments_then_paid():
    st = _state(5000)
    r1 = il.apply_payment_to_invoice(st, 1000)
    r2 = il.apply_payment_to_invoice(r1.new_state, 1500)
    r3 = il.apply_payment_to_invoice(r2.new_state, 2500)
    assert r3.new_state.status == "PAID"
    assert r3.new_state.totals.amount_due_cents == 0
    assert r3.new_state.totals.amount_paid_cents == 5000


@pytest.mark.parametrize("amount", [0, -1])
def test_invalid_amount(amount):
    st = _state(1000)
    with pytest.raises(il.PaymentValidationError) as ei:
        il.apply_payment_to_invoice(st, amount)
    assert ei.value.code == "INVALID_AMOUNT"


def test_overpayment():
    st = _state(3000)
    with pytest.raises(il.PaymentValidationError) as ei:
        il.apply_payment_to_invoice(st, 4000)
    assert ei.value.code == "OVERPAYMENT"


def test_payment_on_paid_invoice():
    st = _state(1000)
    paid = il.apply_payment_to_invoice(st, 1000).new_state
    with pytest.raises(il.PaymentValidationError) as ei:
        il.apply_payment_to_invoice(paid, 1)
    assert ei.value.code == "ALREADY_PAID"


def test_payment_on_void_invoice():
    st = _state(2000)
    # Simulate a voided invoice state manually
    void_state = il.InvoiceState(status="VOID", line_items=st.line_items, totals=st.totals)
    with pytest.raises(il.PaymentValidationError) as ei:
        il.apply_payment_to_invoice(void_state, 100)
    assert ei.value.code == "INVALID_STATE"
