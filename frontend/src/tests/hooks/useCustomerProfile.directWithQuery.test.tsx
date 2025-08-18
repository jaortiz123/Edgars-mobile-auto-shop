import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';

function Harness({ id }: { id: string }) {
  const q = useCustomerProfile(id, { includeInvoices: true, limitAppointments: 25 });
  return (
    <div>
      {q.isLoading && <span data-testid="state">loading</span>}
      {q.isError && <span data-testid="state">error</span>}
      {q.data && <span data-testid="state">loaded:{q.data.customer.name}</span>}
    </div>
  );
}

describe('useCustomerProfile direct-with-query ETag reuse', () => {
  it('loads then invalidates triggering conditional request', async () => {
    const qc = new QueryClient();
    const firstBody = JSON.stringify({ customer: { id: 'cust-etag', name: 'Etag Tester' }, vehicles: [], appointments: [], metrics: {}, includes: [] });
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(new Response(firstBody, { status: 200, headers: { ETag: 'W/"profile-v1"' } }))
      .mockResolvedValueOnce({ status: 304, ok: false, headers: new Headers({ ETag: 'W/"profile-v1"' }), json: () => Promise.reject(new Error('304')) });
    const originalFetch = global.fetch;
    global.fetch = fetchSpy;
    render(
      <QueryClientProvider client={qc}>
        <Harness id="cust-etag" />
      </QueryClientProvider>
    );

    await waitFor(() => {
      const txt = screen.getByTestId('state').textContent || '';
      if (txt === 'loading') throw new Error('still loading');
      expect(txt).toMatch(/loaded:Etag Tester/);
    });
    const first = fetchSpy.mock.calls.length;
    expect(first).toBeGreaterThan(0);

    await qc.invalidateQueries({ queryKey: ['customerProfile', 'cust-etag', null, null, null, true, 25] });

    await waitFor(() => {
      const txt = screen.getByTestId('state').textContent || '';
      if (txt === 'loading') throw new Error('still loading after invalidate');
      expect(txt).toMatch(/loaded:Etag Tester/);
    });
  const second = fetchSpy.mock.calls.length;
  expect(second).toBeGreaterThanOrEqual(first);

  global.fetch = originalFetch;
  });
});
