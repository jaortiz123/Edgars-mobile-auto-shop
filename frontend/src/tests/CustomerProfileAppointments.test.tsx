import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@test-utils';
import userEvent from '@testing-library/user-event';
import CustomerProfilePage from '@/pages/admin/CustomerProfilePage';
import * as profileApi from '@/lib/customerProfileApi';
import { Routes, Route } from 'react-router-dom';
import type { CustomerProfileResponse } from '@/lib/customerProfileApi';

function renderWithRoute() {
  return render(
    <Routes>
      <Route path="/admin/customers/:id" element={<CustomerProfilePage />} />
    </Routes>,
    { router: { initialEntries: ['/admin/customers/c1'] } },
  );
}

const liteProfile: CustomerProfileResponse = {
  customer: { id: 'c1', name: 'Test User', phone: null, email: null, isVip: false, createdAt: null, updatedAt: null },
  vehicles: [],
  appointments: [
    { id: 'a1', status: 'SCHEDULED', start: '2025-07-15T10:00:00.000Z', end: null, totalAmount: 150, paidAmount: 0, checkInAt: null, checkOutAt: null, vehicle: { year: 2021, make: 'Toyota', model: 'RAV4', plate: 'ABC123' } },
    { id: 'a2', status: 'COMPLETED', start: '2025-07-16T12:00:00.000Z', end: null, totalAmount: 300.5, paidAmount: 300.5, checkInAt: null, checkOutAt: null, vehicle: { make: 'Honda', model: 'Civic', plate: 'XYZ999' } },
  ],
  metrics: {
    totalSpent: 450.5,
    unpaidBalance: 150,
    visitsCount: 2,
    completedCount: 1,
    avgTicket: 225.25,
    lastServiceAt: null,
    lastVisitAt: null,
    last12MonthsSpent: 450.5,
    last12MonthsVisits: 2,
    vehiclesCount: 0,
    isVip: false,
    isOverdueForService: false,
  },
  includes: [],
};

const detailedProfile: CustomerProfileResponse = {
  ...liteProfile,
  appointments: [
    {
      ...liteProfile.appointments[0],
      services: [ { id: 's1', name: 'Oil Change', estimated_price: 50 } ],
      payments: [ { id: 'p1', method: 'card', amount: 100 } ],
      messages: [ { id: 'm1', channel: 'sms', body: 'Reminder sent' } ],
    },
    { ...liteProfile.appointments[1], services: [], payments: [], messages: [] }
  ],
  includes: ['appointmentDetails']
};

describe('CustomerProfilePage Appointment History (details + expansion)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not expand rows when details not loaded', async () => {
    vi.spyOn(profileApi, 'fetchCustomerProfile').mockResolvedValue(liteProfile);
    renderWithRoute();
    await screen.findByTestId('appointments-table');
    const row = screen.getAllByTestId('appointment-row')[0];
    await userEvent.click(row);
    expect(screen.queryByTestId('appointment-details-row-a1')).toBeNull();
  });

  it('re-fetches with include details when toggle enabled', async () => {
    const spy = vi.spyOn(profileApi, 'fetchCustomerProfile')
      .mockResolvedValueOnce(liteProfile)
      .mockResolvedValueOnce(detailedProfile);
    renderWithRoute();
    await screen.findByTestId('appointments-table');
    await userEvent.click(screen.getByTestId('toggle-show-details'));
    expect(spy).toHaveBeenCalledTimes(2);
    const secondCallArgs = spy.mock.calls[1];
    expect(secondCallArgs[1]).toMatchObject({ includeDetails: true });
  });

  it('expands and collapses a row showing loaded services/messages', async () => {
    vi.spyOn(profileApi, 'fetchCustomerProfile')
      .mockResolvedValueOnce(liteProfile)
      .mockResolvedValueOnce(detailedProfile);
    renderWithRoute();
    await screen.findByTestId('appointments-table');
    await userEvent.click(screen.getByTestId('toggle-show-details'));
    const viewBtn = await screen.findByTestId('appt-view-a1');
    await userEvent.click(viewBtn);
    const service = await screen.findByTestId('appt-service-a1-0');
    expect(service).toHaveTextContent(/Oil Change/);
    await userEvent.click(viewBtn);
    expect(screen.queryByTestId('appointment-details-row-a1')).toBeNull();
  });
});
