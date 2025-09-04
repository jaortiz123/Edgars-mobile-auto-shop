import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import InvoicesPage from '@/pages/admin/InvoicesPage';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import * as api from '@/services/apiService';

function renderInvoices() {
  return render(
    <MemoryRouter initialEntries={['/admin/invoices']}>
      <Routes>
        <Route path="/admin/invoices" element={<InvoicesPage />} />
      </Routes>
    </MemoryRouter>
  );
}


describe('InvoicesPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Loading State: shows loading indicator initially', async () => {
    const p = new Promise<api.InvoiceListResponse>(resolve => setTimeout(() => resolve({ items: [], page: 1, page_size: 20, total_items: 0, total_pages: 0 }), 10));
    vi.spyOn(api, 'fetchInvoices').mockReturnValue(p as unknown as Promise<api.InvoiceListResponse>);
    renderInvoices();
    expect(screen.getByText(/Loading invoices/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Loading invoices/i)).not.toBeInTheDocument());
  });

  it('Success State: renders rows for returned invoices', async () => {
    const invoices = [
      { id: 'inv1', status: 'PAID', total_cents: 10000, amount_due_cents: 0, amount_paid_cents: 10000, subtotal_cents:10000, tax_cents:0, created_at: new Date().toISOString(), issued_at: new Date().toISOString(), updated_at: new Date().toISOString(), customer_id: 1, customer_name: 'Alice' },
      { id: 'inv2', status: 'DRAFT', total_cents: 2500, amount_due_cents: 2500, amount_paid_cents: 0, subtotal_cents:2500, tax_cents:0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), customer_id: 2, customer_name: 'Bob' }
    ];
  vi.spyOn(api, 'fetchInvoices').mockResolvedValue({ items: invoices, page:1, page_size:20, total_items:2, total_pages:1 });
    renderInvoices();
  // Await at least one invoice row to ensure initial async fetch resolved
  expect(await screen.findByText('inv1')).toBeInTheDocument();
  expect(screen.getByText('inv2')).toBeInTheDocument();
  expect(screen.getByText('Alice')).toBeInTheDocument();
  expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    // More specific: iterate table rows and find one containing inv2 then assert amount
    const rows = screen.getAllByRole('row');
    const draftRow = rows.find(r => within(r).queryByText('inv2'));
    expect(draftRow, 'expected to find a table row for invoice inv2').toBeTruthy();
    if (draftRow) {
      const matches = within(draftRow).getAllByText('$25.00');
      // Expect exactly 2 occurrences in the draft invoice row: total and amount due
      expect(matches.length).toBe(2);
    }
  });

  it('Empty State: shows message when no invoices', async () => {
  vi.spyOn(api, 'fetchInvoices').mockResolvedValue({ items: [], page:1, page_size:20, total_items:0, total_pages:0 });
    renderInvoices();
  expect(await screen.findByText(/No invoices found/i)).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByText(/Loading invoices/i)).not.toBeInTheDocument());
  });

  it('Error State: displays error when fetch fails', async () => {
  vi.spyOn(api, 'fetchInvoices').mockRejectedValue(new Error('Network down'));
    renderInvoices();
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent(/Network down|Failed to load invoices/);
  await waitFor(() => expect(screen.queryByText(/Loading invoices/i)).not.toBeInTheDocument());
  });
});
