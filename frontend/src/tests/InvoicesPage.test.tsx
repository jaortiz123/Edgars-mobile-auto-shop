import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import InvoicesPage from '@/pages/admin/InvoicesPage';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

function renderInvoices() {
  return render(
    <MemoryRouter initialEntries={['/admin/invoices']}>
      <Routes>
        <Route path="/admin/invoices" element={<InvoicesPage />} />
      </Routes>
    </MemoryRouter>
  );
}

const flush = () => new Promise(res => setTimeout(res, 0));

describe('InvoicesPage', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
    global.fetch = originalFetch;
  });

  it('Loading State: shows loading indicator initially', async () => {
    let resolveFn: (v: unknown) => void;
    // @ts-expect-error test mock
    global.fetch.mockReturnValue(new Promise(res => { resolveFn = res; }));
    renderInvoices();
    expect(screen.getByText(/Loading invoices/i)).toBeInTheDocument();
    resolveFn!({ ok: true, json: async () => ({ data: { items: [], page:1, page_size:20, total_items:0, total_pages:0 } }) });
    await flush();
  });

  it('Success State: renders rows for returned invoices', async () => {
    const invoices = [
      { id: 'inv1', status: 'PAID', total_cents: 10000, amount_due_cents: 0, amount_paid_cents: 10000, subtotal_cents:10000, tax_cents:0, created_at: new Date().toISOString(), issued_at: new Date().toISOString(), updated_at: new Date().toISOString(), customer_id: 1, customer_name: 'Alice' },
      { id: 'inv2', status: 'DRAFT', total_cents: 2500, amount_due_cents: 2500, amount_paid_cents: 0, subtotal_cents:2500, tax_cents:0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), customer_id: 2, customer_name: 'Bob' }
    ];
    // @ts-expect-error test mock
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ data: { items: invoices, page:1, page_size:20, total_items:2, total_pages:1 } }) });
    renderInvoices();
    expect(await screen.findByText('inv1')).toBeInTheDocument();
    expect(screen.getByText('inv2')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.getByText('$25.00')).toBeInTheDocument();
  });

  it('Empty State: shows message when no invoices', async () => {
    // @ts-expect-error test mock
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ data: { items: [], page:1, page_size:20, total_items:0, total_pages:0 } }) });
    renderInvoices();
    expect(await screen.findByText(/No invoices found/i)).toBeInTheDocument();
  });

  it('Error State: displays error when fetch fails', async () => {
    // @ts-expect-error test mock
    global.fetch.mockRejectedValue(new Error('Network down'));
    renderInvoices();
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent(/Network down|Failed to load invoices/);
  });
});
