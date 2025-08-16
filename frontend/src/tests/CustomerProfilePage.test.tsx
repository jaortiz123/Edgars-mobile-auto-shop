import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Module under test
import CustomerProfilePage from '@/pages/admin/CustomerProfilePage';
import * as profileApi from '@/lib/customerProfileApi';

function renderWithRoute(path = '/admin/customers/cust-1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/customers/:id" element={<CustomerProfilePage />} />
      </Routes>
    </MemoryRouter>
  );
}

const baseProfile: profileApi.CustomerProfileResponse = {
  customer: { id: 'cust-1', name: 'Alice Cooper', phone: '555', email: 'a@example.com', isVip: false, createdAt: null, updatedAt: null },
  vehicles: [{ id: 'veh-1', plate: 'ABC123', make: 'Honda', model: 'Civic', year: 2020, visits: 3, totalSpent: 200 }],
  appointments: [],
  metrics: {
    totalSpent: 200,
    unpaidBalance: 0,
    visitsCount: 3,
    completedCount: 2,
    avgTicket: 100,
    lastServiceAt: null,
    lastVisitAt: null,
    last12MonthsSpent: 200,
    last12MonthsVisits: 3,
    vehiclesCount: 1,
    isVip: false,
    isOverdueForService: false,
  },
  includes: [],
};

describe('CustomerProfilePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('Loading State: shows loading indicator while fetching', async () => {
    let resolveFn: (v: profileApi.CustomerProfileResponse) => void;
    const pending = new Promise<profileApi.CustomerProfileResponse>(res => { resolveFn = res; });
    vi.spyOn(profileApi, 'fetchCustomerProfile').mockReturnValue(pending);
    renderWithRoute();
    expect(screen.getByTestId('customer-profile-loading')).toBeInTheDocument();
    // resolve to avoid unhandled promise
    resolveFn!(baseProfile);
  });

  it('Success State: renders customer name on success', async () => {
    vi.spyOn(profileApi, 'fetchCustomerProfile').mockResolvedValue(baseProfile);
    renderWithRoute();
    const heading = await screen.findByTestId('customer-profile-name');
    expect(heading).toHaveTextContent('Alice Cooper');
  });

  it('Error State: displays error message when API fails', async () => {
    vi.spyOn(profileApi, 'fetchCustomerProfile').mockRejectedValue(new Error('Server exploded'));
    renderWithRoute();
    const err = await screen.findByTestId('customer-profile-error');
    expect(err).toHaveTextContent(/Server exploded/);
  });

  it('Not Found State: shows specific message when customer missing', async () => {
    vi.spyOn(profileApi, 'fetchCustomerProfile').mockRejectedValue(new Error('Customer not found'));
    renderWithRoute('/admin/customers/missing');
    const err = await screen.findByTestId('customer-profile-error');
    expect(err).toHaveTextContent(/Customer not found/);
  });
});
