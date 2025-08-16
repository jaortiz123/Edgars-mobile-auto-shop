import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceCatalogModal } from '@/components/appointments/ServiceCatalogModal';

// Helper to mock fetch
const mockFetch = (impl: (input: RequestInfo | URL) => Promise<Response>) => {
  (global as unknown as { fetch: unknown }).fetch = vi.fn(impl);
};

const SERVICES = [
  { id: 'svc-1', name: 'Oil Change', default_price: 49.99, category: 'Maintenance' },
  { id: 'svc-2', name: 'Brake Inspection', default_price: 89.0, category: 'Safety' },
];

describe('ServiceCatalogModal', () => {
  beforeEach(() => {
    // Use real timers to avoid debounce + MSW + safety-net timer leak conflicts
    vi.useRealTimers();
  });

  async function typeSearch(val: string) {
    const input = screen.getByPlaceholderText(/search services/i) as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, val);
    // Wait for debounce (300ms) + fetch microtask; using findBy ensures proper act wrapping
  }

  it('searches and renders results', async () => {
    mockFetch(async () => new Response(JSON.stringify({ service_operations: SERVICES }), { status: 200 }));
  render(<ServiceCatalogModal open initialSelected={[]} onConfirm={() => {}} onClose={() => {}} />);
  await typeSearch('oil');
  expect(await screen.findByText('Oil Change')).toBeInTheDocument();
  expect(await screen.findByText('Brake Inspection')).toBeInTheDocument();
  });

  it('toggles selection and updates selected count', async () => {
    mockFetch(async () => new Response(JSON.stringify({ service_operations: SERVICES }), { status: 200 }));
  render(<ServiceCatalogModal open initialSelected={[]} onConfirm={() => {}} onClose={() => {}} />);
  await typeSearch('brake');
  expect(await screen.findByText('Brake Inspection')).toBeInTheDocument();
  await userEvent.click(screen.getByText('Brake Inspection'));
    expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
  await userEvent.click(screen.getByText('Brake Inspection'));
    expect(screen.queryByText(/1 selected/i)).not.toBeInTheDocument();
  });

  it('confirms selection with correct payload', async () => {
    mockFetch(async () => new Response(JSON.stringify({ service_operations: SERVICES }), { status: 200 }));
    const onConfirm = vi.fn();
  render(<ServiceCatalogModal open initialSelected={[]} onConfirm={onConfirm} onClose={() => {}} />);
  await typeSearch('oil');
  expect(await screen.findByText('Oil Change')).toBeInTheDocument();
  await userEvent.click(screen.getByText('Oil Change'));
  await userEvent.click(screen.getByRole('button', { name: /add 1 service/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const arg = onConfirm.mock.calls[0][0];
    expect(arg).toHaveLength(1);
    expect(arg[0].id).toBe('svc-1');
  });

  it('shows error then retries successfully', async () => {
    let first = true;
    mockFetch(async () => {
      if (first) { first = false; return new Response('fail', { status: 500 }); }
      return new Response(JSON.stringify({ service_operations: SERVICES }), { status: 200 });
    });
  render(<ServiceCatalogModal open initialSelected={[]} onConfirm={() => {}} onClose={() => {}} />);
  await typeSearch('oil');
  expect(await screen.findByText(/error loading services/i)).toBeInTheDocument();
  await userEvent.click(screen.getByText(/retry/i));
  expect(await screen.findByText('Oil Change')).toBeInTheDocument();
  });
});
