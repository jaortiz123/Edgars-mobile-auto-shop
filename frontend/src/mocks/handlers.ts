import { http, HttpResponse } from 'msw';

interface MockTimelineItem { id: string; occurred_at: string; status: string; services: { name: string }[]; invoice?: { total: number; paid: number; unpaid: number } | null }
const vehicleTimeline: Record<string, MockTimelineItem[]> = {
  'veh-1': Array.from({ length: 42 }).map((_, i) => ({
    id: `veh-1-appt-${i + 1}`,
    occurred_at: new Date(Date.now() - i * 86400000).toISOString(),
    status: i % 5 === 0 ? 'CANCELLED' : 'COMPLETED',
    services: [ { name: 'Oil Change' }, { name: 'Brake Inspection' } ].slice(0, (i % 2) + 1),
    invoice: { total: 150 + i, paid: 150 + i, unpaid: 0 },
  })),
};
function computeEtag(vehicleId: string): string {
  const list = vehicleTimeline[vehicleId] || [];
  const hashSource = list.slice(0,5).map(r => r.id + r.status).join('|') + ':' + list.length;
  let hash = 0; for (let i=0;i<hashSource.length;i++) hash = (hash * 31 + hashSource.charCodeAt(i)) >>> 0;
  return 'W/"veh-' + vehicleId + '-' + hash.toString(16) + '"';
}
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
  }),
  http.get('/api/admin/vehicles/:id/profile', ({ params, request }) => {
    const { id } = params as { id: string };
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    const pageSize = Number(url.searchParams.get('page_size') || '10');
    const list = vehicleTimeline[id] || [];
    const startIdx = cursor ? list.findIndex(r => r.id === cursor) + 1 : 0;
    const slice = list.slice(startIdx, startIdx + pageSize);
    const next = (startIdx + pageSize) < list.length ? slice[slice.length - 1].id : null;
    const etag = computeEtag(id);
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new HttpResponse(null, { status: 304, headers: { ETag: etag } });
    }
    return HttpResponse.json({
      header: { vehicle_id: id, year: 2020, make: 'Honda', model: 'Civic', vin: 'VINMOCK' },
      stats: { lifetime_spend: 3400, total_visits: list.length, last_service_at: list[0]?.occurred_at || null, avg_ticket: 160 },
      timeline: slice,
      page: { next_cursor: next },
      etag,
    }, { status: 200, headers: { ETag: etag } });
  })
];
