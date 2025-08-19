import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import VehicleProfilePage from '@/pages/admin/VehicleProfilePage';
import * as vehicleProfileHook from '@/hooks/useVehicleProfile';

function renderWithRoute(path = '/admin/vehicles/veh-1') {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/vehicles/:id" element={<VehicleProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('VehicleProfilePage', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.clearAllMocks(); });

  interface MockHeader { vehicle_id: string; year?: number; make?: string; model?: string; vin?: string }
  interface MockStats { lifetime_spend: number; total_visits: number; last_service_at: string | null; avg_ticket: number }
  interface MockTimelineRow { id?: string }
  interface MockPage { header: MockHeader; stats: MockStats; timeline: MockTimelineRow[]; page:{ next_cursor: string | null }; etag: string | null }
  interface MockInfiniteResult {
    data: { pages: MockPage[] } | undefined;
    isLoading: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => void;
    hasNextPage: boolean;
    error: unknown;
  }
  function mockHook(overrides: Partial<MockInfiniteResult> = {}) {
    const base: MockInfiniteResult = {
      data: { pages: [{ header: { vehicle_id: 'veh-1', year: 2020, make: 'Honda', model: 'Civic', vin: 'VIN123' }, stats: { lifetime_spend: 200, total_visits: 3, last_service_at: null, avg_ticket: 100 }, timeline: [], page: { next_cursor: null }, etag: null }] },
      isLoading: false,
      isFetchingNextPage: false,
      fetchNextPage: () => {},
      hasNextPage: false,
      error: null,
    };
    const value: MockInfiniteResult = { ...base, ...overrides };
    vi.spyOn(vehicleProfileHook, 'useVehicleProfileInfinite').mockReturnValue(value as unknown as ReturnType<typeof vehicleProfileHook.useVehicleProfileInfinite>);
  }

  it('renders header when data loaded', async () => {
    mockHook();
    renderWithRoute();
    expect(await screen.findByText(/Honda/)).toBeInTheDocument();
  });

  it('shows loading skeleton', async () => {
    mockHook({ data: undefined, isLoading: true });
    renderWithRoute();
    // skeleton exists
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Vehicle Profile/ })).toBeInTheDocument();
    });
  });

  it('handles error state', async () => {
    mockHook({ error: new Error('Boom'), data: undefined });
    renderWithRoute();
    expect(await screen.findByText(/Boom/)).toBeInTheDocument();
  });
});
