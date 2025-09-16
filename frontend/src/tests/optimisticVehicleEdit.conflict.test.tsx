import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@test-utils';
import userEvent from '@testing-library/user-event';
import { VehicleEditModal } from '@/components/edit/VehicleEditModal';
import { ConflictProvider } from '@/conflict/ConflictProvider';

describe('optimistic vehicle edit conflict path', () => {
  it('shows conflict dialog and supports discard then overwrite flows', async () => {
    const qc = new QueryClient();
    const key = ['vehicleBasic', 'v1'];
    const initial = { id: 'v1', make: 'Ford', model: 'Focus', year: 2018, vin: 'VIN1', license_plate: 'AAA111', _etag: 'vetag1' };
    qc.setQueryData(key, initial);
    let fetchCount = 0;
    global.fetch = vi.fn(async (url: string, opts?: RequestInit) => {
      fetchCount++;
      const isPatch = opts?.method === 'PATCH';
      if (url.endsWith('/api/admin/vehicles/v1') && isPatch) {
        if (fetchCount === 1 || fetchCount === 3) {
          return new Response('precondition', { status: 412 });
        }
        return new Response(JSON.stringify({ data: { id: 'v1', make: 'Ford', model: 'Ranger', year: 2022, vin: 'VIN1X', license_plate: 'AAA999' } }), { status: 200, headers: { ETag: 'vetag3' } });
      }
      if (url.endsWith('/api/admin/vehicles/v1') && !isPatch) {
        return new Response(JSON.stringify({ data: { id: 'v1', make: 'Ford', model: 'Fusion', year: 2019, vin: 'VIN1S', license_plate: 'AAA222' } }), { status: 200, headers: { ETag: 'vetag2' } });
      }
      return new Response('not found', { status: 404 });
    }) as unknown as typeof fetch;

    const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <QueryClientProvider client={qc}><ConflictProvider>{children}</ConflictProvider></QueryClientProvider>
    );

    render(<VehicleEditModal open vehicle={initial} onClose={() => {}} />, { wrapper: Wrapper });
    const user = userEvent.setup();
    const modelInput = screen.getByLabelText(/model/i) as HTMLInputElement;
    await user.clear(modelInput);
    await user.type(modelInput, 'Fiesta');
    await user.click(screen.getByRole('button', { name: /save/i }));
    await screen.findByTestId('conflict-dialog');
    await user.click(screen.getByTestId('conflict-discard-btn'));
    await waitFor(() => {
      const cached = qc.getQueryData<typeof initial>(key);
      expect(cached?.model).toBe('Fusion');
    });
    await waitFor(() => {
      const cached = qc.getQueryData<typeof initial>(key);
      expect(cached?._etag).toBe('vetag2');
    });
    const modelInput2 = screen.getByLabelText(/model/i) as HTMLInputElement;
    await user.clear(modelInput2);
    await user.type(modelInput2, 'Ranger');
    await user.click(screen.getByRole('button', { name: /save/i }));
    await screen.findByTestId('conflict-dialog');
    await user.click(screen.getByTestId('conflict-overwrite-btn'));
    await waitFor(() => {
      const cached = qc.getQueryData<typeof initial>(key);
      expect(cached?.model).toBe('Ranger');
    });
    await waitFor(() => {
      const cached = qc.getQueryData<typeof initial>(key);
      expect(cached?._etag).toBe('vetag3');
    });
  });
});
