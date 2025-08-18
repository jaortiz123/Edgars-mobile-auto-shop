import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function wrapper({ children }: any) {
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

it('handles 200 then 304 without flicker', async () => {
  let hits = 0;
  server.use(
    rest.get('/api/admin/customers/c1/profile', (req, res, ctx) => {
      hits++;
      if (hits === 1) return res(ctx.status(200), ctx.set('ETag', 'W/"abc"'), ctx.json(base));
      return res(ctx.status(304), ctx.set('ETag', 'W/"abc"'));
    })
  );

  const { result, rerender } = renderHook(() => useCustomerProfile('c1'), { wrapper });
  await waitFor(() => expect(result.current.data?.customer.id).toBe('c1'));
  rerender();
  await waitFor(() => expect(result.current.data?.customer.full_name).toBe('Ada'));
});
