import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, within, waitFor } from '@test-utils';
import { setupUser } from '@/tests/testUtils/userEventHelper';
import CustomersPage from '@/pages/admin/CustomersPage';
import { Route, Routes, useLocation } from 'react-router-dom';
import * as api from '@/lib/api';

// NOTE: We deliberately avoid manual setTimeout debounce flushing. Instead we rely on
// findBy* queries (auto act-wrapped) to await the async debounce + fetch cycle.

function renderWithRouter(ui: React.ReactNode, initialEntries: string[] = ['/admin/customers']) {
  return render(ui, { router: { initialEntries } });
}
describe('CustomersPage (Phase 1)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn();
    // Default mock for recent customers API helper
    vi.spyOn(api, 'fetchRecentCustomers').mockResolvedValue([
      {
        customerId: 'rc1', name: 'Recent One', phone: '111', email: undefined,
        latestAppointmentId: 'a1', latestAppointmentAt: null, latestStatus: 'COMPLETED',
        vehicles: [{ vehicleId: 'rv1', plate: 'AAA111', vehicle: 'Honda Civic' }], totalSpent: 123.45
      }
    ]);
  });
  const user = setupUser();

  // Per-test cleanup removed; global afterEach handles timers & mocks.

  it('Initial State: shows prompt and recent customers section', async () => {
  // Use real timers for initial mount sequence to allow any internal setTimeout to flush naturally
  vi.useRealTimers();
  renderWithRouter(<CustomersPage />);
  expect(screen.getByTestId('customers-initial')).toBeInTheDocument();
  // Await async recent customers load and settle
  const recentSection = await screen.findByTestId('recent-customers-section');
  expect(recentSection).toBeInTheDocument();
  await screen.findByTestId('customer-card-rc1');
  await waitFor(() => expect(screen.queryByTestId('customers-loading')).toBeNull());
  // Also confirm generic progress indicator role (if present) is gone
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('Loading State: shows loading indicator during fetch', async () => {
    // Create a fetch promise we can resolve later
    let resolveFetch: (v: unknown) => void;
    // @ts-expect-error test shim
    global.fetch.mockReturnValue(new Promise(res => { resolveFetch = res; }));
  renderWithRouter(<CustomersPage />);
  const input = screen.getByTestId('customers-search') as HTMLInputElement;
  await user.type(input, 'alice');
    // Await loading indicator (ensures debounce elapsed and fetch started)
  await screen.findByTestId('customers-loading');
  expect(screen.getByTestId('customers-loading')).toBeInTheDocument();
    // Resolve fetch with empty result shape
  resolveFetch!({ json: async () => ({ data: { items: [] } }) });
  await waitFor(() => expect(screen.queryByTestId('customers-loading')).toBeNull());
  });

  it('Recent Customers: hides section once user searches', async () => {
    // @ts-expect-error test shim for search fetch
    global.fetch.mockResolvedValue({ json: async () => ({ data: { items: [] } }) });
  renderWithRouter(<CustomersPage />);
    await screen.findByTestId('recent-customers-section');
  const input = screen.getByTestId('customers-search') as HTMLInputElement;
  await user.type(input, 'abc');
  const empty = await screen.findByTestId('customers-empty');
  expect(empty).toBeInTheDocument();
  expect(screen.queryByTestId('recent-customers-section')).not.toBeInTheDocument();
  });

  it('Recent Customers: empty state shows when API returns none', async () => {
    (api.fetchRecentCustomers as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
  // Use real timers to avoid act warnings tied to delayed state updates in empty recent customers path
  vi.useRealTimers();
  renderWithRouter(<CustomersPage />);
  expect(await screen.findByTestId('recent-customers-empty')).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByTestId('customers-loading')).toBeNull());
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('Results State: renders customer cards with correct data', async () => {
    // Mock two distinct customers
    const items = [
      { vehicleId: 'v1', customerId: 'c1', name: 'Alice A', phone: '555-1111', visitsCount: 3, lastVisit: null },
      { vehicleId: 'v2', customerId: 'c2', name: 'Bob B', email: 'bob@example.com', visitsCount: 1, lastVisit: null }
    ];
    // @ts-expect-error test shim
    global.fetch.mockResolvedValue({ json: async () => ({ data: { items } }) });
  renderWithRouter(<CustomersPage />);
  const input = screen.getByTestId('customers-search') as HTMLInputElement;
  await user.type(input, 'ab');
    const grid = await screen.findByTestId('customers-results-grid');
    const cards = within(grid).getAllByTestId(/customer-card-/);
    expect(cards.length).toBe(2);
    expect(within(cards[0]).getByTestId('customer-name').textContent).toContain('Alice');
    expect(within(cards[1]).getByTestId('customer-name').textContent).toContain('Bob');
  });

  it('No Results State: shows empty message when no customers', async () => {
    // @ts-expect-error test shim
    global.fetch.mockResolvedValue({ json: async () => ({ data: { items: [] } }) });
  renderWithRouter(<CustomersPage />);
  const input = screen.getByTestId('customers-search') as HTMLInputElement;
  await user.type(input, 'zzz');
    expect(await screen.findByTestId('customers-empty')).toBeInTheDocument();
  });

  it('Error State: shows error message when fetch fails', async () => {
    // @ts-expect-error test shim
    global.fetch.mockRejectedValue(new Error('Network fail'));
  renderWithRouter(<CustomersPage />);
  const input = screen.getByTestId('customers-search') as HTMLInputElement;
  await user.type(input, 'err');
    expect(await screen.findByTestId('customers-error')).toHaveTextContent(/Network fail|Search failed/);
  });

  it('Grouping Logic: multiple vehicles for one customer collapse into one card', async () => {
    const items = [
      { vehicleId: 'v1', customerId: 'c1', name: 'Alice A', phone: '555-1111', visitsCount: 2, lastVisit: null, plate: 'ABC123', vehicle: 'Honda Civic' },
      { vehicleId: 'v2', customerId: 'c1', name: 'Alice A', phone: '555-1111', visitsCount: 5, lastVisit: null, plate: 'XYZ789', vehicle: 'Toyota Camry' }
    ];
    // @ts-expect-error test shim
    global.fetch.mockResolvedValue({ json: async () => ({ data: { items } }) });
  renderWithRouter(<CustomersPage />);
  const input = screen.getByTestId('customers-search') as HTMLInputElement;
  await user.type(input, 'alice');
    await screen.findByTestId('customers-results-grid');
    const grid = await screen.findByTestId('customers-results-grid');
    const cards = within(grid).getAllByTestId(/customer-card-/);
    expect(cards.length).toBe(1); // single card
    // Inside that card there should be 2 vehicles rendered
    const vehicles = within(cards[0]).getAllByTestId('customer-vehicle');
    expect(vehicles.length).toBe(2);
  });

  it('Navigation: View Full History navigates to /admin/customers/:id', async () => {
    const items = [
      { vehicleId: 'v1', customerId: 'c9', name: 'Nav Test', phone: '555-9999', visitsCount: 1, lastVisit: null }
    ];
    // @ts-expect-error test shim
    global.fetch.mockResolvedValue({ json: async () => ({ data: { items } }) });

    // Helper component to expose current path
    function PathCapture() { const loc = useLocation(); return <div data-testid="current-path">{loc.pathname}</div>; }
    render(
      <Routes>
        <Route path="/admin/customers" element={<><PathCapture /><CustomersPage /></>} />
        <Route path="/admin/customers/:id" element={<div data-testid='customer-history-page'>History Page</div>} />
      </Routes>,
      { router: { initialEntries: ['/admin/customers'] } },
    );
    const input = screen.getByTestId('customers-search') as HTMLInputElement;
  await user.type(input, 'nav');
  await screen.findByTestId('customer-card-c9');
  const card = await screen.findByTestId('customer-card-c9');
  // Use accessible role+name to target the View Full History button reliably
  const viewBtn = within(card).getByRole('button', { name: /view full history/i });
    await user.click(viewBtn);
    expect(await screen.findByTestId('customer-history-page')).toBeInTheDocument();
  });

  it('Filter Chips: selecting VIP appends filter parameter to request', async () => {
    // Track fetch calls
    const items = [
      { vehicleId: 'v1', customerId: 'c1', name: 'Vip Test', phone: '555', visitsCount: 1, lastVisit: null, plate: 'VIP1' }
    ];
    // @ts-expect-error test shim
    global.fetch.mockResolvedValue({ json: async () => ({ data: { items } }) });
  renderWithRouter(<CustomersPage />);
    const input = screen.getByTestId('customers-search') as HTMLInputElement;
    await user.type(input, 'vip');
  await screen.findByTestId('customers-results-grid');
    // Ensure baseline call happened
  const fetchMock = global.fetch as unknown as Mock;
  expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    // Click VIP chip
    const vipChip = await screen.findByTestId('filter-chip-vip');
    await user.click(vipChip);
    // Latest call should include filter=vip
  const urls = fetchMock.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(urls.some((u: string) => /filter=vip/.test(u))).toBe(true);
  });

  it('Sorting: changing dropdown triggers refetch with sortBy parameter', async () => {
    // First search baseline
    // @ts-expect-error test shim
    global.fetch.mockResolvedValue({ json: async () => ({ data: { items: [] } }) });
  renderWithRouter(<CustomersPage />);
    const input = screen.getByTestId('customers-search') as HTMLInputElement;
    await user.type(input, 'plate');
    // Empty result possible; wait on either grid or empty; prefer empty state assertion
    const empty = await screen.findByTestId('customers-empty');
    expect(empty).toBeInTheDocument();
    const fetchMock = global.fetch as unknown as Mock;
    const initialCallCount = fetchMock.mock.calls.length;
    // Change sorting to Name A-Z (no explicit param for relevance, so selecting a non-default should append)
    const select = await screen.findByTestId('customers-sort-select');
    await user.selectOptions(select, 'name_asc');
    // Ensure new call happened
    expect(fetchMock.mock.calls.length).toBeGreaterThan(initialCallCount);
    const urls = fetchMock.mock.calls.map(c => c[0] as string);
    expect(urls.some(u => /sortBy=name_asc/.test(u))).toBe(true);
    // Switch to Highest Lifetime Spend
    await user.selectOptions(select, 'highest_lifetime_spend');
    const urls2 = (global.fetch as unknown as Mock).mock.calls.map(c => c[0] as string);
    expect(urls2.some(u => /sortBy=highest_lifetime_spend/.test(u))).toBe(true);
  });
});
