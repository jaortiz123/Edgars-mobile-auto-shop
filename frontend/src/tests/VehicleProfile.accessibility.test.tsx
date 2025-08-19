import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import VehicleProfilePage from '@/pages/admin/VehicleProfilePage';

// Local deterministic fetch stub (mirrors integration test approach) to avoid global MSW overlap.
let originalFetch: typeof fetch;
const dataset = Array.from({ length: 8 }).map((_, i) => ({
  id: `a11y-row-${i+1}`,
  occurred_at: new Date(Date.now() - i * 60000).toISOString(),
  status: 'COMPLETED',
  services: [{ name: 'Oil Change' }],
  invoice: { total: 100 + i, paid: 100 + i, unpaid: 0 },
}));
const etag = 'W/"a11y-etag"';
beforeEach(() => {
  originalFetch = global.fetch;
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.startsWith('/api/admin/vehicles/') && url.includes('/profile')) {
      const u = new URL(url, 'http://localhost');
      const pageSize = Number(u.searchParams.get('page_size') || '5');
      const cursor = u.searchParams.get('cursor');
      const start = cursor ? (dataset.findIndex(r => r.id === cursor) + 1) : 0;
      const slice = dataset.slice(start, start + pageSize);
      const next = (start + pageSize) < dataset.length ? slice[slice.length - 1].id : null;
      const ifNoneMatch = init?.headers && (init.headers as Record<string,string>)['If-None-Match'];
      if (ifNoneMatch === etag) return new Response(null, { status: 304, headers: { ETag: etag } });
      const body = JSON.stringify({
        header: { vehicle_id: 'veh-1', year: 2020, make: 'Honda', model: 'Civic', vin: 'VINMOCK' },
        stats: { lifetime_spend: 800, total_visits: dataset.length, last_service_at: dataset[0].occurred_at, avg_ticket: 140 },
        timeline: slice,
        page: { next_cursor: next },
        etag,
      });
      return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json', ETag: etag } });
    }
    return originalFetch(input as unknown as RequestInfo, init);
  }) as typeof fetch;
});
afterEach(() => { global.fetch = originalFetch; });

function renderPage() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
  <MemoryRouter initialEntries={["/admin/vehicles/veh-1?page_size=5"]}>
        <Routes>
          <Route path="/admin/vehicles/:id" element={<VehicleProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('VehicleProfile Accessibility', () => {

  it('Roving focus: Arrow keys move active row', async () => {
    renderPage();
  await screen.findByText(/Vehicle Profile/);
  const rows = await screen.findAllByTestId('timeline-row');
  // Each timeline row now contains the primary row <button> plus a separate invoice actions trigger
  // with role button when an invoice is present. We specifically want the primary row control which
  // has a tabindex attribute managed by roving. Filter accordingly.
  const candidateButtons = within(rows[0]).getAllByRole('button');
  const firstButton = candidateButtons.find(b => b.hasAttribute('tabindex'))!;
  // Focus the first row to ensure arrow keys are captured
  firstButton.focus();
  expect(firstButton).toHaveFocus();
  // First should be active initially
  expect(firstButton.getAttribute('tabindex')).toBe('0');
  await userEvent.keyboard('{ArrowDown}');
  const secondCandidates = within(rows[1]).getAllByRole('button');
  const secondButton = secondCandidates.find(b => b.hasAttribute('tabindex'))!;
  await screen.findByText(/Service History/); // ensure rerender completed
  await new Promise(r => setTimeout(r, 10));
  // Rely on aria-current transferred
  await waitFor(() => expect(secondButton).toHaveAttribute('aria-current', 'true'));
  await waitFor(() => expect(firstButton).not.toHaveAttribute('aria-current'));
  await userEvent.keyboard('{ArrowUp}');
  await waitFor(() => expect(firstButton).toHaveAttribute('aria-current', 'true'));
  await waitFor(() => expect(secondButton).not.toHaveAttribute('aria-current'));
  });
});
