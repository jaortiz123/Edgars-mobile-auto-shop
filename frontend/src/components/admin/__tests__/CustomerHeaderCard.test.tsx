import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CustomerHeaderCard } from '@/components/admin/CustomerHeaderCard';

const mockCustomer = {
  id: 'test-customer-1',
  name: 'John Doe',
  phone: '(555) 123-4567',
  email: 'john.doe@example.com',
  isVip: true,
  createdAt: '2022-01-15T10:00:00Z',
  updatedAt: null,
  customerSince: '2022-01-15T10:00:00Z',
  relationshipDurationDays: 365,
  preferredContactMethod: 'phone',
  preferredContactTime: 'morning',
  tags: ['Loyal Customer', 'Fleet Owner'],
  notes: 'Prefers early morning appointments and SMS reminders.',
};

const mockMetrics = {
  totalSpent: 5432.10,
  unpaidBalance: 0,
  visitsCount: 12,
  completedCount: 11,
  avgTicket: 452.68,
  lastServiceAt: '2024-01-10T14:30:00Z',
  lastVisitAt: '2024-01-10T14:30:00Z',
  last12MonthsSpent: 3200.00,
  last12MonthsVisits: 8,
  vehiclesCount: 2,
  isVip: true,
  isOverdueForService: false,
};

describe('CustomerHeaderCard', () => {
  it('renders customer name', () => {
    render(
      <CustomerHeaderCard
        customer={mockCustomer}
        metrics={mockMetrics}
      />
    );

    expect(screen.getByTestId('customer-name')).toHaveTextContent('John Doe');
  });

  it('displays VIP badge for VIP customers', () => {
    render(
      <CustomerHeaderCard
        customer={mockCustomer}
        metrics={mockMetrics}
      />
    );

    expect(screen.getByText('VIP')).toBeInTheDocument();
  });

  it('shows contact information', () => {
    render(
      <CustomerHeaderCard
        customer={mockCustomer}
        metrics={mockMetrics}
      />
    );

    expect(screen.getByTestId('customer-phone')).toHaveTextContent('(555) 123-4567');
    expect(screen.getByTestId('customer-email')).toHaveTextContent('john.doe@example.com');
  });

  it('displays preferred contact method badge', () => {
    render(
      <CustomerHeaderCard
        customer={mockCustomer}
        metrics={mockMetrics}
      />
    );

    expect(screen.getByTestId('preferred-contact-badge')).toHaveTextContent('Phone Preferred');
  });

  it('shows lifetime value', () => {
    render(
      <CustomerHeaderCard
        customer={mockCustomer}
        metrics={mockMetrics}
      />
    );

    expect(screen.getByTestId('lifetime-value')).toHaveTextContent('$5,432.10');
  });

  it('displays customer since date', () => {
    render(
      <CustomerHeaderCard
        customer={mockCustomer}
        metrics={mockMetrics}
      />
    );

    expect(screen.getByTestId('customer-since')).toHaveTextContent('January 15, 2022');
  });

  it('shows relationship duration', () => {
    render(
      <CustomerHeaderCard
        customer={mockCustomer}
        metrics={mockMetrics}
      />
    );

    expect(screen.getByTestId('relationship-duration')).toHaveTextContent('1 year');
  });

  it('displays customer tags', () => {
    render(
      <CustomerHeaderCard
        customer={mockCustomer}
        metrics={mockMetrics}
      />
    );

    expect(screen.getByText('Loyal Customer')).toBeInTheDocument();
    expect(screen.getByText('Fleet Owner')).toBeInTheDocument();
  });

  it('shows customer notes preview', () => {
    render(
      <CustomerHeaderCard
        customer={mockCustomer}
        metrics={mockMetrics}
      />
    );

    expect(screen.getByTestId('customer-notes')).toHaveTextContent(
      'Prefers early morning appointments and SMS reminders.'
    );
  });

  it('shows action buttons', () => {
    render(
      <CustomerHeaderCard
        customer={mockCustomer}
        metrics={mockMetrics}
      />
    );

    expect(screen.getByTestId('book-appointment-btn')).toBeInTheDocument();
    expect(screen.getByTestId('edit-customer-btn')).toBeInTheDocument();
  });

  it('displays loading state', () => {
    render(
      <CustomerHeaderCard
        customer={mockCustomer}
        metrics={mockMetrics}
        isLoading={true}
      />
    );

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('handles unpaid balance display', () => {
    const customerWithBalance = {
      ...mockCustomer,
    };
    const metricsWithBalance = {
      ...mockMetrics,
      unpaidBalance: 250.00,
    };

    render(
      <CustomerHeaderCard
        customer={customerWithBalance}
        metrics={metricsWithBalance}
      />
    );

    expect(screen.getByTestId('unpaid-balance')).toHaveTextContent('$250.00');
  });
});
