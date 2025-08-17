import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { setupUserEvent } from '@/tests/testUtils/userEventHelper';
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
  let user: ReturnType<typeof setupUserEvent>;
  beforeEach(() => {
    // Use fake timers so userEvent's advanceTimers hook can drive debounce deterministically.
    vi.useFakeTimers();
    user = setupUserEvent();
  });

  async function typeSearch(val: string) {
    const input = screen.getByPlaceholderText(/search services/i) as HTMLInputElement;
    await user.clear(input);
    await user.type(input, val);
    // Manually advance just beyond debounce threshold (300ms)
    vi.advanceTimersByTime(350);
  }

  it('searches and renders results', async () => {
  mockFetch(async () => new Response(JSON.stringify(SERVICES), { status: 200 }));
  render(<ServiceCatalogModal open initialSelected={[]} onConfirm={() => {}} onClose={() => {}} />);
  await typeSearch('oil');
  expect(await screen.findByText('Oil Change')).toBeInTheDocument();
  expect(await screen.findByText('Brake Inspection')).toBeInTheDocument();
  });

  it('toggles selection and updates selected count', async () => {
  mockFetch(async () => new Response(JSON.stringify(SERVICES), { status: 200 }));
  render(<ServiceCatalogModal open initialSelected={[]} onConfirm={() => {}} onClose={() => {}} />);
  await typeSearch('brake');
  expect(await screen.findByText('Brake Inspection')).toBeInTheDocument();
  await user.click(screen.getByText('Brake Inspection'));
    expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
  await user.click(screen.getByText('Brake Inspection'));
    expect(screen.queryByText(/1 selected/i)).not.toBeInTheDocument();
  });

  it('confirms selection with correct payload', async () => {
  mockFetch(async () => new Response(JSON.stringify(SERVICES), { status: 200 }));
    const onConfirm = vi.fn();
  render(<ServiceCatalogModal open initialSelected={[]} onConfirm={onConfirm} onClose={() => {}} />);
  await typeSearch('oil');
  expect(await screen.findByText('Oil Change')).toBeInTheDocument();
  await user.click(screen.getByText('Oil Change'));
  await user.click(screen.getByRole('button', { name: /add 1 service/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const arg = onConfirm.mock.calls[0][0];
    expect(arg).toHaveLength(1);
    expect(arg[0].id).toBe('svc-1');
  });

  it('shows error then retries successfully', async () => {
    let first = true;
    mockFetch(async () => {
      if (first) { first = false; return new Response('fail', { status: 500 }); }
      return new Response(JSON.stringify(SERVICES), { status: 200 });
    });
  render(<ServiceCatalogModal open initialSelected={[]} onConfirm={() => {}} onClose={() => {}} />);
  await typeSearch('oil');
  expect(await screen.findByText(/Error:\s*HTTP 500/i)).toBeInTheDocument();
  await user.click(screen.getByText(/retry/i));
  expect(await screen.findByText('Oil Change')).toBeInTheDocument();
  });
});
