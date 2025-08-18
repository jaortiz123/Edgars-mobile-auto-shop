import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CustomerProfilePage from '@/pages/admin/CustomerProfilePage';

// Minimal fixture pages for two-page scenario
const page1 = { customer:{id:'c1',full_name:'Ada'}, stats:{lifetime_spend:0, unpaid_balance:0, total_visits:0, last_visit_at:null}, vehicles:[], appointments:[{id:'a1', vehicle_id:'v1', scheduled_at:'2025-07-01T00:00:00Z', status:'COMPLETED', services:[{name:'Oil Change'}], invoice:null}], page:{page_size:25, has_more:true, next_cursor:'CUR2'} };
const page2 = { customer:{id:'c1',full_name:'Ada'}, stats:{lifetime_spend:0, unpaid_balance:0, total_visits:0, last_visit_at:null}, vehicles:[], appointments:[{id:'a0', vehicle_id:'v1', scheduled_at:'2025-06-01T00:00:00Z', status:'READY', services:[{name:'Brakes'}], invoice:null}], page:{page_size:25, has_more:false, next_cursor:null} };

function setup(fetchImpls: Response[]) {
  const fetchMock = vi.fn();
  fetchImpls.forEach(r => fetchMock.mockImplementationOnce(() => Promise.resolve(r)));
  Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true });
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/admin/customers/c1"]}>
        <Routes>
          <Route path="/admin/customers/:id" element={<CustomerProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return fetchMock;
}

describe('CustomerProfilePage a11y/UX', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('focus lands on heading initially', async () => {
    setup([new Response(JSON.stringify(page1), { status:200 })]);
    await screen.findByText(/Oil Change/);
    const heading = screen.getByRole('heading', { level: 1, name: /Customer Profile/i });
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.activeElement).toBe(heading);
  });

  it('roving keyboard navigation moves selection', async () => {
    const fetchMock = setup([
      new Response(JSON.stringify(page1), { status:200 }),
      new Response(JSON.stringify(page2), { status:200 })
    ]);
  (window as unknown as { __DISABLE_IDLE_PREFETCH?: boolean }).__DISABLE_IDLE_PREFETCH = true;
  await screen.findByText(/Oil Change/);
  const user = userEvent.setup();
  // Focus first item manually (user moves from heading to list)
  const firstAppt = screen.getAllByRole('button').find(b => /Oil Change/.test(b.textContent || ''))!;
  await user.click(firstAppt); // establish activeIdx=0
  // Load next page
  await user.click(screen.getByRole('button', { name: /Load more/i }));
  await screen.findByText(/Brakes/);
  // Refocus first item (user returns to list) before arrow nav
  firstAppt.focus();
  // ArrowDown should move to second item now
  await user.keyboard('{ArrowDown}');
  const secondButton = screen.getAllByRole('button').find(btn => /Brakes/.test(btn.textContent || ''))!;
  await waitFor(() => expect(secondButton).toHaveAttribute('data-active', 'true'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('live region updates count text', async () => {
    setup([
      new Response(JSON.stringify(page1), { status:200 }),
      new Response(JSON.stringify(page2), { status:200 })
    ]);
  (window as unknown as { __DISABLE_IDLE_PREFETCH?: boolean }).__DISABLE_IDLE_PREFETCH = true;
  await screen.findByText(/Oil Change/);
  const live = await screen.findByTestId('appt-live');
  // Wait for live region to reflect initial page
  expect(live.textContent).toMatch(/1 item/);
    // Trigger next page
    const user = userEvent.setup();
    const loadMore = await screen.findByRole('button', { name: /Load more/i });
    await user.click(loadMore);
    await screen.findByText(/Brakes/);
    // Live region should now show 2 items
    expect(live.textContent).toMatch(/2 items/);
  });

  it('Enter key on focused appointment triggers click handler', async () => {
    setup([new Response(JSON.stringify(page1), { status:200 })]);
    await screen.findByText(/Oil Change/);
    const firstAppt = screen.getAllByRole('button').find(b => /Oil Change/.test(b.textContent || ''))!;
    const user = userEvent.setup();
    const clickSpy = vi.spyOn(firstAppt, 'click');
    firstAppt.focus();
    await user.keyboard('{Enter}');
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
