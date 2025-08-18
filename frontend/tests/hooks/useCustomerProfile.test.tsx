import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { vi } from 'vitest';
import React from 'react';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const base = {
  customer: { id: 'c1', full_name: 'Ada', created_at: '2025-01-01T00:00:00Z' },
  stats: { lifetime_spend: 100, unpaid_balance: 0, total_visits: 1, last_visit_at: '2025-01-02T00:00:00Z' },
  vehicles: [],
  appointments: [],
  page: { page_size: 25, has_more: false, next_cursor: null },
};

it('handles cached reuse on simulated 304 (second call returns 200 identical body due to jsdom limitation)', async () => {
  const first = JSON.stringify(base);
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(first, { status: 200, headers: { 'ETag': 'W/"abc"' } }))
    // second call returns a minimal 304 stub (cannot use Response constructor for 304 in jsdom)
    .mockResolvedValueOnce({
      status: 304,
      ok: false,
      headers: new Headers({ 'ETag': 'W/"abc"' }),
      json: () => Promise.reject(new Error('should not be called for 304')),
    });
  // override global fetch for this test
  Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true });
  const { result } = renderHook(() => useCustomerProfile('c1'), { wrapper });
  await waitFor(() => expect(result.current.data?.customer?.id).toBe('c1'));
  await result.current.refetch();
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(result.current.data?.customer?.full_name).toBe('Ada'));
});
