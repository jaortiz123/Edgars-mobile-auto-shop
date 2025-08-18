// Centralized MSW handlers (host-agnostic)
// Wildcard host patterns ensure stability across localhost ports.
import { http, HttpResponse } from 'msw';

interface ServiceOperation { id: string; internal_code: string; name: string; category: string; subcategory: string | null; skill_level: number; default_hours: number; base_labor_rate: number; keywords: string[]; is_active: boolean; display_order: number; }
const serviceOperations: ServiceOperation[] = [
  { id: 'svc-oil', internal_code: 'OIL', name: 'Oil Change', category: 'MAINTENANCE', subcategory: null, skill_level: 1, default_hours: 1, base_labor_rate: 80, keywords: ['oil','change'], is_active: true, display_order: 1 },
  { id: 'svc-tire', internal_code: 'TIRE_ROT', name: 'Tire Rotation', category: 'MAINTENANCE', subcategory: null, skill_level: 1, default_hours: 0.5, base_labor_rate: 60, keywords: ['tire','rotation'], is_active: true, display_order: 2 }
];

// Simplified customer profile store for ETag 304 test
interface CustomerProfileLite { customer: { id: string; name: string }; vehicles: unknown[]; appointments: unknown[]; metrics: Record<string, unknown>; includes: string[]; }
const customerProfiles: Record<string, CustomerProfileLite> = {
  'cust-etag': {
    customer: { id: 'cust-etag', name: 'Etag Tester' },
    vehicles: [],
    appointments: [],
    metrics: { totalSpent: 0, unpaidBalance: 0, visitsCount: 0, completedCount: 0, avgTicket: 0, lastServiceAt: null, lastVisitAt: null, last12MonthsSpent: 0, last12MonthsVisits: 0, vehiclesCount: 0, isVip: false, isOverdueForService: false },
    includes: []
  }
};
const PROFILE_ETAG = 'W/"profile-v1"';

export const handlers = [
  // Service operations
  http.get('*/api/admin/service-operations', () => HttpResponse.json(serviceOperations)),
  http.get('/api/admin/service-operations', () => HttpResponse.json(serviceOperations)),

  // Invoices (detail)
  http.get('*/api/admin/invoices/:id', ({ params }) => {
    return HttpResponse.json({ data: { invoice: { id: params.id, status: 'DRAFT', subtotal_cents: 0, tax_cents: 0, total_cents: 0, amount_paid_cents: 0, amount_due_cents: 0 }, line_items: [], payments: [] } });
  }),
  http.get('/api/admin/invoices/:id', ({ params }) => HttpResponse.json({ data: { invoice: { id: params.id, status: 'DRAFT', subtotal_cents: 0, tax_cents: 0, total_cents: 0, amount_paid_cents: 0, amount_due_cents: 0 }, line_items: [], payments: [] } })),

  // Customer profile (ETag aware)
  http.get('*/api/admin/customers/:id/profile', ({ params, request }) => {
    const id = params.id as string;
    const ifNoneMatch = request.headers.get('if-none-match');
    const body = customerProfiles[id];
    if (process.env.NODE_ENV === 'test') {
      console.log('[msw] customer profile handler hit', id, 'ifNoneMatch=', ifNoneMatch);
    }
    if (!body) return HttpResponse.json({ error: 'Not found' }, { status: 404 });
    if (ifNoneMatch === PROFILE_ETAG) return new HttpResponse(null, { status: 304, headers: { ETag: PROFILE_ETAG } });
    return HttpResponse.json({ data: body }, { status: 200, headers: { ETag: PROFILE_ETAG } });
  }),
  http.get('/api/admin/customers/:id/profile', ({ params, request }) => {
    const id = params.id as string;
    const ifNoneMatch = request.headers.get('if-none-match');
    const body = customerProfiles[id];
    if (process.env.NODE_ENV === 'test') {
      console.log('[msw] customer profile handler hit (absolute)', id, 'ifNoneMatch=', ifNoneMatch);
    }
    if (!body) return HttpResponse.json({ error: 'Not found' }, { status: 404 });
    if (ifNoneMatch === PROFILE_ETAG) return new HttpResponse(null, { status: 304, headers: { ETag: PROFILE_ETAG } });
    return HttpResponse.json({ data: body }, { status: 200, headers: { ETag: PROFILE_ETAG } });
  }),

  // Minimal appointments support / silence incidental fetches
  http.get('*/api/admin/appointments/board', () => HttpResponse.json({ columns: [], cards: [] })),
  http.get('/api/admin/appointments/board', () => HttpResponse.json({ columns: [], cards: [] })),
  http.get('*/api/admin/appointments', () => HttpResponse.json({ data: { appointments: [], nextCursor: null }, errors: null, meta: { request_id: 'req-test' } })),
  http.get('/api/admin/appointments', () => HttpResponse.json({ data: { appointments: [], nextCursor: null }, errors: null, meta: { request_id: 'req-test' } })),
  http.get('*/api/appointments', () => HttpResponse.json({ data: [], meta: {} })),
  http.get('*/api/appointments/', () => HttpResponse.json({ data: [], meta: {} })),
  // Appointment services endpoints (basic empty set)
  http.get('*/api/appointments/:id/services', () => HttpResponse.json({ services: [] })),
  http.post('*/api/appointments/:id/services', async () => HttpResponse.json({ id: 'svc-new' }, { status: 201 })),
  http.patch('*/api/appointments/:id', async () => HttpResponse.json({ ok: true })),

  // Dashboard stats
  http.get('*/api/admin/dashboard/stats', () => HttpResponse.json({ data: { totals: { today_completed:0, today_booked:0, avg_cycle:0, avg_cycle_formatted:'0m' }, countsByStatus:{}, carsOnPremises:[], unpaidTotal:0 }, errors:null, meta:{ request_id: 'req-test' } })),
  http.get('/api/admin/dashboard/stats', () => HttpResponse.json({ data: { totals: { today_completed:0, today_booked:0, avg_cycle:0, avg_cycle_formatted:'0m' }, countsByStatus:{}, carsOnPremises:[], unpaidTotal:0 }, errors:null, meta:{ request_id: 'req-test' } })),

  // Notifications
  http.post('*/notifications', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ data: { id: 'notif-1', status: 'sent', body }, errors: null, meta: { request_id: 'req-test' } });
  }),
  http.post('*/api/notifications', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ data: { id: 'notif-1', status: 'sent', body }, errors: null, meta: { request_id: 'req-test' } });
  }),

  // Strict fallback
  http.all('*', ({ request }) => new HttpResponse(`Unhandled request: ${request.method} ${request.url}`, { status: 404 }))
];
