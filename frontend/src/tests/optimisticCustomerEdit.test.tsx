import React from 'react';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomerEditModal } from '@/components/edit/CustomerEditModal';
import type { CustomerProfile } from '@/types/customerProfile';

function setup(initial: CustomerProfile) {
  const qc = new QueryClient();
  const key = ['customerProfile', initial.customer.id, null, null, null, false, null];
  qc.setQueryData(key, { ...initial, _etag: 'etag-original' });
  const Wrapper: React.FC<React.PropsWithChildren> = ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { qc, Wrapper };
}

describe('Optimistic Customer Edit (happy path)', () => {
  it('optimistically updates fields and then finalizes with server response + new ETag', async () => {
    const initial: CustomerProfile = { customer: { id: 'c1', full_name: 'Jane Doe', phone: '111', email: 'jane@ex.com', created_at: '2024-01-01' }, stats: { lifetime_spend: 0, unpaid_balance: 0, total_visits: 0, last_visit_at: null }, vehicles: [], appointments: [] };
    const { qc, Wrapper } = setup(initial);

    // Mock fetch for PATCH returning updated values and new ETag
    let capturedUrl: string | undefined; let capturedOpts: RequestInit | undefined; let callCount = 0;
    const fetchStub = async (u: RequestInfo | URL, o?: RequestInit) => {
      callCount += 1; capturedUrl = String(u); capturedOpts = o;
      return new Response(JSON.stringify({ data: { id: 'c1', name: 'Jane A. Doe', phone: '222', email: 'jane@new.com' } }), { status: 200, headers: { 'ETag': 'etag-new' } });
    };
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchStub as typeof fetch;

    render(<CustomerEditModal open profile={initial} onClose={() => {}} />, { wrapper: Wrapper });

    // Change name + phone
    await userEvent.clear(screen.getByLabelText(/Full Name/i));
    await userEvent.type(screen.getByLabelText(/Full Name/i), 'Jane A. Doe');
    await userEvent.clear(screen.getByLabelText(/Phone/i));
    await userEvent.type(screen.getByLabelText(/Phone/i), '222');
    await userEvent.clear(screen.getByLabelText(/Email/i));
    await userEvent.type(screen.getByLabelText(/Email/i), 'jane@new.com');

    await userEvent.click(screen.getByRole('button', { name: /Save/i }));

    // Immediately optimistic cache should reflect changes
  const optimistic = qc.getQueryData<{ customer: { full_name: string; phone?: string | null } }>(['customerProfile', 'c1', null, null, null, false, null]);
  expect(optimistic).toBeTruthy();
  expect(optimistic!.customer.full_name).toBe('Jane A. Doe');
  expect(optimistic!.customer.phone).toBe('222');

    // Wait for success application
  await waitFor(() => expect(qc.getQueryData<{ _etag?: string }>(['customerProfile', 'c1', null, null, null, false, null])?._etag).toBe('etag-new'));
  const final = qc.getQueryData<{ customer: { email?: string | null } }>(['customerProfile', 'c1', null, null, null, false, null]);
  expect(final!.customer.email).toBe('jane@new.com');

  expect(callCount).toBe(1);
  expect(capturedUrl).toContain('/api/admin/customers/c1');
  expect(((capturedOpts!.headers as Record<string,string>)['If-Match'])).toBe('etag-original');
  });
});
