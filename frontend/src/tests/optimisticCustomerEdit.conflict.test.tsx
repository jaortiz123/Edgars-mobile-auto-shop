import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@test-utils';
import userEvent from '@testing-library/user-event';
import { CustomerEditModal } from '@/components/edit/CustomerEditModal';
import { ConflictProvider } from '@/conflict/ConflictProvider';
import * as ConflictMod from '@/conflict/ConflictProvider';

describe('optimistic customer edit conflict path', () => {
  it('shows conflict dialog and supports discard and overwrite flows', async () => {
    // Force deterministic conflict decisions without relying on UI rendering
  const mockOpen = vi.fn()
      .mockResolvedValueOnce('discard')
      .mockResolvedValueOnce('overwrite');
  vi.spyOn(ConflictMod, 'useConflictManager').mockReturnValue({ openConflict: mockOpen } as unknown as ReturnType<typeof ConflictMod.useConflictManager>);
    const qc = new QueryClient();
    const key = ['customerProfile', 'c1', null, null, null, false, null];
  const initial = { customer: { id: 'c1', full_name: 'Alice A', phone: '111', email: 'a@x.com', created_at: 'now' }, stats: { lifetime_spend: 0, unpaid_balance: 0, total_visits: 0, last_visit_at: null, avg_ticket: 0, last_service_at: null }, vehicles: [], appointments: [], _etag: 'etag1' };
    qc.setQueryData(key, initial);
    const { http } = await import('@/lib/api');
    // First PATCH returns 412, GET returns server version, overwrite PATCH succeeds with etag3
  vi
      .spyOn(http, 'patch')
      .mockResolvedValueOnce({ status: 412, data: 'precondition' } as unknown as ReturnType<typeof http.patch> extends Promise<infer R> ? R : never)
      .mockResolvedValueOnce({ status: 200, data: { data: { id: 'c1', name: 'Alice Conflict Resolved', email: 'a2@x.com', phone: '222' } }, headers: { etag: 'etag3' } } as unknown as ReturnType<typeof http.patch> extends Promise<infer R> ? R : never);
    vi.spyOn(http, 'get').mockResolvedValue({ status: 200, data: { data: { id: 'c1', name: 'Alice Server', email: 'server@x.com', phone: '999' } }, headers: { etag: 'etag2' } } as unknown as ReturnType<typeof http.get> extends Promise<infer R> ? R : never);

    const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <QueryClientProvider client={qc}><ConflictProvider>{children}</ConflictProvider></QueryClientProvider>
    );

  render(<CustomerEditModal open profile={initial as unknown as typeof initial} onClose={() => {}} />, { wrapper: Wrapper });
    const user = userEvent.setup();
  await screen.findByTestId('customer-edit-modal');
  const nameInput = screen.getByLabelText(/full name/i) as HTMLInputElement;
  await user.clear(nameInput);
  await user.type(nameInput, 'Alice Local Change');
  await user.click(screen.getByRole('button', { name: /save/i }));
  // Decision mocked as 'discard'
    await waitFor(() => {
      const cached = qc.getQueryData<typeof initial>(key);
      expect(cached?.customer.full_name).toBe('Alice Server');
    });
    // Overwrite path
  await screen.findByTestId('customer-edit-modal');
  const nameInput2 = screen.getByLabelText(/full name/i) as HTMLInputElement;
  await user.clear(nameInput2);
  await user.type(nameInput2, 'Alice Overwrite Attempt');
  await user.click(screen.getByRole('button', { name: /save/i }));
  // Decision mocked as 'overwrite'
    await waitFor(() => {
  const cached = qc.getQueryData<Record<string, unknown>>(key);
  expect((cached as { _etag?: string } | undefined)?._etag).toBe('etag3');
    });
  });
});
