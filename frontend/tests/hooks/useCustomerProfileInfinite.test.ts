import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCustomerProfileInfinite } from '@/hooks/useCustomerProfileInfinite';
import type { CustomerProfile } from '@/types/customerProfile';
import { vi, beforeEach, it, expect } from 'vitest';
import React from 'react';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

const p1: CustomerProfile = {
  customer: { id: 'c1', full_name: 'Ada', created_at: '2025-01-01T00:00:00Z' },
  stats: { lifetime_spend: 0, unpaid_balance: 0, total_visits: 0, last_visit_at: null, avg_ticket: 0, last_service_at: null },
  vehicles: [],
  appointments: [{ id: 'a1', vehicle_id: 'v1', scheduled_at: '2025-07-01T00:00:00Z', status: 'COMPLETED', services: [], invoice: null }],
  page: { page_size: 1, has_more: true, next_cursor: 'CUR2' }
};

const p2: CustomerProfile = {
  customer: { id: 'c1', full_name: 'Ada', created_at: '2025-01-01T00:00:00Z' },
  stats: { lifetime_spend: 0, unpaid_balance: 0, total_visits: 0, last_visit_at: null, avg_ticket: 0, last_service_at: null },
  vehicles: [],
  appointments: [{ id: 'a0', vehicle_id: 'v1', scheduled_at: '2025-06-01T00:00:00Z', status: 'COMPLETED', services: [], invoice: null }],
  page: { page_size: 1, has_more: false, next_cursor: null }
};

beforeEach(() => {
  // mock fetch for two sequential pages
  const fetchMock = vi
    .fn()
    .mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify(p1), { status: 200 })))
    .mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify(p2), { status: 200 })));
  Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true });
});

it('paginates and appends without duplicates', async () => {
  const { result } = renderHook(() => useCustomerProfileInfinite('c1', { pageSize: 1 }), { wrapper });
  await waitFor(() => expect(result.current.data?.pages?.[0]?.appointments?.length).toBe(1));
  await result.current.fetchNextPage();
  await waitFor(() => {
    const all = result.current.data?.pages?.flatMap((p: CustomerProfile) => p.appointments) || [];
    expect(all.map((a: { id: string }) => a.id)).toEqual(['a1','a0']);
  });
});
