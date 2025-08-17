import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecordPaymentModal } from '../pages/admin/RecordPaymentModal';

describe('RecordPaymentModal', () => {
  it('renders defaults and validates amount', async () => {
    const user = userEvent.setup();
    render(<RecordPaymentModal open amountDueCents={12345} invoiceStatus="PARTIALLY_PAID" onClose={() => {}} />);
    const amountInput = await screen.findByTestId('payment-amount-input') as HTMLInputElement;
    expect(amountInput.value).toBe('123.45');
    await user.clear(amountInput);
  await user.type(amountInput, '0');
  // Trigger validation via blur wrapped in act through fireEvent
  fireEvent.blur(amountInput);
  const validation = await screen.findByText(/enter a positive amount/i);
  expect(validation).toBeInTheDocument();
  });

  it('shows overpay warning when amount exceeds due', async () => {
    const user = userEvent.setup();
    render(<RecordPaymentModal open amountDueCents={5000} invoiceStatus="SENT" onClose={() => {}} />);
    const amountInput = await screen.findByTestId('payment-amount-input') as HTMLInputElement;
    await user.clear(amountInput);
  await user.type(amountInput, '60.00');
  fireEvent.blur(amountInput);
  const overpay = await screen.findByText(/exceeds amount due/i);
  expect(overpay).toBeInTheDocument();
  });

  it('disables submit when invoice PAID', () => {
    render(<RecordPaymentModal open amountDueCents={0} invoiceStatus="PAID" onClose={() => {}} />);
    const btn = screen.getByTestId('payment-submit-btn') as HTMLButtonElement;
    expect(btn).toBeDisabled();
  });
});
