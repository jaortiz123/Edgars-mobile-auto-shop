import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomersPage from '@/pages/admin/CustomersPage';

// Utility: wait for debounce delay (300ms + buffer) inside act
const advanceDebounce = async () => {
  await act(async () => { await new Promise(res => setTimeout(res, 320)); });
};

describe('CustomersPage (Phase 1)', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  const user = userEvent.setup();

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('Initial State: shows prompt and no customer cards', () => {
    render(<CustomersPage />);
    expect(screen.getByTestId('customers-initial')).toBeInTheDocument();
    expect(screen.queryByTestId(/customer-card-/)).not.toBeInTheDocument();
  });

  it('Loading State: shows loading indicator during fetch', async () => {
    // Create a fetch promise we can resolve later
    let resolveFetch: (v: unknown) => void;
    // @ts-expect-error test shim
    global.fetch.mockReturnValue(new Promise(res => { resolveFetch = res; }));
    render(<CustomersPage />);
  const input = screen.getByTestId('customers-search') as HTMLInputElement;
  await act(async () => { await user.type(input, 'alice'); });
    await advanceDebounce();
    // Loading indicator should appear before we resolve
    expect(screen.getByTestId('customers-loading')).toBeInTheDocument();
    // Resolve fetch with empty result shape
    resolveFetch!({ json: async () => ({ data: { items: [] } }) });
  // Flush microtasks
  await Promise.resolve();
  });

  it('Results State: renders customer cards with correct data', async () => {
    // Mock two distinct customers
    const items = [
      { vehicleId: 'v1', customerId: 'c1', name: 'Alice A', phone: '555-1111', visitsCount: 3, lastVisit: null },
      { vehicleId: 'v2', customerId: 'c2', name: 'Bob B', email: 'bob@example.com', visitsCount: 1, lastVisit: null }
    ];
    // @ts-expect-error test shim
    global.fetch.mockResolvedValue({ json: async () => ({ data: { items } }) });
    render(<CustomersPage />);
  const input = screen.getByTestId('customers-search') as HTMLInputElement;
  await act(async () => { await user.type(input, 'ab'); });
    await advanceDebounce();
    const grid = await screen.findByTestId('customers-results-grid');
    const cards = within(grid).getAllByTestId(/customer-card-/);
    expect(cards.length).toBe(2);
    expect(within(cards[0]).getByTestId('customer-name').textContent).toContain('Alice');
    expect(within(cards[1]).getByTestId('customer-name').textContent).toContain('Bob');
  });

  it('No Results State: shows empty message when no customers', async () => {
    // @ts-expect-error test shim
    global.fetch.mockResolvedValue({ json: async () => ({ data: { items: [] } }) });
    render(<CustomersPage />);
  const input = screen.getByTestId('customers-search') as HTMLInputElement;
  await act(async () => { await user.type(input, 'zzz'); });
    await advanceDebounce();
    expect(await screen.findByTestId('customers-empty')).toBeInTheDocument();
  });

  it('Error State: shows error message when fetch fails', async () => {
    // @ts-expect-error test shim
    global.fetch.mockRejectedValue(new Error('Network fail'));
    render(<CustomersPage />);
  const input = screen.getByTestId('customers-search') as HTMLInputElement;
  await act(async () => { await user.type(input, 'err'); });
    await advanceDebounce();
    expect(await screen.findByTestId('customers-error')).toHaveTextContent(/Network fail|Search failed/);
  });

  it('Grouping Logic: multiple vehicles for one customer collapse into one card', async () => {
    const items = [
      { vehicleId: 'v1', customerId: 'c1', name: 'Alice A', phone: '555-1111', visitsCount: 2, lastVisit: null, plate: 'ABC123', vehicle: 'Honda Civic' },
      { vehicleId: 'v2', customerId: 'c1', name: 'Alice A', phone: '555-1111', visitsCount: 5, lastVisit: null, plate: 'XYZ789', vehicle: 'Toyota Camry' }
    ];
    // @ts-expect-error test shim
    global.fetch.mockResolvedValue({ json: async () => ({ data: { items } }) });
    render(<CustomersPage />);
  const input = screen.getByTestId('customers-search') as HTMLInputElement;
  await act(async () => { await user.type(input, 'alice'); });
    await advanceDebounce();
    const grid = await screen.findByTestId('customers-results-grid');
    const cards = within(grid).getAllByTestId(/customer-card-/);
    expect(cards.length).toBe(1); // single card
    // Inside that card there should be 2 vehicles rendered
    const vehicles = within(cards[0]).getAllByTestId('customer-vehicle');
    expect(vehicles.length).toBe(2);
  });
});
