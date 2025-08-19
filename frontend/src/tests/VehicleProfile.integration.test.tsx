import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import VehicleProfilePage from '@/pages/admin/VehicleProfilePage';
// Local deterministic fetch stub (avoids dependency on global MSW enhancedHandlers which lack this endpoint currently)
let originalFetch: typeof fetch;
const stableEtag = 'W/"veh-stub-etag"';
const dataset = Array.from({ length: 12 }).map((_, i) => ({
  id: `stub-row-${i+1}`,
  occurred_at: new Date(Date.now() - i * 60000).toISOString(),
  status: 'COMPLETED',
  services: [{ name: 'Oil Change' }],
  invoice: { total: 100 + i, paid: 100 + i, unpaid: 0 },
}));
beforeEach(() => {
  originalFetch = global.fetch;
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.startsWith('/api/admin/vehicles/') && url.includes('/profile')) {
      const u = new URL(url, 'http://localhost');
      const pageSize = Number(u.searchParams.get('page_size') || '5');
      const cursor = u.searchParams.get('cursor');
  // cursor corresponds to last item id from previous page (production style)
  const start = cursor ? (dataset.findIndex(r => r.id === cursor) + 1) : 0;
  const slice = dataset.slice(start, start + pageSize);
  const next = (start + pageSize) < dataset.length ? slice[slice.length - 1].id : null;
      const ifNoneMatch = init?.headers && (init.headers as Record<string,string>)['If-None-Match'];
      if (ifNoneMatch && ifNoneMatch === stableEtag) {
        return new Response(null, { status: 304, headers: { ETag: stableEtag } });
      }
      const body = JSON.stringify({
        header: { vehicle_id: 'veh-1', year: 2020, make: 'Honda', model: 'Civic', vin: 'VINMOCK' },
        stats: { lifetime_spend: 1234, total_visits: dataset.length, last_service_at: dataset[0].occurred_at, avg_ticket: 150 },
        timeline: slice,
        page: { next_cursor: next },
        etag: stableEtag,
      });
      return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json', ETag: stableEtag } });
    }
  return originalFetch(input as unknown as RequestInfo, init);
  }) as typeof fetch;
});
afterEach(() => { global.fetch = originalFetch; });


function renderPage(path: string) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/vehicles/:id" element={<VehicleProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('VehicleProfile Integration', () => {
  it('Pagination: loads first page then appends next page on Load More', async () => {
    renderPage('/admin/vehicles/veh-1?page_size=5');
    await screen.findByText(/Vehicle Profile/);
    // First page should eventually show 5 rows
    await waitFor(() => expect(screen.getAllByTestId('timeline-row').length).toBe(5));
    const initialRows = screen.getAllByTestId('timeline-row');
    expect(initialRows.length).toBe(5);
    // Load more
    const btn = await screen.findByRole('button', { name: /Load more/i });
    await userEvent.click(btn);
    await waitFor(() => expect(screen.getAllByTestId('timeline-row').length).toBe(10));
    // Validate appended not replaced
    const rows = screen.getAllByTestId('timeline-row');
    expect(rows.length).toBe(10);
  });

  it('ETag 304 reuse: second refetch with unchanged etag does not clear data', async () => {
    renderPage('/admin/vehicles/veh-1?page_size=5');
    await waitFor(() => expect(screen.getAllByTestId('timeline-row').length).toBe(5));
    const firstIds = screen.getAllByTestId('timeline-row').map(r => r.textContent);
    // Simulate focus refetch (react-query may refetch on window focus by default)
    window.dispatchEvent(new Event('focus'));
    await new Promise(r => setTimeout(r, 50));
    const afterIds = screen.getAllByTestId('timeline-row').map(r => r.textContent);
    expect(afterIds).toEqual(firstIds); // unchanged
  });
});
