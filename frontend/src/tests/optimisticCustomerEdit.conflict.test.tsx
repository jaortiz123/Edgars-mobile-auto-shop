import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomerEditModal } from '@/components/edit/CustomerEditModal';
import { ConflictProvider } from '@/conflict/ConflictProvider';

describe('optimistic customer edit conflict path', () => {
  it('shows conflict dialog and supports discard and overwrite flows', async () => {
    const qc = new QueryClient();
    const key = ['customerProfile', 'c1', null, null, null, false, null];
    const initial = { customer: { id: 'c1', full_name: 'Alice A', phone: '111', email: 'a@x.com', created_at: 'now' }, stats: { lifetime_spend: 0, unpaid_balance: 0, total_visits: 0, last_visit_at: null }, vehicles: [], appointments: [], _etag: 'etag1' };
    qc.setQueryData(key, initial);
    let call = 0;
  global.fetch = vi.fn(async (url: string, opts?: RequestInit) => {
      call++;
      if (url.endsWith('/api/admin/customers/c1') && opts?.method === 'PATCH') {
        if (call === 1 || call === 3) { // first attempts per path
          return new Response('precondition', { status: 412 });
        }
        // overwrite retry
        return new Response(JSON.stringify({ data: { id: 'c1', name: 'Alice Conflict Resolved', email: 'a2@x.com', phone: '222' } }), { status: 200, headers: { ETag: 'etag3' } });
      }
      if (url.endsWith('/api/admin/customers/c1') && (!opts || opts.method === 'GET')) {
        return new Response(JSON.stringify({ data: { id: 'c1', name: 'Alice Server', email: 'server@x.com', phone: '999' } }), { status: 200, headers: { ETag: 'etag2' } });
      }
      return new Response('not found', { status: 404 });
  }) as unknown as typeof fetch;

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
    await screen.findByTestId('conflict-dialog');
    await user.click(screen.getByTestId('conflict-discard-btn'));
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
    await screen.findByTestId('conflict-dialog');
    await user.click(screen.getByTestId('conflict-overwrite-btn'));
    await waitFor(() => {
  const cached = qc.getQueryData<Record<string, unknown>>(key);
  expect((cached as { _etag?: string } | undefined)?._etag).toBe('etag3');
    });
  });
});
