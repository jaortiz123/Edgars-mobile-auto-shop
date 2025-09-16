import React from 'react';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@test-utils';
import userEvent from '@testing-library/user-event';
import { VehicleEditModal } from '@/components/edit/VehicleEditModal';
import type { BasicVehicleForModal } from '@/components/edit/VehicleEditModal';

function setup(initial: BasicVehicleForModal) {
  const qc = new QueryClient();
  const key = ['vehicleBasic', initial.id];
  qc.setQueryData(key, { ...initial, _etag: 'veh-etag-original' });
  const Wrapper: React.FC<React.PropsWithChildren> = ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { qc, Wrapper };
}

describe('Optimistic Vehicle Edit (happy path)', () => {
  it('optimistically updates basic fields then finalizes with server response + new ETag', async () => {
    const initial: BasicVehicleForModal = { id: 'v1', make: 'Toyota', model: 'Camry', year: 2020, vin: 'VIN1', license_plate: 'ABC123' };
    const { qc, Wrapper } = setup(initial);

    let capturedUrl: string | undefined; let capturedOpts: RequestInit | undefined; let callCount = 0;
    const fetchStub = async (u: RequestInfo | URL, o?: RequestInit) => {
      callCount += 1; capturedUrl = String(u); capturedOpts = o;
      return new Response(JSON.stringify({ data: { id: 'v1', make: 'Tesla', model: 'Model 3', year: 2022, vin: 'VIN2', license_plate: 'XYZ999' } }), { status: 200, headers: { 'ETag': 'veh-etag-new' } });
    };
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchStub as typeof fetch;

    render(<VehicleEditModal open vehicle={initial} onClose={() => {}} />, { wrapper: Wrapper });

    await userEvent.clear(screen.getByLabelText(/Make/i));
    await userEvent.type(screen.getByLabelText(/Make/i), 'Tesla');
    await userEvent.clear(screen.getByLabelText(/Model/i));
    await userEvent.type(screen.getByLabelText(/Model/i), 'Model 3');
    await userEvent.clear(screen.getByLabelText(/Year/i));
    await userEvent.type(screen.getByLabelText(/Year/i), '2022');

    await userEvent.click(screen.getByRole('button', { name: /Save/i }));

    const optimistic = qc.getQueryData<{ make?: string | null; model?: string | null; year?: number | null }>(['vehicleBasic', 'v1']);
    expect(optimistic).toBeTruthy();
    expect(optimistic!.make).toBe('Tesla');
    expect(optimistic!.model).toBe('Model 3');
    expect(optimistic!.year).toBe(2022);

    await waitFor(() => expect(qc.getQueryData<{ _etag?: string }>(['vehicleBasic', 'v1'])?._etag).toBe('veh-etag-new'));
    const final = qc.getQueryData<{ vin?: string | null }>(['vehicleBasic', 'v1']);
    expect(final!.vin).toBe('VIN2');

    expect(callCount).toBe(1);
    expect(capturedUrl).toContain('/api/admin/vehicles/v1');
    expect(((capturedOpts!.headers as Record<string,string>)['If-Match'])).toBe('veh-etag-original');
  });
});
