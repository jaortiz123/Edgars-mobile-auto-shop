import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AppointmentHistory from '@/components/customer/AppointmentHistory';
import type { CustomerProfileResponse } from '@/lib/customerProfileApi';

const appts: CustomerProfileResponse['appointments'] = [
  { id: 'a1', status: 'SCHEDULED', start: '2025-07-15T10:00:00.000Z', end: null, totalAmount: 150, paidAmount: 0, checkInAt: null, checkOutAt: null, vehicle: { year: 2021, make: 'Toyota', model: 'RAV4', plate: 'ABC123' } },
  { id: 'a2', status: 'COMPLETED', start: '2025-07-16T12:00:00.000Z', end: null, totalAmount: 300.5, paidAmount: 300.5, checkInAt: null, checkOutAt: null, vehicle: { make: 'Honda', model: 'Civic', plate: 'XYZ999' } },
];

describe('AppointmentHistory', () => {
  it('renders rows with correct cells', () => {
    render(<AppointmentHistory appointments={appts} />);
    const rows = screen.getAllByTestId('appointment-row');
    expect(rows).toHaveLength(2);
    expect(screen.getByTestId('appt-status-a1')).toHaveTextContent('SCHEDULED');
    expect(screen.getByTestId('appt-total-a2')).toHaveTextContent(/\$300.50/);
  });

  it('shows empty state when no appointments', () => {
    render(<AppointmentHistory appointments={[]} />);
    expect(screen.getByTestId('appointments-empty')).toBeInTheDocument();
  });
});
