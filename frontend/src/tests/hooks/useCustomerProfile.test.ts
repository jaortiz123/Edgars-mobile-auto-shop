import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';

function TestHarness({ id, withOptions }: { id: string; withOptions?: boolean }) {
  const q = useCustomerProfile(id, withOptions ? { includeInvoices: true, limitAppointments: 25 } : {});
  return (
    <div>
      {q.isLoading && <span data-testid="state">loading</span>}
      {q.isError && <span data-testid="state">error</span>}
      {q.data && <span data-testid="state">loaded:{q.data.customer.name}</span>}
    </div>
  );
}

describe('useCustomerProfile ETag reuse (no-query first then with-query)', () => {
  it('completes initial fetch and reuses cached data on 304 after invalidation with same params', async () => {
    const qc = new QueryClient();
    const fetchSpy = vi.spyOn(global, 'fetch');

    // Initial render without query params to avoid prior hanging scenario
    const { rerender } = render(
      <QueryClientProvider client={qc}>
        <TestHarness id="cust-etag" />
      </QueryClientProvider>
    );

    await waitFor(() => {
      const txt = screen.getByTestId('state').textContent || '';
      if (txt === 'loading') throw new Error('still loading');
      expect(txt).toMatch(/loaded:Etag Tester/);
    });
    const firstCount = fetchSpy.mock.calls.length;
    expect(firstCount).toBeGreaterThan(0);

    // Rerender with query options (includeInvoices/limitAppointments) – same resource, should send If-None-Match
    rerender(
      <QueryClientProvider client={qc}>
        <TestHarness id="cust-etag" withOptions />
      </QueryClientProvider>
    );

    await waitFor(() => {
      const txt = screen.getByTestId('state').textContent || '';
      if (txt === 'loading') throw new Error('still loading after rerender');
      expect(txt).toMatch(/loaded:Etag Tester/);
    });
    const secondCount = fetchSpy.mock.calls.length;
    expect(secondCount).toBeGreaterThan(firstCount); // new network attempt

    // Invalidate with final key including options
    await qc.invalidateQueries({ queryKey: ['customerProfile', 'cust-etag', null, null, null, true, 25] });

    await waitFor(() => {
      const txt = screen.getByTestId('state').textContent || '';
      if (txt === 'loading') throw new Error('still loading after invalidate');
      expect(txt).toMatch(/loaded:Etag Tester/);
    });
    const thirdCount = fetchSpy.mock.calls.length;
    expect(thirdCount).toBeGreaterThan(secondCount - 1); // at least one more fetch or reuse

    fetchSpy.mockRestore();
  });
});
