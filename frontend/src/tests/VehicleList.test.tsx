import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VehicleList from '@/components/customer/VehicleList';
import type { CustomerProfileResponse } from '@/lib/customerProfileApi';

const vehicles: CustomerProfileResponse['vehicles'] = [
  { id: 'v1', year: 2021, make: 'Toyota', model: 'RAV4', plate: 'ABC123', visits: 4, totalSpent: 850.75 },
  { id: 'v2', year: 2019, make: 'Honda', model: 'Civic', plate: 'XYZ789', visits: 2, totalSpent: 200 },
];

describe('VehicleList', () => {
  it('renders vehicles with label, plate, visits and spend', () => {
    render(<VehicleList vehicles={vehicles} />);
    const items = screen.getAllByTestId('vehicle-item');
    expect(items).toHaveLength(2);
    expect(screen.getAllByTestId('vehicle-label')[0]).toHaveTextContent('2021 Toyota RAV4');
    expect(screen.getAllByTestId('vehicle-plate')[0]).toHaveTextContent('ABC123');
    expect(screen.getAllByTestId('vehicle-visits')[0]).toHaveTextContent(/Visits: 4/);
    expect(screen.getAllByTestId('vehicle-totalSpent')[0]).toHaveTextContent(/\$850.75/);
  });

  it('renders placeholder when empty', () => {
    render(<VehicleList vehicles={[]} />);
    expect(screen.getByTestId('vehicle-list-empty')).toBeInTheDocument();
  });

  it('fires callback when view history clicked', async () => {
    const onView = vi.fn();
    render(<VehicleList vehicles={vehicles} onViewHistory={onView} />);
    const btn = screen.getAllByTestId('vehicle-view-history-btn')[0];
    await userEvent.click(btn);
    expect(onView).toHaveBeenCalledWith('v1');
  });
});
