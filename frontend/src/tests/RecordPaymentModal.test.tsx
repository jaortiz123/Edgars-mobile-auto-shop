import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecordPaymentModal } from '../pages/admin/RecordPaymentModal';

describe('RecordPaymentModal', () => {
  it('renders defaults and validates amount', async () => {
    const user = userEvent.setup();
    render(<RecordPaymentModal open amountDueCents={12345} invoiceStatus="PARTIALLY_PAID" onClose={() => {}} />);
    const amountInput = screen.getByTestId('payment-amount-input') as HTMLInputElement;
    expect(amountInput.value).toBe('123.45');
    await user.clear(amountInput);
    await user.type(amountInput, '0');
    amountInput.blur();
    expect(await screen.findByText(/enter a positive amount/i)).toBeInTheDocument();
  });

  it('shows overpay warning when amount exceeds due', async () => {
    const user = userEvent.setup();
    render(<RecordPaymentModal open amountDueCents={5000} invoiceStatus="SENT" onClose={() => {}} />);
    const amountInput = screen.getByTestId('payment-amount-input') as HTMLInputElement;
    await user.clear(amountInput);
    await user.type(amountInput, '60.00');
    amountInput.blur();
    expect(screen.getByText(/exceeds amount due/i)).toBeInTheDocument();
  });

  it('disables submit when invoice PAID', () => {
    render(<RecordPaymentModal open amountDueCents={0} invoiceStatus="PAID" onClose={() => {}} />);
    const btn = screen.getByTestId('payment-submit-btn') as HTMLButtonElement;
    expect(btn).toBeDisabled();
  });
});
