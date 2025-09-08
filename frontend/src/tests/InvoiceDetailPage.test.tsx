import React from 'react';
import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccessibilityProvider } from '@/contexts/AccessibilityProvider';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server/mswServer';
import userEvent from '@testing-library/user-event';
import { waitFor } from '@testing-library/react';

// We'll lazy-load the real ToastProvider & InvoiceDetailPage after undoing global mocks.
type WithChildren = { children?: React.ReactNode };
// InvoiceDetailPage props aren't directly used here; unknown is sufficient
let InvoiceDetailPage: React.ComponentType<unknown> | null = null;
let ToastProvider: React.ComponentType<WithChildren> | null = null;

function renderWithRouter(id: string) {
  if (!InvoiceDetailPage || !ToastProvider) {
    throw new Error('Test setup error: modules not loaded before render.');
  }
  const qc = new QueryClient();
  return render(
    <AccessibilityProvider>
      <ToastProvider>
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={[`/admin/invoices/${id}`]}>
            <Routes>
              <Route path="/admin/invoices/:id" element={<InvoiceDetailPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </ToastProvider>
    </AccessibilityProvider>
  );
}

describe('InvoiceDetailPage', () => {
  // Use real toast + page modules (global setup mocks them, which suppresses actual toast DOM rendering)
  beforeAll(async () => {
    try { vi.doUnmock('@/lib/toast'); } catch { /* ignore */ }
    try { vi.doUnmock('@/components/ui/Toast'); } catch { /* ignore */ }
    // Dynamically import after unmock so we get real implementations
    const toastMod = await import('@/components/ui/Toast');
  ToastProvider = toastMod.ToastProvider as React.ComponentType<WithChildren>;
    InvoiceDetailPage = (await import('@/pages/admin/InvoiceDetailPage')).default;
    // Attach MSW request logging for debugging invoice/service-operation traffic
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (server as any).events?.on('request:start', ({ request }: { request: Request }) => {
        if (/invoices\//.test(request.url) || /service-operations/.test(request.url)) {
          console.log('[MSW][request]', request.method, request.url);
        }
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (server as any).events?.on('unhandledRequest', ({ request }: { request: Request }) => {
        console.warn('[MSW][unhandled]', request.method, request.url);
      });
    } catch { /* ignore if events API not available */ }
  });
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
    const successHandler = ({ request }: { request: Request }) => {
      // Debug log to verify handler match
      console.log('[TEST] success handler hit for', request.url);
      return HttpResponse.json({ data: {
      invoice: { id: 'inv-123', status: 'PAID', subtotal_cents: 15000, tax_cents:0, total_cents:15000, amount_paid_cents:15000, amount_due_cents:0, customer_name:'Alice' },
      line_items: [
        { id: 'li1', name: 'Oil Change', quantity:1, unit_price_cents:5000, line_subtotal_cents:5000, tax_cents:0, total_cents:5000 },
        { id: 'li2', name: 'Brake Inspection', quantity:1, unit_price_cents:10000, line_subtotal_cents:10000, tax_cents:0, total_cents:10000 }
      ],
      payments: [ { id: 'pay1', amount_cents: 15000, method: 'card', created_at: new Date().toISOString() } ]
    }});
    };
    server.use(
      http.get('http://localhost:3001/api/admin/invoices/:id', successHandler),
      http.get('http://localhost:3000/api/admin/invoices/:id', successHandler),
      http.get('/api/admin/invoices/:id', successHandler)
    );
    // Fallback catch-all to see if some other path variant is used
    server.use(
      http.get('http://localhost:3001/admin/invoices/:id', ({ request, params }) => {
        console.log('[TEST] fallback 3001/admin (no /api) handler hit', request.url, params);
        const p = params as { id: string };
        return HttpResponse.json({ data: { invoice: { id: p.id, status: 'FALLBACK', subtotal_cents: 11111, tax_cents:0, total_cents:11111, amount_paid_cents:0, amount_due_cents:11111 }, line_items: [], payments: [] } });
      }),
      http.get('http://localhost:3001//api/admin/invoices/:id', ({ request }) => {
        console.log('[TEST] double-slash variant hit', request.url);
        return HttpResponse.json({ data: { invoice: { id: 'double-slash', status: 'DOUBLE', subtotal_cents: 22222, tax_cents:0, total_cents:22222, amount_paid_cents:0, amount_due_cents:22222 }, line_items: [], payments: [] } });
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
    const errHandler = () => HttpResponse.json({ error: 'Server boom' }, { status: 500 });
    server.use(
      http.get('http://localhost:3001/api/admin/invoices/:id', errHandler),
      http.get('http://localhost:3000/api/admin/invoices/:id', errHandler),
      http.get('/api/admin/invoices/:id', errHandler)
    );
    renderWithRouter('err-1');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Server boom|Failed to load invoice/);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('Not Found State: shows specific not found message (404)', async () => {
    const nfHandler = () => HttpResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    server.use(
      http.get('http://localhost:3001/api/admin/invoices/:id', nfHandler),
      http.get('http://localhost:3000/api/admin/invoices/:id', nfHandler),
      http.get('/api/admin/invoices/:id', nfHandler)
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
      http.get('http://localhost:3000/api/admin/invoices/:id', () => {
        hit++;
        if (hit === 1) {
          return HttpResponse.json({ data: { invoice: { id: 'inv-pay', status: 'DRAFT', subtotal_cents: 10000, tax_cents:0, total_cents:10000, amount_paid_cents:2000, amount_due_cents:8000 }, line_items: [], payments: [{ id:'p1', amount_cents:2000, method:'cash', created_at: new Date().toISOString() }] } });
        }
        return HttpResponse.json({ data: { invoice: { id: 'inv-pay', status: 'PARTIALLY_PAID', subtotal_cents: 10000, tax_cents:0, total_cents:10000, amount_paid_cents:5000, amount_due_cents:5000 }, line_items: [], payments: [ { id:'p1', amount_cents:2000, method:'cash', created_at: new Date().toISOString() }, { id:'p2', amount_cents:3000, method:'CARD', created_at: new Date().toISOString() } ] } });
      }),
      http.get('/api/admin/invoices/:id', () => {
        hit++;
        if (hit === 1) {
          return HttpResponse.json({ data: { invoice: { id: 'inv-pay', status: 'DRAFT', subtotal_cents: 10000, tax_cents:0, total_cents:10000, amount_paid_cents:2000, amount_due_cents:8000 }, line_items: [], payments: [{ id:'p1', amount_cents:2000, method:'cash', created_at: new Date().toISOString() }] } });
        }
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
    const overHandler = () => HttpResponse.json({ data: { invoice: { id: 'inv-ovr', status: 'DRAFT', subtotal_cents: 10000, tax_cents:0, total_cents:10000, amount_paid_cents:0, amount_due_cents:10000 }, line_items: [], payments: [] } });
    server.use(
      http.get('http://localhost:3001/api/admin/invoices/:id', overHandler),
      http.get('http://localhost:3000/api/admin/invoices/:id', overHandler),
      http.get('/api/admin/invoices/:id', overHandler),
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
      http.get('http://localhost:3000/api/admin/invoices/:id', () => {
        if (paid) {
          return HttpResponse.json({ data: { invoice: { id: 'inv-paid', status: 'PAID', subtotal_cents: 10000, tax_cents:0, total_cents:10000, amount_paid_cents:10000, amount_due_cents:0 }, line_items: [], payments: [ { id:'p1', amount_cents:10000, method:'cash', created_at:new Date().toISOString() } ] } });
        }
        return HttpResponse.json({ data: { invoice: { id: 'inv-paid', status: 'DRAFT', subtotal_cents: 10000, tax_cents:0, total_cents:10000, amount_paid_cents:0, amount_due_cents:10000 }, line_items: [], payments: [] } });
      }),
      http.get('/api/admin/invoices/:id', () => {
        if (paid) {
          return HttpResponse.json({ data: { invoice: { id: 'inv-paid', status: 'PAID', subtotal_cents: 10000, tax_cents:0, total_cents:10000, amount_paid_cents:10000, amount_due_cents:0 }, line_items: [], payments: [ { id:'p1', amount_cents:10000, method:'cash', created_at:new Date().toISOString() } ] } });
        }
        return HttpResponse.json({ data: { invoice: { id: 'inv-paid', status: 'DRAFT', subtotal_cents: 10000, tax_cents:0, total_cents:10000, amount_paid_cents:0, amount_due_cents:10000 }, line_items: [], payments: [] } });
      }),
    // Support both localhost variants; axios baseURL '/api' resolves to 3000 under jsdom
  http.post('http://localhost:3001/api/admin/invoices/:id/payments', () => {
        paid = true;
        return HttpResponse.json({ data: { invoice: { id: 'inv-paid', status: 'PAID', total_cents:10000, amount_paid_cents:10000, amount_due_cents:0, subtotal_cents:10000, tax_cents:0 }, payment: { id:'p1', amount_cents:10000, method:'CASH', created_at:new Date().toISOString() } } }, { status:201 });
    }),
  http.post('http://localhost:3000/api/admin/invoices/:id/payments', () => {
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
      http.get('http://localhost:3000/api/admin/invoices/:id', () => {
        if (voided) {
          return HttpResponse.json({ data: { invoice: { id: 'inv-void', status: 'VOID', subtotal_cents: 10000, tax_cents:0, total_cents:10000, amount_paid_cents:0, amount_due_cents:10000 }, line_items: [], payments: [] } });
        }
        return HttpResponse.json({ data: { invoice: { id: 'inv-void', status: 'DRAFT', subtotal_cents: 10000, tax_cents:0, total_cents:10000, amount_paid_cents:0, amount_due_cents:10000 }, line_items: [], payments: [] } });
      }),
      http.get('/api/admin/invoices/:id', () => {
        if (voided) {
          return HttpResponse.json({ data: { invoice: { id: 'inv-void', status: 'VOID', subtotal_cents: 10000, tax_cents:0, total_cents:10000, amount_paid_cents:0, amount_due_cents:10000 }, line_items: [], payments: [] } });
        }
        return HttpResponse.json({ data: { invoice: { id: 'inv-void', status: 'DRAFT', subtotal_cents: 10000, tax_cents:0, total_cents:10000, amount_paid_cents:0, amount_due_cents:10000 }, line_items: [], payments: [] } });
      }),
      http.post('http://localhost:3001/api/admin/invoices/:id/void', () => {
        voided = true;
        return HttpResponse.json({ data: { invoice: { id: 'inv-void', status: 'VOID', total_cents:10000, amount_paid_cents:0, amount_due_cents:10000, subtotal_cents:10000, tax_cents:0 } } }, { status:201 });
      }),
      http.post('http://localhost:3000/api/admin/invoices/:id/void', () => {
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
    const voidErrHandler = () => HttpResponse.json({ data: { invoice: { id: 'inv-void-err', status: 'DRAFT', subtotal_cents: 10000, tax_cents:0, total_cents:10000, amount_paid_cents:0, amount_due_cents:10000 }, line_items: [], payments: [] } });
    server.use(
      http.get('http://localhost:3001/api/admin/invoices/:id', voidErrHandler),
      http.get('http://localhost:3000/api/admin/invoices/:id', voidErrHandler),
      http.get('/api/admin/invoices/:id', voidErrHandler),
  http.post('http://localhost:3001/api/admin/invoices/:id/void', () => HttpResponse.json({ error: 'CANNOT_VOID' }, { status:400 })),
  http.post('http://localhost:3000/api/admin/invoices/:id/void', () => HttpResponse.json({ error: 'CANNOT_VOID' }, { status:400 }))
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

  it('Adds a package via ServiceCatalogModal and updates line items inline (no refetch)', async () => {
    const invoiceBase = () => HttpResponse.json({ data: { invoice: { id: 'inv-pack', status: 'DRAFT', subtotal_cents: 0, tax_cents:0, total_cents:0, amount_paid_cents:0, amount_due_cents:0 }, line_items: [], payments: [] } });
    const addPkgResponse = () => HttpResponse.json({ added_line_items: [ { id:'child-a', name:'Child A', quantity:1, unit_price_cents:5000, line_subtotal_cents:5000, tax_cents:0, total_cents:5000 }, { id:'child-b', name:'Child B', quantity:1, unit_price_cents:7000, line_subtotal_cents:7000, tax_cents:0, total_cents:7000 } ], package_name: 'Pkg 1', added_subtotal_cents: 12000 });
    const serviceOps = () => HttpResponse.json([
      { id: 'pkg-1', internal_code: 'PKG1', name: 'Package Basic', category: 'MAINTENANCE', subcategory: null, skill_level: 1, default_hours: 2, base_labor_rate: 140, keywords: ['package'], is_active: true, display_order: 1, is_package: true, package_items: [ { child_id:'child-a', quantity:1 }, { child_id:'child-b', quantity:1 } ] }
    ]);
    server.use(
      http.get('http://localhost:3001/api/admin/invoices/:id', invoiceBase),
      http.get('http://localhost:3000/api/admin/invoices/:id', invoiceBase),
      http.get('/api/admin/invoices/:id', invoiceBase),
      http.post('http://localhost:3001/api/admin/invoices/:id/add-package', addPkgResponse),
      http.post('/api/admin/invoices/:id/add-package', addPkgResponse),
      http.get('/api/admin/service-operations', serviceOps),
      http.get('http://localhost:3000/api/admin/service-operations', serviceOps),
      http.get('http://localhost:3001/api/admin/service-operations', serviceOps)
    );
    renderWithRouter('inv-pack');
    const user = userEvent.setup();
    await user.click(await screen.findByTestId('open-service-catalog-btn'));
    // Wait for package row and click its button
    const pkgRow = await screen.findByTestId('service-row-pkg-1');
    // Use Testing Library queries scoped to the row to find the button
    const { within } = await import('@testing-library/dom');
    let btn: HTMLElement | null = null;
    try { btn = within(pkgRow).getByRole('button', { name: /Add Package|Add Service/i }); } catch { /* fallback below */ }
    if (!btn) {
      btn = await screen.findByRole('button', { name: /Add Package/i });
    }
  await user.click(btn);
  // Toast text appears both in live region and visible alert; just assert at least one occurrence
  const toastTexts = await screen.findAllByText(/Added 2 item/);
  expect(toastTexts.length).toBeGreaterThan(0);
    await screen.findByText('Child A');
    await screen.findByText('Child B');
  });
});
