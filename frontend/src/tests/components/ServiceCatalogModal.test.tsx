import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceCatalogModal } from '@/components/appointments/ServiceCatalogModal';
import type { ServiceOperation } from '@/components/appointments/ServiceCatalogModal';

// Simple mock for fetch returning flat array
function mockFetchOnce(data: ServiceOperation[]) {
  (globalThis as unknown as { fetch: unknown }).fetch = vi.fn(async () => new Response(JSON.stringify(data), { status: 200 }));
}

const MOCK_SERVICES: ServiceOperation[] = [
  { id: 'svc-1', name: 'Oil Change', category: 'MAINTENANCE', internal_code: 'OIL', display_order: 2, default_hours: 1, base_labor_rate: 49.99 },
  { id: 'svc-2', name: 'Brake Inspection', category: 'BRAKES', internal_code: 'BRK-INSP', display_order: 1, default_hours: 0.5, base_labor_rate: 39.0 },
  { id: 'svc-3', name: 'Alignment Check', category: 'MAINTENANCE', internal_code: 'ALIGN', display_order: 3, default_hours: 0.7, base_labor_rate: 69.0 }
];

describe('ServiceCatalogModal (two-panel)', () => {
  it('renders categories and defaults to MAINTENANCE', async () => {
    mockFetchOnce(MOCK_SERVICES);
    render(<ServiceCatalogModal open onClose={() => {}} onAdd={() => {}} />);
    await screen.findByText('MAINTENANCE');
    await screen.findByText('Oil Change');
    expect(screen.getByText('Alignment Check')).toBeInTheDocument();
    expect(screen.queryByText('Brake Inspection')).not.toBeInTheDocument();
  });

  it('filters when clicking another category', async () => {
    mockFetchOnce(MOCK_SERVICES);
    render(<ServiceCatalogModal open onClose={() => {}} onAdd={() => {}} />);
    await screen.findByText('MAINTENANCE');
    const brakesBtn = screen.getByRole('button', { name: /BRAKES/i });
    await userEvent.click(brakesBtn);
    await screen.findByText('Brake Inspection');
    expect(screen.queryByText('Oil Change')).not.toBeInTheDocument();
  });

  it('invokes onAdd when clicking a service row', async () => {
    const onAdd = vi.fn();
    mockFetchOnce(MOCK_SERVICES);
    render(<ServiceCatalogModal open onClose={() => {}} onAdd={onAdd} />);
    await screen.findByText('MAINTENANCE');
    const oil = await screen.findByText('Oil Change');
    await userEvent.click(oil);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0].id).toBe('svc-1');
  });
});
