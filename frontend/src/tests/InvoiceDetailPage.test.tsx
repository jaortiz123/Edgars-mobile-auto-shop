import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import InvoiceDetailPage from '@/pages/admin/InvoiceDetailPage';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server/mswServer';
import userEvent from '@testing-library/user-event';
import { waitFor } from '@testing-library/react';

function renderWithRouter(id: string) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/admin/invoices/${id}`]}>
        <Routes>
          <Route path="/admin/invoices/:id" element={<InvoiceDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('InvoiceDetailPage', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('Loading State: shows skeleton while fetching', async () => {
    // Delay handler to keep loading visible
    server.use(
      http.get('http://localhost:3001/api/admin/invoices/:id', async () => {
        await new Promise(r => setTimeout(r, 50));
        return HttpResponse.json({ data: { invoice: { id: 'slow', status: 'DRAFT', subtotal_cents: 1000, tax_cents:0, total_cents:1000, amount_paid_cents:0, amount_due_cents:1000 }, line_items: [], payments: [] } });
      })
    );
    renderWithRouter('slow');
    expect(await screen.findByTestId('invoice-skeleton')).toBeInTheDocument();
  });

  it('Success State: renders header, line items and payments', async () => {
    server.use(
      http.get('http://localhost:3001/api/admin/invoices/:id', () => {
        return HttpResponse.json({ data: {
          invoice: { id: 'inv-123', status: 'PAID', subtotal_cents: 15000, tax_cents:0, total_cents:15000, amount_paid_cents:15000, amount_due_cents:0, customer_name:'Alice' },
          line_items: [
            { id: 'li1', name: 'Oil Change', quantity:1, unit_price_cents:5000, line_subtotal_cents:5000, tax_cents:0, total_cents:5000 },
            { id: 'li2', name: 'Brake Inspection', quantity:1, unit_price_cents:10000, line_subtotal_cents:10000, tax_cents:0, total_cents:10000 }
          ],
          payments: [ { id: 'pay1', amount_cents: 15000, method: 'card', created_at: new Date().toISOString() } ]
        }});
      })
    );
    renderWithRouter('inv-123');
  // Header elements (role-based to avoid matching the 'Void Invoice' button)
  const heading = await screen.findByRole('heading', { level: 1, name: /Invoice/ });
  expect(heading).toBeInTheDocument();
    expect(screen.getByText('inv-123')).toBeInTheDocument();
    expect(screen.getByText('PAID')).toBeInTheDocument();
  // Totals formatting (multiple occurrences: total, paid, payment entry). Ensure at least one exists.
  expect(screen.getAllByText('$150.00').length).toBeGreaterThan(0);
    // Line items rows
    expect(screen.getByText('Oil Change')).toBeInTheDocument();
    expect(screen.getByText('Brake Inspection')).toBeInTheDocument();
    // Payments
    expect(screen.getByText(/card/i)).toBeInTheDocument();
  });

  it('Error State: shows error message + retry on 500', async () => {
    server.use(
      http.get('http://localhost:3001/api/admin/invoices/:id', () => HttpResponse.json({ error: 'Server boom' }, { status: 500 }))
    );
    renderWithRouter('err-1');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Server boom|Failed to load invoice/);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('Not Found State: shows specific not found message (404)', async () => {
    server.use(
      http.get('http://localhost:3001/api/admin/invoices/:id', () => HttpResponse.json({ error: 'NOT_FOUND' }, { status: 404 }))
    );
    renderWithRouter('missing-1');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Invoice not found/);
    // Should not show Retry button for 404 case
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('Records payment successfully and refreshes invoice', async () => {
    // First response: partially paid
    let hit = 0;
    server.use(
      http.get('http://localhost:3001/api/admin/invoices/:id', () => {
        hit++;
        if (hit === 1) {
          return HttpResponse.json({ data: { invoice: { id: 'inv-pay', status: 'DRAFT', subtotal_cents: 10000, tax_cents:0, total_cents:10000, amount_paid_cents:2000, amount_due_cents:8000 }, line_items: [], payments: [{ id:'p1', amount_cents:2000, method:'cash', created_at: new Date().toISOString() }] } });
        }
        // After payment: amount paid increases
        return HttpResponse.json({ data: { invoice: { id: 'inv-pay', status: 'PARTIALLY_PAID', subtotal_cents: 10000, tax_cents:0, total_cents:10000, amount_paid_cents:5000, amount_due_cents:5000 }, line_items: [], payments: [ { id:'p1', amount_cents:2000, method:'cash', created_at: new Date().toISOString() }, { id:'p2', amount_cents:3000, method:'CARD', created_at: new Date().toISOString() } ] } });
      }),
  http.post('http://localhost:3001/api/admin/invoices/:id/payments', async () => {
        return HttpResponse.json({ data: { invoice: { id: 'inv-pay', status: 'PARTIALLY_PAID', total_cents:10000, amount_paid_cents:5000, amount_due_cents:5000, subtotal_cents:10000, tax_cents:0 }, payment: { id:'p2', amount_cents:3000, method:'CARD', created_at: new Date().toISOString() } } }, { status:201 });
      })
    );
    renderWithRouter('inv-pay');
    // Wait for initial amount paid
  // Wait for total to render (appears multiple times in totals, just ensure present)
  await screen.findAllByText('$100.00');
    // Open modal
    const btn = screen.getByTestId('record-payment-btn');
    const user = userEvent.setup();
    await user.click(btn);
    const modal = await screen.findByTestId('record-payment-modal');
    expect(modal).toBeInTheDocument();
    const amtInput = screen.getByTestId('payment-amount-input') as HTMLInputElement;
    await user.clear(amtInput);
    await user.type(amtInput, '30');
    await user.click(screen.getByTestId('payment-submit-btn'));
    await waitFor(() => expect(screen.queryByTestId('record-payment-modal')).not.toBeInTheDocument());
    // New paid amount should appear (50.00) after refetch
  // Paid amount 50 appears twice (Paid: and Due: sections). Ensure it exists after refetch.
  await screen.findAllByText('$50.00');
  });

  it('Shows backend error inside modal when overpayment attempted', async () => {
    server.use(
      http.get('http://localhost:3001/api/admin/invoices/:id', () => HttpResponse.json({ data: { invoice: { id: 'inv-ovr', status: 'DRAFT', subtotal_cents: 10000, tax_cents:0, total_cents:10000, amount_paid_cents:0, amount_due_cents:10000 }, line_items: [], payments: [] } })),
      http.post('http://localhost:3001/api/admin/invoices/:id/payments', () => HttpResponse.json({ error: 'OVERPAYMENT' }, { status:400 }))
    );
    renderWithRouter('inv-ovr');
  await screen.findAllByText('$100.00');
    const user = userEvent.setup();
    await user.click(screen.getByTestId('record-payment-btn'));
    const amtInput = await screen.findByTestId('payment-amount-input');
    await user.clear(amtInput);
    await user.type(amtInput as HTMLInputElement, '150');
    await user.click(screen.getByTestId('payment-submit-btn'));
    await screen.findByTestId('payment-error');
    expect(screen.getByTestId('payment-error')).toHaveTextContent(/OVERPAYMENT/i);
    // Modal remains open
    expect(screen.getByTestId('record-payment-modal')).toBeInTheDocument();
  });

  it('Shows already paid error and disables button on refetch', async () => {
    let paid = false;
    server.use(
      http.get('http://localhost:3001/api/admin/invoices/:id', () => {
        if (paid) {
          return HttpResponse.json({ data: { invoice: { id: 'inv-paid', status: 'PAID', subtotal_cents: 10000, tax_cents:0, total_cents:10000, amount_paid_cents:10000, amount_due_cents:0 }, line_items: [], payments: [ { id:'p1', amount_cents:10000, method:'cash', created_at:new Date().toISOString() } ] } });
        }
        return HttpResponse.json({ data: { invoice: { id: 'inv-paid', status: 'DRAFT', subtotal_cents: 10000, tax_cents:0, total_cents:10000, amount_paid_cents:0, amount_due_cents:10000 }, line_items: [], payments: [] } });
      }),
  http.post('http://localhost:3001/api/admin/invoices/:id/payments', () => {
        paid = true;
        return HttpResponse.json({ data: { invoice: { id: 'inv-paid', status: 'PAID', total_cents:10000, amount_paid_cents:10000, amount_due_cents:0, subtotal_cents:10000, tax_cents:0 }, payment: { id:'p1', amount_cents:10000, method:'CASH', created_at:new Date().toISOString() } } }, { status:201 });
      })
    );
    renderWithRouter('inv-paid');
  await screen.findAllByText('$100.00');
    const user = userEvent.setup();
    await user.click(screen.getByTestId('record-payment-btn'));
    await user.click(screen.getByTestId('payment-submit-btn'));
    await waitFor(() => expect(screen.queryByTestId('record-payment-modal')).not.toBeInTheDocument());
    // Button should now be disabled because invoice is PAID after refetch
    await waitFor(() => expect(screen.getByTestId('record-payment-btn')).toBeDisabled());
  });

  it('Voids invoice successfully and refreshes status', async () => {
    let voided = false;
    server.use(
      http.get('http://localhost:3001/api/admin/invoices/:id', () => {
        if (voided) {
          return HttpResponse.json({ data: { invoice: { id: 'inv-void', status: 'VOID', subtotal_cents: 10000, tax_cents:0, total_cents:10000, amount_paid_cents:0, amount_due_cents:10000 }, line_items: [], payments: [] } });
        }
        return HttpResponse.json({ data: { invoice: { id: 'inv-void', status: 'DRAFT', subtotal_cents: 10000, tax_cents:0, total_cents:10000, amount_paid_cents:0, amount_due_cents:10000 }, line_items: [], payments: [] } });
      }),
      http.post('http://localhost:3001/api/admin/invoices/:id/void', () => {
        voided = true;
        return HttpResponse.json({ data: { invoice: { id: 'inv-void', status: 'VOID', total_cents:10000, amount_paid_cents:0, amount_due_cents:10000, subtotal_cents:10000, tax_cents:0 } } }, { status:201 });
      })
    );
    renderWithRouter('inv-void');
    await screen.findAllByText('$100.00');
    const user = userEvent.setup();
    await user.click(screen.getByTestId('void-invoice-btn'));
    const modal = await screen.findByTestId('void-confirm-modal');
    expect(modal).toBeInTheDocument();
    await user.click(screen.getByTestId('void-confirm-btn'));
    await waitFor(() => expect(screen.queryByTestId('void-confirm-modal')).not.toBeInTheDocument());
    // Status should now be VOID and button disabled
    await screen.findByText('VOID');
    expect(screen.getByTestId('void-invoice-btn')).toBeDisabled();
  });

  it('Shows backend error if void fails and keeps modal open', async () => {
    server.use(
      http.get('http://localhost:3001/api/admin/invoices/:id', () => HttpResponse.json({ data: { invoice: { id: 'inv-void-err', status: 'DRAFT', subtotal_cents: 10000, tax_cents:0, total_cents:10000, amount_paid_cents:0, amount_due_cents:10000 }, line_items: [], payments: [] } })),
      http.post('http://localhost:3001/api/admin/invoices/:id/void', () => HttpResponse.json({ error: 'CANNOT_VOID' }, { status:400 }))
    );
    renderWithRouter('inv-void-err');
    await screen.findAllByText('$100.00');
    const user = userEvent.setup();
    await user.click(screen.getByTestId('void-invoice-btn'));
    await screen.findByTestId('void-confirm-modal');
    await user.click(screen.getByTestId('void-confirm-btn'));
    await screen.findByTestId('void-error');
    expect(screen.getByTestId('void-error')).toHaveTextContent(/CANNOT_VOID|Failed to void invoice/);
    // Modal should remain open
    expect(screen.getByTestId('void-confirm-modal')).toBeInTheDocument();
  });
});
