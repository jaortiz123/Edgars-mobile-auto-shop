import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@test-utils';
import userEvent from '@testing-library/user-event';
import CustomerCard from '@/components/admin/CustomerCard';

describe('CustomerCard', () => {
  it('renders VIP and Overdue badges when flags true', () => {
    render(<CustomerCard customerId="c1" name="Alice" vehicles={[]} isVip isOverdueForService badges={['Recent']} />);
    const badges = screen.getAllByTestId('customer-badge').map(b => b.textContent);
    expect(badges).toEqual(expect.arrayContaining(['VIP', 'Overdue', 'Recent']));
  });

  it('formats total spent as currency', () => {
    render(<CustomerCard customerId="c2" name="Bob" vehicles={[]} totalSpent={1234.5} />);
    const spent = screen.getByTestId('customer-total-spent');
    expect(spent.textContent).toMatch(/Total Spent: \$1,234\.50/);
  });

  it('invokes Book Appointment handler when clicked', async () => {
    const user = userEvent.setup();
    const onBook = vi.fn();
    render(<CustomerCard customerId="c3" name="Carol" vehicles={[]} onBookAppointment={onBook} />);
    const btn = screen.getByTestId('customer-book-appt');
    await user.click(btn);
    expect(onBook).toHaveBeenCalledWith('c3');
  });
});
