import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/admin/invoices/:id', ({ params }) => {
    const { id } = params as { id: string };
    return HttpResponse.json({
      data: {
        invoice: {
          id,
          status: 'DRAFT',
          subtotal_cents: 15000,
          tax_cents: 0,
          total_cents: 15000,
          amount_paid_cents: 0,
          amount_due_cents: 15000,
          customer_id: 1,
          customer_name: 'Dev Mock Customer',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          appointment_id: 42,
          currency: 'USD'
        },
        line_items: [
          { id: 'li-dev-1', name: 'Synthetic Oil Change', quantity: 1, unit_price_cents: 9000, line_subtotal_cents: 9000, tax_cents: 0, total_cents: 9000 },
          { id: 'li-dev-2', name: 'Cabin Filter', quantity: 1, unit_price_cents: 6000, line_subtotal_cents: 6000, tax_cents: 0, total_cents: 6000 }
        ],
        payments: []
      }
    });
  })
];
