import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@test-utils';
import CustomerHeader from '@/components/customer/CustomerHeader';
import type { CustomerProfileResponse } from '@/lib/customerProfileApi';

const baseCustomer: CustomerProfileResponse['customer'] = {
  id: 'c1',
  name: 'Jane Driver',
  phone: '555-1000',
  email: 'jane@example.com',
  isVip: false,
  createdAt: null,
  updatedAt: null,
};

const baseMetrics: CustomerProfileResponse['metrics'] = {
  totalSpent: 0,
  unpaidBalance: 0,
  visitsCount: 0,
  completedCount: 0,
  avgTicket: 0,
  lastServiceAt: null,
  lastVisitAt: null,
  last12MonthsSpent: 0,
  last12MonthsVisits: 0,
  vehiclesCount: 0,
  isVip: false,
  isOverdueForService: false,
};

describe('CustomerHeader', () => {
  it('does not render badges when neither VIP nor Overdue', () => {
    render(<CustomerHeader customer={baseCustomer} metrics={baseMetrics} />);
    expect(screen.queryByTestId('customer-badge-vip')).toBeNull();
    expect(screen.queryByTestId('customer-badge-overdue')).toBeNull();
  });

  it('renders VIP badge when customer isVip is true', () => {
    render(<CustomerHeader customer={{ ...baseCustomer, isVip: true }} metrics={baseMetrics} />);
    const vip = screen.getByTestId('customer-badge-vip');
    expect(vip).toHaveTextContent(/VIP/);
  });

  it('renders Overdue badge when metrics.isOverdueForService is true', () => {
    render(<CustomerHeader customer={baseCustomer} metrics={{ ...baseMetrics, isOverdueForService: true }} />);
    const overdue = screen.getByTestId('customer-badge-overdue');
    expect(overdue).toHaveTextContent(/Overdue/);
  });

  it('renders both badges when both flags set', () => {
    render(<CustomerHeader customer={{ ...baseCustomer, isVip: true }} metrics={{ ...baseMetrics, isOverdueForService: true }} />);
    expect(screen.getByTestId('customer-badge-vip')).toBeInTheDocument();
    expect(screen.getByTestId('customer-badge-overdue')).toBeInTheDocument();
  });
});
