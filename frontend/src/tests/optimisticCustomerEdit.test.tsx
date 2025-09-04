import React from 'react';
import { describe, it, expect, vi } from 'vitest';
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
  const initial: CustomerProfile = { customer: { id: 'c1', full_name: 'Jane Doe', phone: '111', email: 'jane@ex.com', created_at: '2024-01-01' }, stats: { lifetime_spend: 0, unpaid_balance: 0, total_visits: 0, last_visit_at: null, avg_ticket: 0, last_service_at: null }, vehicles: [], appointments: [] };
    const { qc, Wrapper } = setup(initial);

  // Mock axios http.patch/get returning updated values and new ETag
  const { http } = await import('@/lib/api');
  const patchSpy = vi.spyOn(http, 'patch').mockResolvedValue({ status: 200, data: { data: { id: 'c1', name: 'Jane A. Doe', phone: '222', email: 'jane@new.com' } }, headers: { etag: 'etag-new' } } as unknown as ReturnType<typeof http.patch> extends Promise<infer R> ? R : never);

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

  expect(patchSpy).toHaveBeenCalledTimes(1);
  expect(patchSpy.mock.calls[0][0]).toContain('/admin/customers/c1');
  const headers = (patchSpy.mock.calls[0][2] as { headers?: Record<string,string> }).headers || {};
  expect(headers['If-Match']).toBe('etag-original');
  });
});
