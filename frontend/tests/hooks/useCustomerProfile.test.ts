import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { vi } from 'vitest';
import React from 'react';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

const base = {
  customer: { id: 'c1', full_name: 'Ada', created_at: '2025-01-01T00:00:00Z' },
  stats: { lifetime_spend: 100, unpaid_balance: 0, total_visits: 1, last_visit_at: '2025-01-02T00:00:00Z', avg_ticket: 100, last_service_at: '2025-01-02T00:00:00Z' },
  vehicles: [],
  appointments: [],
  page: { page_size: 25, has_more: false, next_cursor: null },
};

it('handles 200 then 304 without flicker', async () => {
  const fetchMock = vi
    .fn()
    .mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(base), {
          status: 200,
          headers: { ETag: 'W/"abc"' },
        }),
      ),
    )
    .mockImplementationOnce(() =>
      Promise.resolve(
        new Response(null, {
          status: 304,
          headers: { ETag: 'W/"abc"' },
        }),
      ),
    );
  Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true });

  const { result } = renderHook(() => useCustomerProfile('c1'), { wrapper });
  await waitFor(() => expect(result.current.data?.customer.id).toBe('c1'));
  // trigger a refetch explicitly
  await result.current.refetch();
  await waitFor(() => expect(result.current.data?.customer.full_name).toBe('Ada'));
});
