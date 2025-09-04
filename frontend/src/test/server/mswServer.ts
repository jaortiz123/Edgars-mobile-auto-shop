/**
 * Phase 2 Task 1: MSW Integration Test Server
 * Phase 2 Task 2: Happy Path Integration Workflow - Enhanced with Fixture Data
 *
 * Mock Service Worker server setup for integration testing.
 * Provides realistic HTTP handlers that mirror real API endpoints.
 */

import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// Helper function for generating request IDs
function generateRequestId(): string {
  return 'req-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
}

// Type definitions
interface MockAppointment {
  id: string;
  status: string;
  start_ts: string;
  end_ts: string;
  total_amount: number;
  paid_amount: number;
  customer_name: string;
  vehicle_label: string;
  customer_id: string;
  vehicle_id: string;
  tech_id: string | null;
  notes: string;
}

interface MockService {
  id: string;
  appointment_id: string;
  name: string;
  notes: string;
  estimated_hours: number;
  estimated_price: number;
  category: string;
  created_at?: string;
}

// Mock data fixtures - Enhanced for happy path testing
const mockAppointments: MockAppointment[] = [
  {
    id: 'appt-1',
    status: 'SCHEDULED',
    start_ts: '2024-01-10T09:00:00Z',
    end_ts: '2024-01-10T10:00:00Z',
    total_amount: 0,
    paid_amount: 0,
    customer_name: 'Test Customer',
    vehicle_label: '2018 Ford Focus',
    customer_id: 'cust-test-1',
    vehicle_id: 'veh-test-1',
    tech_id: null,
    notes: 'Test appointment for template context'
  },
  {
    id: 'apt-happy-1',
    status: 'SCHEDULED',
    start_ts: '2024-01-15T14:00:00Z',
    end_ts: '2024-01-15T15:00:00Z',
    total_amount: 250.00,
    paid_amount: 0,
    customer_name: 'Happy Path Customer',
    vehicle_label: '2020 Toyota Camry',
    customer_id: 'cust-happy-1',
    vehicle_id: 'veh-happy-1',
    tech_id: null,
    notes: 'Happy path test appointment'
  },
  {
    id: 'apt-happy-2',
    status: 'IN_PROGRESS',
    start_ts: '2024-01-15T16:00:00Z',
    end_ts: '2024-01-15T17:00:00Z',
    total_amount: 450.00,
    paid_amount: 450.00,
    customer_name: 'Another Customer',
    vehicle_label: '2019 Honda Civic',
    customer_id: 'cust-happy-2',
    vehicle_id: 'veh-happy-2',
    tech_id: 'tech-1',
    notes: 'Secondary test appointment'
  }
];

const mockCustomers = [
  {
    id: 'cust-test-1',
    name: 'Test Customer',
    email: 'test@example.com',
    phone: '+15550000000'
  },
  {
    id: 'cust-happy-1',
    name: 'Happy Path Customer',
    email: 'happy@example.com',
    phone: '+15551234567'
  },
  {
    id: 'cust-happy-2',
    name: 'Another Customer',
    email: 'another@example.com',
    phone: '+15559876543'
  }
];

const mockVehicles = [
  {
    id: 'veh-test-1',
    year: 2018,
    make: 'Ford',
    model: 'Focus',
    vin: 'TESTVIN000000001'
  },
  {
    id: 'veh-happy-1',
    year: 2020,
    make: 'Toyota',
    model: 'Camry',
    vin: '1HGBH41JXMN109186'
  },
  {
    id: 'veh-happy-2',
    year: 2019,
    make: 'Honda',
    model: 'Civic',
    vin: '2HGBH41JXMN109187'
  }
];

const mockServices: MockService[] = [
  {
    id: 'svc-happy-1',
    appointment_id: 'apt-happy-1',
    name: 'Oil Change',
    notes: 'Full synthetic oil',
    estimated_hours: 0.5,
    estimated_price: 75.00,
    category: 'Maintenance'
  },
  {
    id: 'svc-happy-2',
    appointment_id: 'apt-happy-1',
    name: 'Brake Inspection',
    notes: 'Check brake pads and rotors',
    estimated_hours: 1.0,
    estimated_price: 175.00,
    category: 'Inspection'
  },
  {
    id: 'svc-happy-3',
    appointment_id: 'apt-happy-2',
    name: 'Brake Pad Replacement',
    notes: 'Front brake pads',
    estimated_hours: 2.0,
    estimated_price: 350.00,
    category: 'Repair'
  },
  {
    id: 'svc-happy-4',
    appointment_id: 'apt-happy-2',
    name: 'Engine Diagnostics',
    notes: 'Check engine light diagnosis',
    estimated_hours: 1.5,
    estimated_price: 100.00,
    category: 'Diagnostics'
  }
];

// Simple in-memory stores for entities that need ETag semantics in tests
const vehicleStore: Record<string, { etag: string; data: Record<string, unknown> }> = {
  v1: { etag: 'veh-etag-original', data: { id: 'v1', make: 'Ford', model: 'Focus', year: 2018, vin: 'VIN1', license_plate: 'AAA111' } },
};

// Request handlers
const handlers = [
  // --- Vehicle profile timeline (avoid /api/api duplication by using relative matches) ---
  http.get('/api/admin/vehicles/:vehicleId/profile', ({ params, request }) => {
    const { vehicleId } = params as { vehicleId: string };
    // Deterministic dataset of 12 rows to support pagination tests
    const dataset = Array.from({ length: 12 }).map((_, i) => ({
      id: `veh-${vehicleId}-row-${i+1}`,
      type: 'appointment',
      occurred_at: new Date(Date.now() - i * 60000).toISOString(),
      status: 'COMPLETED',
      services: [{ name: 'Oil Change' }],
      invoice: { total: 100 + i, paid: 100 + i, unpaid: 0 }
    }));
    const url = new URL(request.url);
    const pageSize = Number(url.searchParams.get('page_size') || '5');
    const cursor = url.searchParams.get('cursor');
    // cursor corresponds to last item id from previous page
    const start = cursor ? (dataset.findIndex(r => r.id === cursor) + 1) : 0;
    const slice = dataset.slice(start, start + pageSize);
    const next = (start + pageSize) < dataset.length ? slice[slice.length - 1].id : null;
    const header = { vehicle_id: vehicleId, year: 2020, make: 'Toyota', model: 'Camry', trim: null, plate: 'ABC123', vin: '1HGBH41JXMN109186', customer_id: 'cust-happy-1' };
    const stats = { lifetime_spend: 10000, total_visits: dataset.length, last_service_at: dataset[0].occurred_at, avg_ticket: 10000 };
    const etag = 'W/"veh-integ-etag"';
    const inm = request.headers.get('if-none-match');
    if (!cursor && inm && inm === etag) {
      return new HttpResponse(null, { status: 304, headers: { ETag: etag } });
    }
    return HttpResponse.json({ header, stats, timeline: slice, page: { next_cursor: next }, etag }, { headers: { ETag: etag } });
  }),
  // Also support localhost absolute URL variants
  http.get('http://localhost:3000/api/admin/vehicles/:vehicleId/profile', ({ params, request }) => {
    const { vehicleId } = params as { vehicleId: string };
    const dataset = Array.from({ length: 12 }).map((_, i) => ({
      id: `veh-${vehicleId}-row-${i+1}`,
      type: 'appointment',
      occurred_at: new Date(Date.now() - i * 60000).toISOString(),
      status: 'COMPLETED',
      services: [{ name: 'Oil Change' }],
      invoice: { total: 100 + i, paid: 100 + i, unpaid: 0 }
    }));
    const url = new URL(request.url);
    const pageSize = Number(url.searchParams.get('page_size') || '5');
    const cursor = url.searchParams.get('cursor');
    const start = cursor ? (dataset.findIndex(r => r.id === cursor) + 1) : 0;
    const slice = dataset.slice(start, start + pageSize);
    const next = (start + pageSize) < dataset.length ? slice[slice.length - 1].id : null;
    const header = { vehicle_id: vehicleId, year: 2020, make: 'Toyota', model: 'Camry', trim: null, plate: 'ABC123', vin: '1HGBH41JXMN109186', customer_id: 'cust-happy-1' };
    const stats = { lifetime_spend: 10000, total_visits: dataset.length, last_service_at: dataset[0].occurred_at, avg_ticket: 10000 };
    const etag = 'W/"veh-integ-etag"';
    const inm = request.headers.get('if-none-match');
    if (!cursor && inm && inm === etag) {
      return new HttpResponse(null, { status: 304, headers: { ETag: etag } });
    }
    return HttpResponse.json({ header, stats, timeline: slice, page: { next_cursor: next }, etag }, { headers: { ETag: etag } });
  }),
  // Service operations endpoint (added for multi-service QuickAddModal tests)
  http.get('http://localhost:3000/api/admin/service-operations', () => {
    // Default dataset aligned with tests: multiple categories and subcategories
    return HttpResponse.json([
      { id: 'svc-1', internal_code: 'OIL', name: 'Oil Change', category: 'MAINTENANCE', subcategory: 'Fluids', skill_level: 1, default_hours: 1, base_labor_rate: 80, keywords: ['oil','change'], is_active: true, display_order: 2 },
  { id: 'svc-2', internal_code: 'BRK-INSP', name: 'Brake Inspection', category: 'BRAKES', subcategory: 'Inspection', skill_level: 1, default_hours: 0.5, base_labor_rate: 60, keywords: ['brake','inspection'], is_active: true, display_order: 1 },
  { id: 'svc-3', internal_code: 'ALIGN', name: 'Alignment', category: 'CHASSIS', subcategory: null, skill_level: 1, default_hours: 1, base_labor_rate: 120, keywords: ['alignment','wheel'], is_active: true, display_order: 3 },
  { id: 'svc-5', internal_code: 'ROT', name: 'Tire Rotation', category: 'TIRES', subcategory: null, skill_level: 1, default_hours: 0.5, base_labor_rate: 40, keywords: ['rotation','tire'], is_active: true, display_order: 5 },
      { id: 'svc-4', internal_code: 'COOL', name: 'Coolant Flush', category: 'MAINTENANCE', subcategory: 'Fluids', skill_level: 1, default_hours: 1.2, base_labor_rate: 89, keywords: ['coolant','flush'], is_active: true, display_order: 4 }
    ]);
  }),
  http.get('http://localhost/api/admin/service-operations', () => {
    return HttpResponse.json([
      { id: 'svc-1', internal_code: 'OIL', name: 'Oil Change', category: 'MAINTENANCE', subcategory: 'Fluids', skill_level: 1, default_hours: 1, base_labor_rate: 80, keywords: ['oil','change'], is_active: true, display_order: 2 },
  { id: 'svc-2', internal_code: 'BRK-INSP', name: 'Brake Inspection', category: 'BRAKES', subcategory: 'Inspection', skill_level: 1, default_hours: 0.5, base_labor_rate: 60, keywords: ['brake','inspection'], is_active: true, display_order: 1 },
  { id: 'svc-3', internal_code: 'ALIGN', name: 'Alignment', category: 'CHASSIS', subcategory: null, skill_level: 1, default_hours: 1, base_labor_rate: 120, keywords: ['alignment','wheel'], is_active: true, display_order: 3 },
  { id: 'svc-5', internal_code: 'ROT', name: 'Tire Rotation', category: 'TIRES', subcategory: null, skill_level: 1, default_hours: 0.5, base_labor_rate: 40, keywords: ['rotation','tire'], is_active: true, display_order: 5 },
      { id: 'svc-4', internal_code: 'COOL', name: 'Coolant Flush', category: 'MAINTENANCE', subcategory: 'Fluids', skill_level: 1, default_hours: 1.2, base_labor_rate: 89, keywords: ['coolant','flush'], is_active: true, display_order: 4 }
    ]);
  }),
  http.get('http://localhost:3001/admin/service-operations', () => {
    return HttpResponse.json({ service_operations: [
      { id: 'svc-1', internal_code: 'OIL', name: 'Oil Change', category: 'MAINTENANCE', subcategory: 'Fluids', skill_level: 1, default_hours: 1, base_labor_rate: 80, keywords: ['oil','change'], is_active: true, display_order: 2 },
  { id: 'svc-2', internal_code: 'BRK-INSP', name: 'Brake Inspection', category: 'BRAKES', subcategory: 'Inspection', skill_level: 1, default_hours: 0.5, base_labor_rate: 60, keywords: ['brake','inspection'], is_active: true, display_order: 1 },
  { id: 'svc-3', internal_code: 'ALIGN', name: 'Alignment', category: 'CHASSIS', subcategory: null, skill_level: 1, default_hours: 1, base_labor_rate: 120, keywords: ['alignment','wheel'], is_active: true, display_order: 3 },
  { id: 'svc-5', internal_code: 'ROT', name: 'Tire Rotation', category: 'TIRES', subcategory: null, skill_level: 1, default_hours: 0.5, base_labor_rate: 40, keywords: ['rotation','tire'], is_active: true, display_order: 5 },
      { id: 'svc-4', internal_code: 'COOL', name: 'Coolant Flush', category: 'MAINTENANCE', subcategory: 'Fluids', skill_level: 1, default_hours: 1.2, base_labor_rate: 89, keywords: ['coolant','flush'], is_active: true, display_order: 4 }
    ]});
  }),
  // Relative match for axios http.get('/admin/service-operations')
  http.get('/api/admin/service-operations', () => {
    return HttpResponse.json([
      { id: 'svc-1', internal_code: 'OIL', name: 'Oil Change', category: 'MAINTENANCE', subcategory: 'Fluids', skill_level: 1, default_hours: 1, base_labor_rate: 80, keywords: ['oil','change'], is_active: true, display_order: 2 },
  { id: 'svc-2', internal_code: 'BRK-INSP', name: 'Brake Inspection', category: 'BRAKES', subcategory: 'Inspection', skill_level: 1, default_hours: 0.5, base_labor_rate: 60, keywords: ['brake','inspection'], is_active: true, display_order: 1 },
  { id: 'svc-3', internal_code: 'ALIGN', name: 'Alignment', category: 'CHASSIS', subcategory: null, skill_level: 1, default_hours: 1, base_labor_rate: 120, keywords: ['alignment','wheel'], is_active: true, display_order: 3 },
  { id: 'svc-5', internal_code: 'ROT', name: 'Tire Rotation', category: 'TIRES', subcategory: null, skill_level: 1, default_hours: 0.5, base_labor_rate: 40, keywords: ['rotation','tire'], is_active: true, display_order: 5 },
      { id: 'svc-4', internal_code: 'COOL', name: 'Coolant Flush', category: 'MAINTENANCE', subcategory: 'Fluids', skill_level: 1, default_hours: 1.2, base_labor_rate: 89, keywords: ['coolant','flush'], is_active: true, display_order: 4 }
    ]);
  }),
  // Invoice detail endpoint mock
  http.get('http://localhost:3000/api/admin/invoices/:id', ({ params }) => {
    const { id } = params as { id: string };
    const baseTotal = 15000; // cents
    const mockInvoice = {
      invoice: {
        id,
        status: 'DRAFT',
        subtotal_cents: baseTotal,
        tax_cents: 0,
        total_cents: baseTotal,
        amount_paid_cents: 5000,
        amount_due_cents: baseTotal - 5000,
        customer_id: 1,
        customer_name: 'Mock Customer',
        issued_at: null,
        paid_at: null,
        voided_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: 'Mock invoice for testing',
        appointment_id: 123,
        currency: 'USD'
      },
      line_items: [
        { id: 'li1', name: 'Oil Change', quantity: 1, unit_price_cents: 5000, line_subtotal_cents: 5000, tax_cents: 0, total_cents: 5000 },
        { id: 'li2', name: 'Brake Inspection', quantity: 1, unit_price_cents: 10000, line_subtotal_cents: 10000, tax_cents: 0, total_cents: 10000 }
      ],
      payments: [
        { id: 'pay1', amount_cents: 5000, method: 'card', created_at: new Date().toISOString() }
      ]
    };
    return HttpResponse.json({ data: mockInvoice });
  }),

  // IMPORTANT: Missing variant with /api prefix for localhost:3001 used by fetchInvoice in unit tests
  // Without this, requests may leak to a real backend on port 3001 producing unexpected empty invoices.
  http.get('http://localhost:3001/api/admin/invoices/:id', ({ params, request }) => {
    const { id } = params as { id: string };
    // Provide a deterministic but simple invoice; individual tests override this via server.use.
    // Logging aids debugging when per-test overrides fail to register.
    // Use different status so it's obvious if override didn't apply in tests expecting PAID/VOID/etc.
    const mockInvoice = {
      invoice: {
        id,
        status: 'BASE_API_3001',
        subtotal_cents: 12345,
        tax_cents: 0,
        total_cents: 12345,
        amount_paid_cents: 0,
        amount_due_cents: 12345,
        customer_id: 99,
        customer_name: 'Base 3001/API Invoice',
        issued_at: null,
        paid_at: null,
        voided_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: 'Base handler (should be overridden in most tests)',
        appointment_id: 999,
        currency: 'USD'
      },
      line_items: [
        { id: 'li-base', name: 'Base Item', quantity: 1, unit_price_cents: 12345, line_subtotal_cents: 12345, tax_cents: 0, total_cents: 12345 }
      ],
      payments: []
    };
    console.log('[MSW] matched 3001/api invoice handler', request.url);
    return HttpResponse.json({ data: mockInvoice });
  }),

  http.get('http://localhost:3001/admin/invoices/:id', ({ params }) => {
    const { id } = params as { id: string };
    const mockInvoice = {
      invoice: {
        id,
        status: 'PAID',
        subtotal_cents: 20000,
        tax_cents: 0,
        total_cents: 20000,
        amount_paid_cents: 20000,
        amount_due_cents: 0,
        customer_id: 2,
        customer_name: 'Alt Customer',
        issued_at: new Date().toISOString(),
        paid_at: new Date().toISOString(),
        voided_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: 'Alternate host invoice',
        appointment_id: 456,
        currency: 'USD'
      },
      line_items: [
        { id: 'li3', name: 'Tire Rotation', quantity: 1, unit_price_cents: 8000, line_subtotal_cents: 8000, tax_cents: 0, total_cents: 8000 },
        { id: 'li4', name: 'Alignment', quantity: 1, unit_price_cents: 12000, line_subtotal_cents: 12000, tax_cents: 0, total_cents: 12000 }
      ],
      payments: [
        { id: 'pay2', amount_cents: 20000, method: 'cash', created_at: new Date().toISOString() }
      ]
    };
    return HttpResponse.json({ data: mockInvoice });
  }),

  // --- Invoice actions: payments and void (relative /api variants for axios baseURL) ---
  http.post('/api/admin/invoices/:id/payments', async ({ params, request }) => {
    const { id } = params as { id: string };
    try {
      const body = await request.json() as { amountCents?: number; method?: string; note?: string };
      const amount = body?.amountCents ?? 1000;
      const method = body?.method ?? 'CARD';
      // Simulate overpayment error for a specific invoice id used in tests
      if (id === 'inv-ovr' && amount > 10000) {
        return HttpResponse.json({ error: 'OVERPAYMENT' }, { status: 400 });
      }
      return HttpResponse.json({
        data: {
          invoice: {
            id,
            status: 'PARTIALLY_PAID',
            subtotal_cents: 10000,
            tax_cents: 0,
            total_cents: 10000,
            amount_paid_cents: Math.min(10000, amount),
            amount_due_cents: Math.max(0, 10000 - amount)
          },
          payment: {
            id: 'pay-msw-1',
            amount_cents: amount,
            method,
            created_at: new Date().toISOString(),
            note: body?.note ?? null
          }
        }
      }, { status: 201 });
    } catch {
      return HttpResponse.json({ error: 'PAYMENT_FAILED' }, { status: 400 });
    }
  }),
  // Absolute URL variants for environments/tests using explicit hosts
  http.post('http://localhost:3001/api/admin/invoices/:id/payments', async ({ params, request }) => {
    const { id } = params as { id: string };
    try {
      const body = await request.json() as { amountCents?: number; method?: string; note?: string };
      const amount = body?.amountCents ?? 1000;
      const method = body?.method ?? 'CARD';
      if (id === 'inv-ovr' && amount > 10000) {
        return HttpResponse.json({ error: 'OVERPAYMENT' }, { status: 400 });
      }
      return HttpResponse.json({
        data: {
          invoice: { id, status: 'PARTIALLY_PAID', subtotal_cents: 10000, tax_cents: 0, total_cents: 10000, amount_paid_cents: Math.min(10000, amount), amount_due_cents: Math.max(0, 10000 - amount) },
          payment: { id: 'pay-msw-abs-3001', amount_cents: amount, method, created_at: new Date().toISOString(), note: body?.note ?? null }
        }
      }, { status: 201 });
    } catch {
      return HttpResponse.json({ error: 'PAYMENT_FAILED' }, { status: 400 });
    }
  }),
  http.post('http://localhost:3000/api/admin/invoices/:id/payments', async ({ params, request }) => {
    const { id } = params as { id: string };
    try {
      const body = await request.json() as { amountCents?: number; method?: string; note?: string };
      const amount = body?.amountCents ?? 1000;
      const method = body?.method ?? 'CARD';
      if (id === 'inv-ovr' && amount > 10000) {
        return HttpResponse.json({ error: 'OVERPAYMENT' }, { status: 400 });
      }
      return HttpResponse.json({
        data: {
          invoice: { id, status: 'PARTIALLY_PAID', subtotal_cents: 10000, tax_cents: 0, total_cents: 10000, amount_paid_cents: Math.min(10000, amount), amount_due_cents: Math.max(0, 10000 - amount) },
          payment: { id: 'pay-msw-abs-3000', amount_cents: amount, method, created_at: new Date().toISOString(), note: body?.note ?? null }
        }
      }, { status: 201 });
    } catch {
      return HttpResponse.json({ error: 'PAYMENT_FAILED' }, { status: 400 });
    }
  }),
  // Email send endpoint for invoices (TimelineRow)
  http.post('/api/admin/invoices/:id/send', ({ params }) => {
    const { id } = params as { id: string };
    // Always accept and return 202 per implementation contract
    return new HttpResponse(null, { status: 202, headers: { 'x-invoice-id': id } });
  }),
  http.post('http://localhost:3000/api/admin/invoices/:id/send', ({ params }) => {
    const { id } = params as { id: string };
    return new HttpResponse(null, { status: 202, headers: { 'x-invoice-id': id } });
  }),
  // Customers GET/PATCH for optimistic edit flows
  http.get('/api/admin/customers/:id', ({ params }) => {
    const { id } = params as { id: string };
    return HttpResponse.json({ data: { id, name: 'Server User', email: 'server@example.com', phone: '999' } }, { headers: { ETag: 'etag-server' } });
  }),
  http.patch('/api/admin/customers/:id', async ({ params, request }) => {
    const { id } = params as { id: string };
    const ifMatch = request.headers.get('if-match');
    // Simulate conflict when an If-Match is provided but doesn't match current 'etag-server'
    if (ifMatch && ifMatch !== 'etag-server') {
      return new HttpResponse('precondition', { status: 412 });
    }
    const body = await request.json().catch(() => ({})) as { name?: string; phone?: string; email?: string };
    return HttpResponse.json({ data: { id, name: body.name ?? 'Updated', phone: body.phone ?? '222', email: body.email ?? 'user@x.com' } }, { headers: { ETag: 'etag-new' } });
  }),
  // localhost:3000 variants for unit tests using absolute URLs
  http.get('http://localhost:3000/api/admin/customers/:id', ({ params }) => {
    const { id } = params as { id: string };
    return HttpResponse.json({ data: { id, name: 'Server User', email: 'server@example.com', phone: '999' } }, { headers: { ETag: 'etag-server' } });
  }),
  http.patch('http://localhost:3000/api/admin/customers/:id', async ({ params, request }) => {
    const { id } = params as { id: string };
    const ifMatch = request.headers.get('if-match');
    if (ifMatch && ifMatch !== 'etag-server') {
      return new HttpResponse('precondition', { status: 412 });
    }
    const body = await request.json().catch(() => ({})) as { name?: string; phone?: string; email?: string };
    return HttpResponse.json({ data: { id, name: body.name ?? 'Updated', phone: body.phone ?? '222', email: body.email ?? 'user@x.com' } }, { headers: { ETag: 'etag-new' } });
  }),
  http.post('/api/admin/invoices/:id/void', async ({ params }) => {
    const { id } = params as { id: string };
    return HttpResponse.json({
      data: {
        invoice: {
          id,
          status: 'VOID',
          subtotal_cents: 10000,
          tax_cents: 0,
          total_cents: 10000,
          amount_paid_cents: 0,
          amount_due_cents: 10000,
          voided_at: new Date().toISOString()
        }
      }
    }, { status: 201 });
  }),

  // --- Vehicles (optimistic edit) with ETag + 412 semantics ---
  http.get('/api/admin/vehicles/:id', ({ params }) => {
    const id = String((params as { id: string }).id);
  const current = vehicleStore[id] || { etag: 'vetag0', data: { id } };
    return HttpResponse.json({ data: current.data }, { headers: { ETag: current.etag } });
  }),
  http.patch('/api/admin/vehicles/:id', async ({ params, request }) => {
    const id = String((params as { id: string }).id);
    const ifMatch = request.headers.get('if-match');
  const current = vehicleStore[id] || { etag: 'vetag0', data: { id } };
    if (ifMatch && ifMatch !== current.etag) {
      return new HttpResponse('precondition', { status: 412 });
    }
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const nextEtag = current.etag === 'veh-etag-original' ? 'veh-etag-new' : `vetag${Date.now()}`;
    const nextData = { ...current.data, ...body };
    vehicleStore[id] = { etag: nextEtag, data: nextData };
    return HttpResponse.json({ data: nextData }, { headers: { ETag: nextEtag } });
  }),
  // localhost:3000 variants
  http.get('http://localhost:3000/api/admin/vehicles/:id', ({ params }) => {
    const id = String((params as { id: string }).id);
  const current = vehicleStore[id] || { etag: 'vetag0', data: { id } };
    return HttpResponse.json({ data: current.data }, { headers: { ETag: current.etag } });
  }),
  http.patch('http://localhost:3000/api/admin/vehicles/:id', async ({ params, request }) => {
    const id = String((params as { id: string }).id);
    const ifMatch = request.headers.get('if-match');
  const current = vehicleStore[id] || { etag: 'vetag0', data: { id } };
    if (ifMatch && ifMatch !== current.etag) {
      return new HttpResponse('precondition', { status: 412 });
    }
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const nextEtag = current.etag === 'veh-etag-original' ? 'veh-etag-new' : `vetag${Date.now()}`;
    const nextData = { ...current.data, ...body };
    vehicleStore[id] = { etag: nextEtag, data: nextData };
    return HttpResponse.json({ data: nextData }, { headers: { ETag: nextEtag } });
  }),

  // --- Customers profile timeline (supports include_invoices & limit_appointments) ---
  http.get('/api/admin/customers/:id/profile', ({ params, request }) => {
    const id = String((params as { id: string }).id);
    const url = new URL(request.url, 'http://localhost');
    const includeInvoices = url.searchParams.get('include_invoices') === 'true';
    const limitAppts = Number(url.searchParams.get('limit_appointments') || '5');
    const etag = 'W/"cust-prof-etag"';
    const ifNoneMatch = request.headers.get('if-none-match');
    // Build deterministic page (single page)
    const appointments = Array.from({ length: limitAppts }).map((_, i) => ({
      id: `apt-${i + 1}`,
      status: 'COMPLETED',
      start: new Date(Date.now() - i * 86400000).toISOString(),
      total_amount: 100 * (i + 1),
    }));
    const invoices = includeInvoices ? appointments.map((_, i) => ({ id: `inv-${i + 1}`, total_cents: 10000 + i * 1000 })) : undefined;
    const payload = {
      header: { customer_id: id, name: 'Test Customer' },
      timeline: appointments,
      invoices,
      page: { next_cursor: null },
    };
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new HttpResponse(null, { status: 304, headers: { ETag: etag } });
    }
    return HttpResponse.json(payload, { headers: { ETag: etag } });
  }),
  http.get('http://localhost:3000/api/admin/customers/:id/profile', ({ params, request }) => {
    const id = String((params as { id: string }).id);
    const url = new URL(request.url);
    const includeInvoices = url.searchParams.get('include_invoices') === 'true';
    const limitAppts = Number(url.searchParams.get('limit_appointments') || '5');
    const cursor = url.searchParams.get('cursor');
    const page1 = { customer: { id, full_name: 'Ada', created_at: '2025-01-01T00:00:00Z' }, stats: { lifetime_spend: 0, unpaid_balance: 0, total_visits: 0, last_visit_at: null, avg_ticket: 0, last_service_at: null }, vehicles: [], appointments: [{ id: 'a1', vehicle_id: 'v1', scheduled_at: '2025-07-01T00:00:00Z', status: 'COMPLETED', services: [], invoice: null }], page: { page_size: limitAppts, has_more: true, next_cursor: 'CUR2' } };
    const page2 = { customer: { id, full_name: 'Ada', created_at: '2025-01-01T00:00:00Z' }, stats: { lifetime_spend: 0, unpaid_balance: 0, total_visits: 0, last_visit_at: null, avg_ticket: 0, last_service_at: null }, vehicles: [], appointments: [{ id: 'a0', vehicle_id: 'v1', scheduled_at: '2025-06-01T00:00:00Z', status: 'COMPLETED', services: [], invoice: null }], page: { page_size: limitAppts, has_more: false, next_cursor: null } };
    const payload = cursor ? page2 : page1;
    if (includeInvoices) {
      // augment appointments with a synthetic invoice mirror
      const p = payload as unknown as { appointments: Array<unknown>; [k: string]: unknown };
      const appts = Array.isArray(p.appointments) ? p.appointments : [];
      (p as { invoices?: Array<{ id: string; total_cents: number }> }).invoices = appts.map((_, i) => ({ id: `inv-${i + 1}`, total_cents: 10000 + i * 1000 }));
    }
    return HttpResponse.json(payload);
  }),

  // --- Customer lookup ---
  http.get('/api/customers/lookup', ({ request }) => {
    const url = new URL(request.url, 'http://localhost');
    const phone = url.searchParams.get('phone') || '';
    if (phone.endsWith('1111')) {
      return HttpResponse.json({
        customer: { id: 'c1', name: 'Alice Auto', phone: '5305551111' },
        vehicles: [{ id: 'v1', year: 2020, make: 'Honda', model: 'Civic', license_plate: 'AAA111' }]
      });
    }
    if (phone.endsWith('2222')) {
      return HttpResponse.json({
        customer: { id: 'c2', name: 'Bob Fleet', phone: '5305552222' },
        vehicles: [
          { id: 'v2', year: 2019, make: 'Ford', model: 'F-150', license_plate: 'BBB222' },
          { id: 'v3', year: 2021, make: 'Tesla', model: 'Model 3', license_plate: 'CCC333' }
        ]
      });
    }
    if (phone.endsWith('3333')) {
      return HttpResponse.json({ error: 'not found' }, { status: 404 });
    }
    return HttpResponse.json({ error: 'not found' }, { status: 404 });
  }),
  http.get('http://localhost:3000/api/customers/lookup', ({ request }) => {
    const url = new URL(request.url);
    const phone = url.searchParams.get('phone') || '';
    if (phone.endsWith('1111')) {
      return HttpResponse.json({
        customer: { id: 'c1', name: 'Alice Auto', phone: '5305551111' },
        vehicles: [{ id: 'v1', year: 2020, make: 'Honda', model: 'Civic', license_plate: 'AAA111' }]
      });
    }
    if (phone.endsWith('2222')) {
      return HttpResponse.json({
        customer: { id: 'c2', name: 'Bob Fleet', phone: '5305552222' },
        vehicles: [
          { id: 'v2', year: 2019, make: 'Ford', model: 'F-150', license_plate: 'BBB222' },
          { id: 'v3', year: 2021, make: 'Tesla', model: 'Model 3', license_plate: 'CCC333' }
        ]
      });
    }
    if (phone.endsWith('3333')) {
      return HttpResponse.json({ error: 'not found' }, { status: 404 });
    }
    return HttpResponse.json({ error: 'not found' }, { status: 404 });
  }),

  // --- Customers Search (CustomersPage) ---
  http.get('/api/admin/customers/search', ({ request }) => {
    const url = new URL(request.url, 'http://localhost');
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const filter = url.searchParams.get('filter') || 'all';
    const sortBy = url.searchParams.get('sortBy') || 'relevance';
    // Minimal dataset that covers tests
    const items = [
      { vehicleId: 'v1', customerId: 'c1', name: 'Alice A', phone: '555-1111', visitsCount: 3, lastVisit: null, plate: 'ABC123', vehicle: 'Honda Civic' },
      { vehicleId: 'v2', customerId: 'c2', name: 'Bob B', email: 'bob@example.com', visitsCount: 1, lastVisit: null, plate: 'XYZ999', vehicle: 'Toyota Camry' },
      { vehicleId: 'v3', customerId: 'c9', name: 'Nav Test', phone: '555-9999', visitsCount: 1, lastVisit: null },
    ];
    let results = items.filter(i => !q || i.name.toLowerCase().includes(q) || (i.phone || '').includes(q) || (i.plate || '').toLowerCase().includes(q));
    if (filter === 'vip') {
      results = results.filter(i => i.name.toLowerCase().includes('vip'));
    }
    if (sortBy === 'name_asc') results = [...results].sort((a,b) => a.name.localeCompare(b.name));
  // highest_lifetime_spend: keep current order for test purposes
    return HttpResponse.json({ data: { items: results } });
  }),
  http.get('http://localhost:3000/api/admin/customers/search', ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const items = [
      { vehicleId: 'v1', customerId: 'c1', name: 'Alice A', phone: '555-1111', visitsCount: 2, lastVisit: null, plate: 'ABC123', vehicle: 'Honda Civic' },
      { vehicleId: 'v2', customerId: 'c1', name: 'Alice A', phone: '555-1111', visitsCount: 5, lastVisit: null, plate: 'XYZ789', vehicle: 'Toyota Camry' },
      { vehicleId: 'v2', customerId: 'c2', name: 'Bob B', email: 'bob@example.com', visitsCount: 1, lastVisit: null }
    ];
    const results = items.filter(i => !q || i.name.toLowerCase().includes(q) || (i.phone || '').includes(q) || (i.plate || '').toLowerCase().includes(q));
    return HttpResponse.json({ data: { items: results } });
  }),

  // --- Technicians ---
  http.get('/api/admin/technicians', () => {
    return HttpResponse.json({ technicians: [
      { id: 'tech-1', name: 'Sam' },
      { id: 'tech-2', name: 'Riley' }
    ]});
  }),
  http.get('http://localhost:3000/api/admin/technicians', () => {
    return HttpResponse.json({ technicians: [
      { id: 'tech-1', name: 'Sam' },
      { id: 'tech-2', name: 'Riley' }
    ]});
  }),

  // --- Message Templates (list/get/create/update) ---
  http.get('/api/admin/message-templates', () => {
    return HttpResponse.json({ message_templates: [
  { id: 'tpl-1', slug: 'tpl-1', label: 'Vehicle Ready', channel: 'sms', category: 'status', body: 'Hi {{customer.name}}, your vehicle is ready!', variables: [], is_active: true },
  { id: 'tpl-2', slug: 'tpl-2', label: 'Reminder', channel: 'sms', category: 'reminder', body: 'Reminder: appointment soon', variables: [], is_active: true }
    ]});
  }),
  http.get('http://localhost:3000/api/admin/message-templates', () => {
    return HttpResponse.json({ message_templates: [
  { id: 'tpl-1', slug: 'tpl-1', label: 'Vehicle Ready', channel: 'sms', category: 'status', body: 'Hi {{customer.name}}, your vehicle is ready!', variables: [], is_active: true },
  { id: 'tpl-2', slug: 'tpl-2', label: 'Reminder', channel: 'sms', category: 'reminder', body: 'Reminder: appointment soon', variables: [], is_active: true }
    ]});
  }),
  http.get('/api/admin/message-templates/:id', ({ params }) => {
    const id = String((params as { id: string }).id);
    return HttpResponse.json({ id, slug: 'example', label: 'Example', channel: 'sms', category: null, body: 'Body', variables: [], is_active: true });
  }),
  http.post('/api/admin/message-templates', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ id: 'new', slug: String(body.slug || 'new'), label: String(body.label || 'New'), channel: String(body.channel || 'sms'), category: body.category ?? null, body: String(body.body || ''), variables: [], is_active: true }, { status: 201 });
  }),
  http.patch('/api/admin/message-templates/:id', async ({ params, request }) => {
    const id = String((params as { id: string }).id);
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ id, slug: 'new', label: String(body.label || 'Updated'), channel: String(body.channel || 'sms'), category: body.category ?? null, body: String(body.body || ''), variables: [], is_active: true });
  }),
  // host variant for unit tests that use localhost:3000
  http.post('http://localhost:3000/api/admin/message-templates', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ id: 'new', slug: String(body.slug || 'new'), label: String(body.label || 'New'), channel: String(body.channel || 'sms'), category: body.category ?? null, body: String(body.body || ''), variables: [], is_active: true }, { status: 201 });
  }),
  http.patch('http://localhost:3000/api/admin/message-templates/:id', async ({ params, request }) => {
    const id = String((params as { id: string }).id);
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ id, slug: 'new', label: String(body.label || 'Updated'), channel: String(body.channel || 'sms'), category: body.category ?? null, body: String(body.body || ''), variables: [], is_active: true });
  }),

  // --- Appointment Messages (relative + localhost:3000) ---
  http.get('/api/appointments/:id/messages', () => {
    return HttpResponse.json({ messages: [], errors: null, meta: { request_id: generateRequestId() } });
  }),
  http.post('/api/appointments/:id/messages', async ({ request }) => {
    await request.json().catch(() => ({}));
    return HttpResponse.json({ id: `msg-${Date.now()}`, status: 'sent', errors: null, meta: { request_id: generateRequestId() } }, { status: 201 });
  }),
  http.get('http://localhost:3000/api/appointments/:id/messages', () => {
    return HttpResponse.json({ messages: [], errors: null, meta: { request_id: generateRequestId() } });
  }),
  http.post('http://localhost:3000/api/appointments/:id/messages', async ({ request }) => {
    await request.json().catch(() => ({}));
    return HttpResponse.json({ id: `msg-${Date.now()}`, status: 'sent', errors: null, meta: { request_id: generateRequestId() } }, { status: 201 });
  }),
  // --- Invoices list (for InvoicesPage) ---
  http.get('/api/admin/invoices', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') || '1');
    const pageSize = Number(url.searchParams.get('pageSize') || '20');
    // simple deterministic set: empty on page > 1
    const items = page > 1 ? [] : [
      { id: 'inv1', status: 'PAID', total_cents: 10000, amount_due_cents: 0, amount_paid_cents: 10000, subtotal_cents:10000, tax_cents:0, created_at: new Date().toISOString(), issued_at: new Date().toISOString(), updated_at: new Date().toISOString(), customer_id: 1, customer_name: 'Alice' },
      { id: 'inv2', status: 'DRAFT', total_cents: 2500, amount_due_cents: 2500, amount_paid_cents: 0, subtotal_cents:2500, tax_cents:0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), customer_id: 2, customer_name: 'Bob' }
    ];
    return HttpResponse.json({ data: { items, page, page_size: pageSize, total_items: items.length, total_pages: 1 } });
  }),
  http.get('http://localhost:3000/api/admin/invoices', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') || '1');
    const pageSize = Number(url.searchParams.get('pageSize') || '20');
    const items = page > 1 ? [] : [
      { id: 'inv1', status: 'PAID', total_cents: 10000, amount_due_cents: 0, amount_paid_cents: 10000, subtotal_cents:10000, tax_cents:0, created_at: new Date().toISOString(), issued_at: new Date().toISOString(), updated_at: new Date().toISOString(), customer_id: 1, customer_name: 'Alice' },
      { id: 'inv2', status: 'DRAFT', total_cents: 2500, amount_due_cents: 2500, amount_paid_cents: 0, subtotal_cents:2500, tax_cents:0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), customer_id: 2, customer_name: 'Bob' }
    ];
    return HttpResponse.json({ data: { items, page, page_size: pageSize, total_items: items.length, total_pages: 1 } });
  }),
  // --- Add package to invoice ---
  http.post('/api/admin/invoices/:id/add-package', async ({ params, request }) => {
    const { id } = params as { id: string };
    // Just echo a new line item into the response
    const body = await request.json().catch(() => ({ package_id: 'unknown' })) as { package_id?: string };
    return HttpResponse.json({
      data: {
        invoice: { id, status: 'DRAFT', total_cents: 12500, amount_due_cents: 12500, amount_paid_cents: 0, subtotal_cents: 12500, tax_cents: 0 },
        line_items: [ { id: 'li-new', name: `Package ${body.package_id || 'unknown'}`, quantity: 1, unit_price_cents: 12500, line_subtotal_cents: 12500, tax_cents: 0, total_cents: 12500 } ]
      }
    }, { status: 201 });
  }),
  // Board endpoint for unit tests (when axios baseURL is '/api', resolves to localhost:3000/api/...)
  http.get('http://localhost:3000/api/admin/appointments/board', ({ request }) => {
    console.log('🔍 MSW: Board endpoint (unit test) hit!', request.url);
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const techId = url.searchParams.get('techId');

    console.log('📊 MSW: Board query params:', { from, to, techId });

    // Filter appointments based on query params
    let filteredAppointments = mockAppointments;

    if (from) {
      filteredAppointments = filteredAppointments.filter(apt =>
        new Date(apt.start_ts) >= new Date(from)
      );
    }

    if (to) {
      filteredAppointments = filteredAppointments.filter(apt =>
        new Date(apt.end_ts || apt.start_ts) <= new Date(to)
      );
    }

    if (techId) {
      filteredAppointments = filteredAppointments.filter(apt =>
        apt.tech_id === techId
      );
    }

    // Generate board columns
    const columns = [
      { key: 'SCHEDULED', title: 'Scheduled', count: 1, sum: 250.00 },
      { key: 'IN_PROGRESS', title: 'In Progress', count: 1, sum: 450.00 },
      { key: 'READY', title: 'Ready', count: 0, sum: 0 },
      { key: 'COMPLETED', title: 'Completed', count: 0, sum: 0 }
    ];

    // Generate board cards
    const cards = filteredAppointments.map((apt, index) => ({
      id: apt.id,
      status: apt.status,
      position: index + 1,
      start: apt.start_ts,
      end: apt.end_ts,
      customerName: apt.customer_name,
      vehicle: apt.vehicle_label,
      servicesSummary: apt.notes,
      price: apt.total_amount,
      tags: []
    }));

    console.log('✅ MSW: Returning board data (unit test):', { columns: columns.length, cards: cards.length });
    return HttpResponse.json({ columns, cards });
  }),

  // Board endpoint (note: when VITE_API_BASE_URL=http://localhost:3001, axios calls /admin/appointments/board directly)
  http.get('http://localhost:3001/admin/appointments/board', ({ request }) => {
    console.log('🔍 MSW: Board endpoint hit!', request.url);
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const techId = url.searchParams.get('techId');

    console.log('📊 MSW: Board query params:', { from, to, techId });

    // Filter appointments based on query params
    let filteredAppointments = mockAppointments;

    if (from) {
      filteredAppointments = filteredAppointments.filter(apt =>
        new Date(apt.start_ts) >= new Date(from)
      );
    }

    if (to) {
      filteredAppointments = filteredAppointments.filter(apt =>
        new Date(apt.end_ts || apt.start_ts) <= new Date(to)
      );
    }

    if (techId) {
      filteredAppointments = filteredAppointments.filter(apt =>
        apt.tech_id === techId
      );
    }

    // Generate board columns
    const columns = [
      { key: 'SCHEDULED', title: 'Scheduled', count: 1, sum: 250.00 },
      { key: 'IN_PROGRESS', title: 'In Progress', count: 1, sum: 450.00 },
      { key: 'READY', title: 'Ready', count: 0, sum: 0 },
      { key: 'COMPLETED', title: 'Completed', count: 0, sum: 0 }
    ];

    // Generate board cards
    const cards = filteredAppointments.map((apt, index) => ({
      id: apt.id,
      status: apt.status,
      position: index + 1,
      start: apt.start_ts,
      end: apt.end_ts,
      customerName: apt.customer_name,
      vehicle: apt.vehicle_label,
      servicesSummary: apt.notes,
      price: apt.total_amount,
      tags: []
    }));

    console.log('✅ MSW: Returning board data:', { columns: columns.length, cards: cards.length });
    return HttpResponse.json({ columns, cards });
  }),

  // Board endpoint with /api prefix (for lib/api.ts calls)
  http.get('http://localhost:3001/api/admin/appointments/board', ({ request }) => {
    console.log('🔍 MSW: Board endpoint (with /api) hit!', request.url);
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const techId = url.searchParams.get('techId');

    console.log('📊 MSW: Board query params:', { from, to, techId });

    // Filter appointments based on query params
    let filteredAppointments = mockAppointments;

    if (from) {
      filteredAppointments = filteredAppointments.filter(apt =>
        new Date(apt.start_ts) >= new Date(from)
      );
    }

    if (to) {
      filteredAppointments = filteredAppointments.filter(apt =>
        new Date(apt.end_ts || apt.start_ts) <= new Date(to)
      );
    }

    if (techId) {
      filteredAppointments = filteredAppointments.filter(apt =>
        apt.tech_id === techId
      );
    }

    // Generate board columns
    const columns = [
      { key: 'SCHEDULED', title: 'Scheduled', count: 1, sum: 250.00 },
      { key: 'IN_PROGRESS', title: 'In Progress', count: 1, sum: 450.00 },
      { key: 'READY', title: 'Ready', count: 0, sum: 0 },
      { key: 'COMPLETED', title: 'Completed', count: 0, sum: 0 }
    ];

    // Generate board cards
    const cards = filteredAppointments.map((apt, index) => ({
      id: apt.id,
      status: apt.status,
      position: index + 1,
      start: apt.start_ts,
      end: apt.end_ts,
      customerName: apt.customer_name,
      vehicle: apt.vehicle_label,
      servicesSummary: apt.notes,
      price: apt.total_amount,
      tags: []
    }));

    const responseData = { columns, cards };
    console.log('✅ MSW: Returning board data (with /api):', JSON.stringify(responseData, null, 2));

    return HttpResponse.json(responseData);
  }),

  // Admin appointments list for unit tests (localhost:3000)
  http.get('http://localhost:3000/api/admin/appointments', ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let filteredAppointments = mockAppointments;

    if (status) {
      filteredAppointments = filteredAppointments.filter(apt =>
        apt.status.toUpperCase() === status.toUpperCase()
      );
    }

    // Apply pagination
    const paginatedAppointments = filteredAppointments.slice(offset, offset + limit);

    return HttpResponse.json({
      data: {
        appointments: paginatedAppointments,
        nextCursor: paginatedAppointments.length === limit ? 'next-page' : null
      },
      errors: null,
      meta: { request_id: generateRequestId() }
    });
  }),

  // Get single appointment (drawer payload) for unit tests (localhost:3000)
  http.get('/api/appointments/:id', ({ params }) => {
    const id = params.id as string;
    const appointment = mockAppointments.find(apt => apt.id === id);
    if (!appointment) {
      return HttpResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }
    const customer = mockCustomers.find(c => c.id === appointment.customer_id);
    const vehicle = mockVehicles.find(v => v.id === appointment.vehicle_id);
    const services = mockServices.filter(s => s.appointment_id === id);
    const drawerPayload = {
      appointment: {
        id: appointment.id,
        status: appointment.status,
        start: appointment.start_ts,
        end: appointment.end_ts,
        total_amount: appointment.total_amount,
        paid_amount: appointment.paid_amount,
        check_in_at: null,
        check_out_at: null,
        tech_id: appointment.tech_id
      },
      customer,
      vehicle,
      services
    };
    return HttpResponse.json(drawerPayload);
  }),

  http.get('http://localhost:3000/api/appointments/:id', ({ params }) => {
    const id = params.id as string;
    console.log('🔧 MSW: getDrawer handler (unit test) called for id:', id);

    const appointment = mockAppointments.find(apt => apt.id === id);

    if (!appointment) {
      console.log('🔧 MSW: Appointment not found for id:', id);
      return HttpResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      );
    }

    const customer = mockCustomers.find(c => c.id === appointment.customer_id);
    const vehicle = mockVehicles.find(v => v.id === appointment.vehicle_id);
    const services = mockServices.filter(s => s.appointment_id === id);

    // Transform the appointment to match DrawerPayload.appointment structure
    const drawerPayload = {
      appointment: {
        id: appointment.id,
        status: appointment.status,
        start: appointment.start_ts,  // Map start_ts to start
        end: appointment.end_ts,      // Map end_ts to end
        total_amount: appointment.total_amount,
        paid_amount: appointment.paid_amount,
        check_in_at: null,
        check_out_at: null,
        tech_id: appointment.tech_id
      },
      customer,
      vehicle,
      services
    };

    console.log('🔧 MSW: Returning drawer payload (unit test):', JSON.stringify(drawerPayload, null, 2));
    return HttpResponse.json(drawerPayload);
  }),

  // Admin appointments list
  http.get('http://localhost:3001/api/admin/appointments', ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let filteredAppointments = mockAppointments;

    if (status) {
      filteredAppointments = filteredAppointments.filter(apt =>
        apt.status.toUpperCase() === status.toUpperCase()
      );
    }

    // Apply pagination
    const paginatedAppointments = filteredAppointments.slice(offset, offset + limit);

    return HttpResponse.json({
      data: {
        appointments: paginatedAppointments,
        nextCursor: paginatedAppointments.length === limit ? 'next-page' : null
      },
      errors: null,
      meta: { request_id: generateRequestId() }
    });
  }),

  // --- Admin appointments (relative /api variants for axios baseURL) ---
  http.get('/api/admin/appointments', ({ request }) => {
    const url = new URL(request.url, 'http://localhost');
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let filteredAppointments = mockAppointments;
    if (status) {
      filteredAppointments = filteredAppointments.filter(apt =>
        apt.status.toUpperCase() === status.toUpperCase()
      );
    }

    const paginatedAppointments = filteredAppointments.slice(offset, offset + limit);
    return HttpResponse.json({
      data: {
        appointments: paginatedAppointments,
        nextCursor: paginatedAppointments.length === limit ? 'next-page' : null
      },
      errors: null,
      meta: { request_id: generateRequestId() }
    });
  }),
  http.get('/api/admin/appointments/today', () => {
    // Simple "today" view: subset of mockAppointments for stability
    const today = mockAppointments.slice(0, 1);
    return HttpResponse.json({ appointments: today });
  }),
  http.post('/api/admin/appointments', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const newAppointment: MockAppointment = {
      id: `apt-${Date.now()}`,
      status: (body.status as string) || 'SCHEDULED',
      start_ts: (body.start as string) || new Date().toISOString(),
      end_ts: (body.end as string) || new Date(Date.now() + 3600000).toISOString(),
      total_amount: (body.total_amount as number) || 0,
      paid_amount: (body.paid_amount as number) || 0,
      customer_name: (body.customer_name as string) || 'New Customer',
      vehicle_label: (body.vehicle_label as string) || 'Unknown Vehicle',
      customer_id: (body.customer_id as string) || 'cust-new',
      vehicle_id: (body.vehicle_id as string) || 'veh-new',
      tech_id: (body.tech_id as string) || null,
      notes: (body.notes as string) || ''
    };
    mockAppointments.push(newAppointment);
    return HttpResponse.json({ data: { id: newAppointment.id } }, { status: 201 });
  }),
  http.put('/api/admin/appointments/:id', async ({ params, request }) => {
    const id = params.id as string;
    const body = await request.json() as Record<string, unknown>;
    const idx = mockAppointments.findIndex(a => a.id === id);
    if (idx === -1) {
      return HttpResponse.json({ message: 'Appointment not found' }, { status: 404 });
    }
    Object.assign(mockAppointments[idx], body);
    return HttpResponse.json({ message: 'Appointment updated successfully' });
  }),

  // Get single appointment (drawer payload)
  http.get('http://localhost:3001/appointments/:id', ({ params }) => {
    const id = params.id as string;
    console.log('🔧 MSW: getDrawer handler called for id:', id);

    const appointment = mockAppointments.find(apt => apt.id === id);

    if (!appointment) {
      console.log('🔧 MSW: Appointment not found for id:', id);
      return HttpResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      );
    }

    const customer = mockCustomers.find(c => c.id === appointment.customer_id);
    const vehicle = mockVehicles.find(v => v.id === appointment.vehicle_id);
    const services = mockServices.filter(s => s.appointment_id === id);

    // Transform the appointment to match DrawerPayload.appointment structure
    const drawerPayload = {
      appointment: {
        id: appointment.id,
        status: appointment.status,
        start: appointment.start_ts,  // Map start_ts to start
        end: appointment.end_ts,      // Map end_ts to end
        total_amount: appointment.total_amount,
        paid_amount: appointment.paid_amount,
        check_in_at: null,
        check_out_at: null,
        tech_id: appointment.tech_id
      },
      customer,
      vehicle,
      services
    };

    console.log('🔧 MSW: Returning drawer payload:', JSON.stringify(drawerPayload, null, 2));
    return HttpResponse.json(drawerPayload);
  }),

  // Create appointment
  http.post('http://localhost:3001/admin/appointments', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;

    const newAppointment: MockAppointment = {
      id: `apt-${Date.now()}`,
      status: (body.status as string) || 'SCHEDULED',
      start_ts: (body.start as string) || new Date().toISOString(),
      end_ts: (body.end as string) || new Date(Date.now() + 3600000).toISOString(),
      total_amount: (body.total_amount as number) || 0,
      paid_amount: (body.paid_amount as number) || 0,
      customer_name: (body.customer_name as string) || 'New Customer',
      vehicle_label: (body.vehicle_label as string) || 'Unknown Vehicle',
      customer_id: (body.customer_id as string) || 'cust-new',
      vehicle_id: (body.vehicle_id as string) || 'veh-new',
      tech_id: (body.tech_id as string) || null,
      notes: (body.notes as string) || ''
    };

    mockAppointments.push(newAppointment);

    return HttpResponse.json({
      data: { id: newAppointment.id },
      errors: null,
      meta: { request_id: generateRequestId() }
    }, { status: 201 });
  }),

  // Move appointment and status endpoints for unit tests (localhost:3000)
  http.patch('http://localhost:3000/api/admin/appointments/:id/move', async ({ params, request }) => {
    const id = params.id as string;
    const body = await request.json() as Record<string, unknown>;

    const appointmentIndex = mockAppointments.findIndex(apt => apt.id === id);
    if (appointmentIndex === -1) {
      return HttpResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      );
    }

    // Update appointment status
    mockAppointments[appointmentIndex].status = body.status as string;

    return HttpResponse.json({
      data: {
        id,
        status: body.status,
        position: body.position
      },
      errors: null,
      meta: { request_id: generateRequestId() }
    });
  }),

  http.patch('http://localhost:3000/api/admin/appointments/:id/status', async ({ params, request }) => {
    const id = params.id as string;
    const body = await request.json() as Record<string, unknown>;

    const appointmentIndex = mockAppointments.findIndex(apt => apt.id === id);
    if (appointmentIndex === -1) {
      return HttpResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      );
    }

    mockAppointments[appointmentIndex].status = body.status as string;

    return HttpResponse.json({
      data: {
        id,
        status: body.status
      },
      errors: null,
      meta: { request_id: generateRequestId() }
    });
  }),

  http.patch('http://localhost:3000/api/appointments/:id', async ({ params, request }) => {
    const id = params.id as string;
    const body = await request.json() as Record<string, unknown>;

    const appointmentIndex = mockAppointments.findIndex(apt => apt.id === id);
    if (appointmentIndex === -1) {
      return HttpResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      );
    }

    // Update appointment fields
    Object.keys(body).forEach(key => {
      if (body[key] !== undefined && key in mockAppointments[appointmentIndex]) {
        (mockAppointments[appointmentIndex] as unknown as Record<string, unknown>)[key] = body[key];
      }
    });

    return HttpResponse.json(mockAppointments[appointmentIndex]);
  }),

  // Dashboard stats for unit tests (localhost:3000)
  http.get('http://localhost:3000/api/admin/dashboard/stats', async () => {
    return HttpResponse.json({
      data: {
        totals: {
          today_completed: 3,
          today_booked: 5,
          avg_cycle: 120,
          avg_cycle_formatted: '2h 0m'
        },
        countsByStatus: {
          scheduled: 8,
          in_progress: 3,
          ready: 2,
          completed: 11,
          cancelled: 1
        },
        carsOnPremises: [
          { license: 'ABC-123', customer: 'John Doe', arrival: '09:30' },
          { license: 'XYZ-789', customer: 'Jane Smith', arrival: '11:15' }
        ],
        unpaidTotal: 1250.50
      },
      errors: null,
      meta: { request_id: generateRequestId() }
    });
  }),

  // Move appointment (drag and drop)
  http.patch('http://localhost:3001/admin/appointments/:id/move', async ({ params, request }) => {
    const id = params.id as string;
    const body = await request.json() as Record<string, unknown>;

    const appointmentIndex = mockAppointments.findIndex(apt => apt.id === id);
    if (appointmentIndex === -1) {
      return HttpResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      );
    }

    // Update appointment status
    mockAppointments[appointmentIndex].status = body.status as string;

    return HttpResponse.json({
      data: {
        id,
        status: body.status,
        position: body.position
      },
      errors: null,
      meta: { request_id: generateRequestId() }
    });
  }),

  // Update appointment status
  http.patch('http://localhost:3001/admin/appointments/:id/status', async ({ params, request }) => {
    const id = params.id as string;
    const body = await request.json() as Record<string, unknown>;

    const appointmentIndex = mockAppointments.findIndex(apt => apt.id === id);
    if (appointmentIndex === -1) {
      return HttpResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      );
    }

    mockAppointments[appointmentIndex].status = body.status as string;

    return HttpResponse.json({
      data: {
        id,
        status: body.status
      },
      errors: null,
      meta: { request_id: generateRequestId() }
    });
  }),

  // PATCH /appointments/:id - Main appointment update endpoint
  http.patch('http://localhost:3001/appointments/:id', async ({ params, request }) => {
    const id = params.id as string;
    const body = await request.json() as Record<string, unknown>;

    const appointmentIndex = mockAppointments.findIndex(apt => apt.id === id);
    if (appointmentIndex === -1) {
      return HttpResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      );
    }

    // Update appointment fields
    Object.keys(body).forEach(key => {
      if (body[key] !== undefined && key in mockAppointments[appointmentIndex]) {
        (mockAppointments[appointmentIndex] as unknown as Record<string, unknown>)[key] = body[key];
      }
    });

    return HttpResponse.json({
      ok: true
    });
  }),

  // PATCH /api/appointments/:id - API version
  http.patch('http://localhost:3001/api/appointments/:id', async ({ params, request }) => {
    const id = params.id as string;
    const body = await request.json() as Record<string, unknown>;

    const appointmentIndex = mockAppointments.findIndex(apt => apt.id === id);
    if (appointmentIndex === -1) {
      return HttpResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      );
    }

    // Update appointment fields
    Object.keys(body).forEach(key => {
      if (body[key] !== undefined && key in mockAppointments[appointmentIndex]) {
        (mockAppointments[appointmentIndex] as unknown as Record<string, unknown>)[key] = body[key];
      }
    });

    return HttpResponse.json(mockAppointments[appointmentIndex]);
  }),

  // Services endpoints
  http.get('http://localhost:3001/appointments/:id/services', ({ params }) => {
    const appointmentId = params.id as string;
    const services = mockServices.filter(s => s.appointment_id === appointmentId);

    return HttpResponse.json({
      services
    });
  }),

  http.post('http://localhost:3001/appointments/:id/services', async ({ params, request }) => {
    const appointmentId = params.id as string;
    const body = await request.json() as Record<string, unknown>;

    const newService: MockService = {
      id: `svc-${Date.now()}`,
      appointment_id: appointmentId,
      name: body.name as string,
      notes: (body.notes as string) || '',
      estimated_hours: (body.estimated_hours as number) || 1,
      estimated_price: (body.estimated_price as number) || 0,
      category: (body.category as string) || 'General',
      created_at: new Date().toISOString()
    };

    mockServices.push(newService);

    // Update appointment total
    const appointment = mockAppointments.find(apt => apt.id === appointmentId);
    if (appointment) {
      const totalServices = mockServices
        .filter(s => s.appointment_id === appointmentId)
        .reduce((sum, s) => sum + s.estimated_price, 0);
      appointment.total_amount = totalServices;
    }

    // Match backend response format: just return the service ID
    return HttpResponse.json({
      id: newService.id
    }, { status: 201 });
  }),

  // Services endpoints for unit tests (localhost:3000)
  http.get('http://localhost:3000/api/appointments/:id/services', ({ params }) => {
    const appointmentId = params.id as string;
    console.log('🔍 MSW: Services GET endpoint (unit test) hit!', `http://localhost:3000/api/appointments/${appointmentId}/services`);
    const services = mockServices.filter(s => s.appointment_id === appointmentId);

    return HttpResponse.json({
      services
    });
  }),

  http.post('http://localhost:3000/api/appointments/:id/services', async ({ params, request }) => {
    const appointmentId = params.id as string;
    const body = await request.json() as Record<string, unknown>;

    console.log('🔍 MSW: Service creation endpoint (unit test) hit!', `http://localhost:3000/api/appointments/${appointmentId}/services`);
    console.log('📝 MSW: Service creation payload:', body);
    console.log('🔧 MSW: About to create service for appointment:', appointmentId);

    const newService: MockService = {
      id: `svc-${Date.now()}`,
      appointment_id: appointmentId,
      name: body.name as string,
      notes: (body.notes as string) || '',
      estimated_hours: (body.estimated_hours as number) || 1,
      estimated_price: (body.estimated_price as number) || 0,
      category: (body.category as string) || 'General',
      created_at: new Date().toISOString()
    };

    mockServices.push(newService);

    // Update appointment total
    const appointment = mockAppointments.find(apt => apt.id === appointmentId);
    if (appointment) {
      const totalServices = mockServices
        .filter(s => s.appointment_id === appointmentId)
        .reduce((sum, s) => sum + s.estimated_price, 0);
      appointment.total_amount = totalServices;
    }

    console.log('✅ MSW: Service created successfully (unit test):', newService);
    console.log('📊 MSW: Updated appointment total:', appointment?.total_amount);

    // Match backend response format: just return the service ID
    console.log('🎯 MSW: About to return service ID response:', { id: newService.id });
    return HttpResponse.json({
      id: newService.id
    }, { status: 201 });
  }),

  // Services endpoints with /api prefix (for lib/api.ts calls)
  http.get('http://localhost:3001/api/appointments/:id/services', ({ params }) => {
    const appointmentId = params.id as string;
    console.log('🔍 MSW: Services GET endpoint (with /api) hit!', `http://localhost:3001/api/appointments/${appointmentId}/services`);
    const services = mockServices.filter(s => s.appointment_id === appointmentId);

    return HttpResponse.json({
      services
    });
  }),

  // Services endpoints with relative URLs (fallback for different configurations)
  http.get('/api/appointments/:id/services', ({ params }) => {
    const appointmentId = params.id as string;
    console.log('🔍 MSW: Services GET endpoint (relative /api) hit!', `/api/appointments/${appointmentId}/services`);
    const services = mockServices.filter(s => s.appointment_id === appointmentId);

    return HttpResponse.json({
      services
    });
  }),

  http.post('http://localhost:3001/api/appointments/:id/services', async ({ params, request }) => {
    const appointmentId = params.id as string;
    const body = await request.json() as Record<string, unknown>;

    console.log('🔍 MSW: Service creation endpoint (with /api) hit!', `http://localhost:3001/api/appointments/${appointmentId}/services`);
    console.log('📝 MSW: Service creation payload:', body);
    console.log('🔧 MSW: About to create service for appointment:', appointmentId);

    const newService: MockService = {
      id: `svc-${Date.now()}`,
      appointment_id: appointmentId,
      name: body.name as string,
      notes: (body.notes as string) || '',
      estimated_hours: (body.estimated_hours as number) || 1,
      estimated_price: (body.estimated_price as number) || 0,
      category: (body.category as string) || 'General',
      created_at: new Date().toISOString()
    };

    mockServices.push(newService);

    // Update appointment total
    const appointment = mockAppointments.find(apt => apt.id === appointmentId);
    if (appointment) {
      const totalServices = mockServices
        .filter(s => s.appointment_id === appointmentId)
        .reduce((sum, s) => sum + s.estimated_price, 0);
      appointment.total_amount = totalServices;
    }

    console.log('✅ MSW: Service created successfully:', newService);
    console.log('📊 MSW: Updated appointment total:', appointment?.total_amount);

    // Match backend response format: just return the service ID
    console.log('🎯 MSW: About to return service ID response:', { id: newService.id });
    return HttpResponse.json({
      id: newService.id
    }, { status: 201 });
  }),

  // Services endpoints with relative URLs (fallback for different configurations)
  http.post('/api/appointments/:id/services', async ({ params, request }) => {
    const appointmentId = params.id as string;
    const body = await request.json() as Record<string, unknown>;

    console.log('🔍 MSW: Service creation endpoint (relative /api) hit!', `/api/appointments/${appointmentId}/services`);
    console.log('📝 MSW: Service creation payload:', body);
    console.log('🔧 MSW: About to create service for appointment:', appointmentId);

    const newService: MockService = {
      id: `svc-${Date.now()}`,
      appointment_id: appointmentId,
      name: body.name as string,
      notes: (body.notes as string) || '',
      estimated_hours: (body.estimated_hours as number) || 1,
      estimated_price: (body.estimated_price as number) || 0,
      category: (body.category as string) || 'General',
      created_at: new Date().toISOString()
    };

    mockServices.push(newService);

    // Update appointment total
    const appointment = mockAppointments.find(apt => apt.id === appointmentId);
    if (appointment) {
      const totalServices = mockServices
        .filter(s => s.appointment_id === appointmentId)
        .reduce((sum, s) => sum + s.estimated_price, 0);
      appointment.total_amount = totalServices;
    }

    console.log('✅ MSW: Service created successfully:', newService);
    console.log('📊 MSW: Updated appointment total:', appointment?.total_amount);

    // Match backend response format: just return the service ID
    console.log('🎯 MSW: About to return service ID response:', { id: newService.id });
    return HttpResponse.json({
      id: newService.id
    }, { status: 201 });
  }),

  // Dashboard stats
  http.get('http://localhost:3001/admin/dashboard/stats', async () => {
    return HttpResponse.json({
      data: {
        totals: {
          today_completed: 3,
          today_booked: 5,
          avg_cycle: 120,
          avg_cycle_formatted: '2h 0m'
        },
        countsByStatus: {
          scheduled: 8,
          in_progress: 3,
          ready: 2,
          completed: 11,
          cancelled: 1
        },
        carsOnPremises: [
          { license: 'ABC-123', customer: 'John Doe', arrival: '09:30' },
          { license: 'XYZ-789', customer: 'Jane Smith', arrival: '11:15' }
        ],
        unpaidTotal: 1250.50
      },
      errors: null,
      meta: { request_id: generateRequestId() }
    });
  }),

  // Health check
  http.get('http://localhost:3001/health', () => {
    return HttpResponse.json({
      status: 'ok',
      message: 'MSW Integration Test Server is running',
      timestamp: new Date().toISOString()
    });
  }),

  // Messages endpoints (minimal implementation)
  http.get('http://localhost:3001/appointments/:id/messages', () => {
    return HttpResponse.json({
      messages: [],
      errors: null,
      meta: { request_id: generateRequestId() }
    });
  }),

  http.post('http://localhost:3001/appointments/:id/messages', async ({ request }) => {
    await request.json(); // Read body but don't use it

    return HttpResponse.json({
      id: `msg-${Date.now()}`,
      status: 'sent',
      errors: null,
      meta: { request_id: generateRequestId() }
    }, { status: 201 });
  }),

  // Error scenario configuration for P2-T-006 Error Path Integration Tests
  http.get('http://localhost:3001/admin/appointments/board/error-scenario', ({ request }) => {
    console.log('🔍 MSW: Error scenario endpoint hit!', request.url);
    const url = new URL(request.url);
    const scenario = url.searchParams.get('scenario');

    console.log('📊 MSW: Error scenario:', scenario);

    // Trigger specific error scenario
    switch (scenario) {
      case 'appointmentPatch500':
        return HttpResponse.json(
          { error: 'Internal Server Error' },
          { status: 500 }
        );
      case 'unauthorizedAccess':
        return HttpResponse.json(
          { error: 'Unauthorized access' },
          { status: 401 }
        );
      case 'dashboardStatsDelay':
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(HttpResponse.json({
              data: {
                totals: {
                  today_completed: 3,
                  today_booked: 5,
                  avg_cycle: 120,
                  avg_cycle_formatted: '2h 0m'
                },
                countsByStatus: {
                  scheduled: 8,
                  in_progress: 3,
                  ready: 2,
                  completed: 11,
                  cancelled: 1
                },
                carsOnPremises: [
                  { license: 'ABC-123', customer: 'John Doe', arrival: '09:30' },
                  { license: 'XYZ-789', customer: 'Jane Smith', arrival: '11:15' }
                ],
                unpaidTotal: 1250.50
              },
              errors: null,
              meta: { request_id: generateRequestId() }
            }));
          }, 2000); // Simulate 2 seconds delay
        });
      case 'networkTimeout':
        return new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Network timeout'));
          }, 1000); // Simulate 1 second timeout
        });
      default:
        return HttpResponse.json(
          { error: 'Unknown error scenario' },
          { status: 400 }
        );
    }
  }),

  // ========== P2-T-007: NOTIFICATION ENDPOINTS FOR INTEGRATION TESTS ==========

  // POST /notifications endpoint for reminder flow testing
  http.post('http://localhost:3001/notifications', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    console.log('📨 MSW: Notification endpoint called with body:', JSON.stringify(body, null, 2));

    // Check for error scenarios
    if (shouldTriggerErrorScenario('notificationPost500')) {
      console.log('🚨 MSW: Triggering 500 error for POST /notifications');
      return HttpResponse.json(
        {
          data: null,
          errors: [{ status: '500', code: 'NOTIFICATION_ERROR', detail: 'Failed to send notification' }],
          meta: { request_id: generateRequestId() }
        },
        { status: 500 }
      );
    }

    // Validate notification payload
    const notificationType = body.type as string;
    const appointmentId = body.appointmentId as string;
    const message = body.message as string;

    if (!notificationType || !appointmentId || !message) {
      return HttpResponse.json(
        {
          data: null,
          errors: [{ status: '400', code: 'INVALID_PAYLOAD', detail: 'Missing required notification fields' }],
          meta: { request_id: generateRequestId() }
        },
        { status: 400 }
      );
    }

    // Simulate successful notification sending
    const notificationId = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('✅ MSW: Notification sent successfully:', { notificationId, type: notificationType, appointmentId });

    return HttpResponse.json({
      data: {
        id: notificationId,
        status: 'sent',
        timestamp: new Date().toISOString(),
        type: notificationType,
        appointmentId,
        message
      },
      errors: null,
      meta: { request_id: generateRequestId() }
    });
  }),

  // POST /api/notifications endpoint (for different base URL configurations)
  http.post('http://localhost:3001/api/notifications', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    console.log('📨 MSW: Notification API endpoint called with body:', JSON.stringify(body, null, 2));

    // Check for error scenarios
    if (shouldTriggerErrorScenario('notificationPost500')) {
      console.log('🚨 MSW: Triggering 500 error for POST /api/notifications');
      return HttpResponse.json(
        {
          data: null,
          errors: [{ status: '500', code: 'NOTIFICATION_ERROR', detail: 'Failed to send notification' }],
          meta: { request_id: generateRequestId() }
        },
        { status: 500 }
      );
    }

    // Validate notification payload
    const notificationType = body.type as string;
    const appointmentId = body.appointmentId as string;
    const message = body.message as string;

    if (!notificationType || !appointmentId || !message) {
      return HttpResponse.json(
        {
          data: null,
          errors: [{ status: '400', code: 'INVALID_PAYLOAD', detail: 'Missing required notification fields' }],
          meta: { request_id: generateRequestId() }
        },
        { status: 400 }
      );
    }

    // Simulate successful notification sending
    const notificationId = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('✅ MSW: API Notification sent successfully:', { notificationId, type: notificationType, appointmentId });

    return HttpResponse.json({
      data: {
        id: notificationId,
        status: 'sent',
        timestamp: new Date().toISOString(),
        type: notificationType,
        appointmentId,
        message
      },
      errors: null,
      meta: { request_id: generateRequestId() }
    });
  }),

  // POST /notifications endpoint for localhost:3000 (unit test base URL)
  http.post('http://localhost:3000/notifications', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    console.log('📨 MSW: Notification endpoint (localhost:3000) called with body:', JSON.stringify(body, null, 2));

    // Check for error scenarios
    if (shouldTriggerErrorScenario('notificationPost500')) {
      console.log('🚨 MSW: Triggering 500 error for POST localhost:3000/notifications');
      return HttpResponse.json(
        {
          data: null,
          errors: [{ status: '500', code: 'NOTIFICATION_ERROR', detail: 'Failed to send notification' }],
          meta: { request_id: generateRequestId() }
        },
        { status: 500 }
      );
    }

    // Validate notification payload
    const notificationType = body.type as string;
    const appointmentId = body.appointmentId as string;
    const message = body.message as string;

    if (!notificationType || !appointmentId || !message) {
      return HttpResponse.json(
        {
          data: null,
          errors: [{ status: '400', code: 'INVALID_PAYLOAD', detail: 'Missing required notification fields' }],
          meta: { request_id: generateRequestId() }
        },
        { status: 400 }
      );
    }

    // Simulate successful notification sending
    const notificationId = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('✅ MSW: Notification (localhost:3000) sent successfully:', { notificationId, type: notificationType, appointmentId });

    return HttpResponse.json({
      data: {
        id: notificationId,
        status: 'sent',
        timestamp: new Date().toISOString(),
        type: notificationType,
        appointmentId,
        message
      },
      errors: null,
      meta: { request_id: generateRequestId() }
    });
  }),

  // POST /api/notifications endpoint for localhost:3000 (unit test base URL with /api prefix)
  http.post('http://localhost:3000/api/notifications', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    console.log('📨 MSW: Notification API endpoint (localhost:3000) called with body:', JSON.stringify(body, null, 2));

    // Check for error scenarios
    if (shouldTriggerErrorScenario('notificationPost500')) {
      console.log('🚨 MSW: Triggering 500 error for POST localhost:3000/api/notifications');
      return HttpResponse.json(
        {
          data: null,
          errors: [{ status: '500', code: 'NOTIFICATION_ERROR', detail: 'Failed to send notification' }],
          meta: { request_id: generateRequestId() }
        },
        { status: 500 }
      );
    }

    // Validate notification payload
    const notificationType = body.type as string;
    const appointmentId = body.appointmentId as string;
    const message = body.message as string;

    if (!notificationType || !appointmentId || !message) {
      return HttpResponse.json(
        {
          data: null,
          errors: [{ status: '400', code: 'INVALID_PAYLOAD', detail: 'Missing required notification fields' }],
          meta: { request_id: generateRequestId() }
        },
        { status: 400 }
      );
    }

    // Simulate successful notification sending
    const notificationId = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('✅ MSW: API Notification (localhost:3000) sent successfully:', { notificationId, type: notificationType, appointmentId });

    return HttpResponse.json({
      data: {
        id: notificationId,
        status: 'sent',
        timestamp: new Date().toISOString(),
        type: notificationType,
        appointmentId,
        message
      },
      errors: null,
      meta: { request_id: generateRequestId() }
    });
  }),

  // ========== END P2-T-007 NOTIFICATION ENDPOINTS ==========

  // Catch-all handler to log unmatched requests
  http.all('*', ({ request }) => {
    console.log('🚨 MSW: Unmatched request:', request.method, request.url);

    // If it's a board-related request, provide more details
    if (request.url.includes('board')) {
      console.log('🔍 MSW: Board request details:', {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries())
      });
    }

    return new HttpResponse(null, { status: 404 });
  })
];

// Export handlers for potential reuse
export { handlers };

// Helper function to reset mock data
export function resetMockData() {
  // Reset appointments
  mockAppointments.length = 0;
  mockAppointments.push(
    {
      id: 'apt-happy-1',
      status: 'SCHEDULED',
      start_ts: '2024-01-15T14:00:00Z',
      end_ts: '2024-01-15T15:00:00Z',
      total_amount: 250.00,
      paid_amount: 0,
      customer_name: 'Happy Path Customer',
      vehicle_label: '2020 Toyota Camry',
      customer_id: 'cust-happy-1',
      vehicle_id: 'veh-happy-1',
      tech_id: null,
      notes: 'Happy path test appointment'
    },
    {
      id: 'apt-happy-2',
      status: 'IN_PROGRESS',
      start_ts: '2024-01-15T16:00:00Z',
      end_ts: '2024-01-15T17:00:00Z',
      total_amount: 450.00,
      paid_amount: 450.00,
      customer_name: 'Another Customer',
      vehicle_label: '2019 Honda Civic',
      customer_id: 'cust-happy-2',
      vehicle_id: 'veh-happy-2',
      tech_id: 'tech-1',
      notes: 'Secondary test appointment'
    }
  );

  // Reset services
  mockServices.length = 0;
  mockServices.push(
    {
      id: 'svc-happy-1',
      appointment_id: 'apt-happy-1',
      name: 'Oil Change',
      notes: 'Full synthetic oil',
      estimated_hours: 0.5,
      estimated_price: 75.00,
      category: 'Maintenance'
    },
    {
      id: 'svc-happy-2',
      appointment_id: 'apt-happy-1',
      name: 'Brake Inspection',
      notes: 'Check brake pads and rotors',
      estimated_hours: 1.0,
      estimated_price: 175.00,
      category: 'Inspection'
    },
    {
      id: 'svc-happy-3',
      appointment_id: 'apt-happy-2',
      name: 'Brake Pad Replacement',
      notes: 'Front brake pads',
      estimated_hours: 2.0,
      estimated_price: 350.00,
      category: 'Repair'
    }
  );
}

// Utility to add custom handlers for specific tests
export function addCustomHandler(handler: Parameters<typeof server.use>[0]) {
  server.use(handler);
}

// ========== P2-T-006: ERROR SCENARIO CONFIGURATION ==========

/**
 * Error scenario configuration for testing failure conditions
 */
export interface ErrorScenarioConfig {
  appointmentPatch500: boolean;
  unauthorizedAccess: boolean;
  dashboardStatsDelay: boolean;
  dashboardStatsTimeout: boolean;
  protectedEndpoints401: boolean;
  networkTimeout: boolean;
  notificationPost500: boolean;
}

// Global error scenario state
const errorScenarios: ErrorScenarioConfig = {
  appointmentPatch500: false,
  unauthorizedAccess: false,
  dashboardStatsDelay: false,
  dashboardStatsTimeout: false,
  protectedEndpoints401: false,
  networkTimeout: false,
  notificationPost500: false,
};

/**
 * Enable a specific error scenario for testing
 * @param scenario - The error scenario to enable
 */
export function enableErrorScenario(scenario: keyof ErrorScenarioConfig): void {
  errorScenarios[scenario] = true;
  console.log(`🚨 MSW: Enabled error scenario '${scenario}'`);
}

/**
 * Disable a specific error scenario
 * @param scenario - The error scenario to disable
 */
export function disableErrorScenario(scenario: keyof ErrorScenarioConfig): void {
  errorScenarios[scenario] = false;
  console.log(`✅ MSW: Disabled error scenario '${scenario}'`);
}

/**
 * Reset all error scenarios to disabled state
 */
export function resetErrorScenarios(): void {
  Object.keys(errorScenarios).forEach(key => {
    errorScenarios[key as keyof ErrorScenarioConfig] = false;
  });
  console.log('🔄 MSW: Reset all error scenarios');
}

/**
 * Get current error scenario configuration (for testing)
 */
export function getErrorScenarios(): ErrorScenarioConfig {
  return { ...errorScenarios };
}

/**
 * Check if error scenario should trigger for a specific request
 * @param scenario - The scenario to check
 * @returns True if error should be triggered
 */
function shouldTriggerErrorScenario(scenario: keyof ErrorScenarioConfig): boolean {
  if (!errorScenarios[scenario]) return false;

  // Additional request-based filtering can be added here if needed
  return true;
}

/**
 * Enhanced handlers with error scenario support
 */
const enhancedHandlers = [
  // Include all original handlers first
  ...handlers,

  // ========== RELATIVE PATH HANDLERS FOR ERROR SCENARIOS ==========

  // Enhanced PATCH /api/appointments/:id with 500 error scenario (relative path)
  http.patch('/api/appointments/:id', async ({ params, request }) => {
    const id = params.id as string;

    // Check for 500 error scenario
    if (shouldTriggerErrorScenario('appointmentPatch500')) {
      console.log('🚨 MSW: Triggering 500 error for relative API appointment PATCH');
      return HttpResponse.json(
        {
          data: null,
          errors: [{ status: '500', code: 'PROVIDER_ERROR', detail: 'Internal server error updating appointment' }],
          meta: { request_id: generateRequestId() }
        },
        { status: 500 }
      );
    }

    // Normal handler logic
    const body = await request.json() as Record<string, unknown>;
    const appointmentIndex = mockAppointments.findIndex(apt => apt.id === id);

    if (appointmentIndex === -1) {
      return HttpResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      );
    }

    // Update appointment fields
    Object.keys(body).forEach(key => {
      if (body[key] !== undefined && key in mockAppointments[appointmentIndex]) {
        (mockAppointments[appointmentIndex] as unknown as Record<string, unknown>)[key] = body[key];
      }
    });

    return HttpResponse.json(mockAppointments[appointmentIndex]);
  }),

  // Enhanced dashboard stats with delay and 401 scenarios (relative path)
  http.get('/api/admin/dashboard/stats', async () => {
    // Check for 401 unauthorized scenario
    if (shouldTriggerErrorScenario('unauthorizedAccess') ||
        shouldTriggerErrorScenario('protectedEndpoints401')) {
      console.log('🚨 MSW: Triggering 401 error for relative dashboard stats');
      return HttpResponse.json(
        {
          data: null,
          errors: [{ status: '401', code: 'AUTH_REQUIRED', detail: 'Authentication required for admin endpoints' }],
          meta: { request_id: generateRequestId() }
        },
        { status: 401 }
      );
    }

    // Check for network delay scenario (>3s)
    if (shouldTriggerErrorScenario('dashboardStatsDelay')) {
      console.log('🚨 MSW: Triggering 3.5s delay for relative dashboard stats');
      await new Promise(resolve => setTimeout(resolve, 3500)); // 3.5 second delay
    }

    // Check for network timeout scenario
    if (shouldTriggerErrorScenario('dashboardStatsTimeout')) {
      console.log('🚨 MSW: Triggering timeout for relative dashboard stats');
      return new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Network timeout'));
        }, 1000);
      });
    }

    // Normal response
    return HttpResponse.json({
      data: {
        totals: {
          today_completed: 3,
          today_booked: 5,
          avg_cycle: 120,
          avg_cycle_formatted: '2h 0m'
        },
        countsByStatus: {
          scheduled: 8,
          in_progress: 3,
          ready: 2,
          completed: 11,
          cancelled: 1
        },
        carsOnPremises: [
          { license: 'ABC-123', customer: 'John Doe', arrival: '09:30' },
          { license: 'XYZ-789', customer: 'Jane Smith', arrival: '11:15' }
        ],
        unpaidTotal: 1250.50
      },
      errors: null,
      meta: { request_id: generateRequestId() }
    });
  }),

  // Enhanced appointment board with 401 and networkTimeout scenarios (relative path)
  http.get('/api/admin/appointments/board', async ({ request }) => {
    // Check for network timeout scenario
    if (shouldTriggerErrorScenario('networkTimeout')) {
      console.log('🚨 MSW: Triggering network timeout for relative admin appointment board');
      return new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Network timeout'));
        }, 1000);
      });
    }

    // Check for 401 unauthorized scenario
    if (shouldTriggerErrorScenario('unauthorizedAccess') ||
        shouldTriggerErrorScenario('protectedEndpoints401')) {
      console.log('🚨 MSW: Triggering 401 error for relative appointment board');
      return HttpResponse.json(
        {
          data: null,
          errors: [{ status: '401', code: 'AUTH_REQUIRED', detail: 'Authentication required for admin endpoints' }],
          meta: { request_id: generateRequestId() }
        },
        { status: 401 }
      );
    }

    // Normal handler logic (from existing implementation)
    console.log('🔍 MSW: Board endpoint (relative /api) hit!', request.url);
    const url = new URL(request.url, 'http://localhost:3000'); // Add base URL for relative URLs
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const techId = url.searchParams.get('techId');

    console.log('📊 MSW: Board query params:', { from, to, techId });

    // Filter appointments based on query params
    let filteredAppointments = mockAppointments;

    if (from) {
      filteredAppointments = filteredAppointments.filter(apt =>
        new Date(apt.start_ts) >= new Date(from)
      );
    }

    if (to) {
      filteredAppointments = filteredAppointments.filter(apt =>
        new Date(apt.end_ts || apt.start_ts) <= new Date(to)
      );
    }

    if (techId) {
      filteredAppointments = filteredAppointments.filter(apt =>
        apt.tech_id === techId
      );
    }

    // Generate board columns
    const columns = [
      { key: 'SCHEDULED', title: 'Scheduled', count: 1, sum: 250.00 },
      { key: 'IN_PROGRESS', title: 'In Progress', count: 1, sum: 450.00 },
      { key: 'READY', title: 'Ready', count: 0, sum: 0 },
      { key: 'COMPLETED', title: 'Completed', count: 0, sum: 0 }
    ];

    // Generate board cards
    const cards = filteredAppointments.map((apt, index) => ({
      id: apt.id,
      status: apt.status,
      position: index + 1,
      start: apt.start_ts,
      end: apt.end_ts,
      customerName: apt.customer_name,
      vehicle: apt.vehicle_label,
      servicesSummary: apt.notes,
      price: apt.total_amount,
      tags: []
    }));

    const responseData = { columns, cards };
    console.log('✅ MSW: Returning board data (relative /api):', JSON.stringify(responseData, null, 2));

    return HttpResponse.json(responseData);
  }),

  // Handler for /api/appointments/board (used by network timeout test)
  http.get('/api/appointments/board', async () => {
    // Check for network timeout scenario
    if (shouldTriggerErrorScenario('networkTimeout')) {
      console.log('🚨 MSW: networkTimeout - triggering network timeout for appointment board');
      // Simulate network timeout by delaying and then returning an error response
      await new Promise(resolve => setTimeout(resolve, 1000));
      return HttpResponse.error();
    }

    // Check for 401 unauthorized scenario
    if (shouldTriggerErrorScenario('unauthorizedAccess') ||
        shouldTriggerErrorScenario('protectedEndpoints401')) {
      console.log('🚨 MSW: Triggering 401 error for appointment board');
      return HttpResponse.json(
        {
          data: null,
          errors: [{ status: '401', code: 'AUTH_REQUIRED', detail: 'Authentication required for admin endpoints' }],
          meta: { request_id: generateRequestId() }
        },
        { status: 401 }
      );
    }

    // Return a simple board response for testing
    return HttpResponse.json({
      columns: ['Scheduled', 'In Progress', 'Complete'],
      cards: []
    });
  }),

  // ========== ORIGINAL ENHANCED HANDLERS ==========
  // Enhanced PATCH /appointments/:id with 500 error scenario
  http.patch('http://localhost:3001/appointments/:id', async ({ params, request }) => {
    const id = params.id as string;

    // Check for 500 error scenario
    if (shouldTriggerErrorScenario('appointmentPatch500')) {
      console.log('🚨 MSW: Triggering 500 error for appointment PATCH');
      return HttpResponse.json(
        {
          data: null,
          errors: [{ status: '500', code: 'PROVIDER_ERROR', detail: 'Internal server error updating appointment' }],
          meta: { request_id: generateRequestId() }
        },
        { status: 500 }
      );
    }

    // Normal handler logic
    const body = await request.json() as Record<string, unknown>;
    const appointmentIndex = mockAppointments.findIndex(apt => apt.id === id);

    if (appointmentIndex === -1) {
      return HttpResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      );
    }

    // Update appointment fields
    Object.keys(body).forEach(key => {
      if (body[key] !== undefined && key in mockAppointments[appointmentIndex]) {
        (mockAppointments[appointmentIndex] as unknown as Record<string, unknown>)[key] = body[key];
      }
    });

    return HttpResponse.json({
      ok: true
    });
  }),

  // Enhanced PATCH /api/appointments/:id with 500 error scenario
  http.patch('http://localhost:3001/api/appointments/:id', async ({ params, request }) => {
    const id = params.id as string;

    // Check for 500 error scenario
    if (shouldTriggerErrorScenario('appointmentPatch500')) {
      console.log('🚨 MSW: Triggering 500 error for API appointment PATCH');
      return HttpResponse.json(
        {
          data: null,
          errors: [{ status: '500', code: 'PROVIDER_ERROR', detail: 'Internal server error updating appointment' }],
          meta: { request_id: generateRequestId() }
        },
        { status: 500 }
      );
    }

    // Normal handler logic
    const body = await request.json() as Record<string, unknown>;
    const appointmentIndex = mockAppointments.findIndex(apt => apt.id === id);

    if (appointmentIndex === -1) {
      return HttpResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      );
    }

    // Update appointment fields
    Object.keys(body).forEach(key => {
      if (body[key] !== undefined && key in mockAppointments[appointmentIndex]) {
        (mockAppointments[appointmentIndex] as unknown as Record<string, unknown>)[key] = body[key];
      }
    });

    return HttpResponse.json(mockAppointments[appointmentIndex]);
  }),

  // Enhanced dashboard stats with delay and 401 scenarios
  http.get('http://localhost:3001/admin/dashboard/stats', async () => {
    // Check for 401 unauthorized scenario
    if (shouldTriggerErrorScenario('unauthorizedAccess') ||
        shouldTriggerErrorScenario('protectedEndpoints401')) {
      console.log('🚨 MSW: Triggering 401 error for dashboard stats');
      return HttpResponse.json(
        {
          data: null,
          errors: [{ status: '401', code: 'AUTH_REQUIRED', detail: 'Authentication required for admin endpoints' }],
          meta: { request_id: generateRequestId() }
        },
        { status: 401 }
      );
    }

    // Check for network delay scenario (>3s)
    if (shouldTriggerErrorScenario('dashboardStatsDelay')) {
      console.log('🚨 MSW: Triggering 3.5s delay for dashboard stats');
      await new Promise(resolve => setTimeout(resolve, 3500)); // 3.5 second delay
    }

    // Check for network timeout scenario
    if (shouldTriggerErrorScenario('dashboardStatsTimeout')) {
      console.log('🚨 MSW: Triggering timeout for dashboard stats');
      return new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Network timeout'));
        }, 1000);
      });
    }

    // Normal response
    return HttpResponse.json({
      data: {
        totals: {
          today_completed: 3,
          today_booked: 5,
          avg_cycle: 120,
          avg_cycle_formatted: '2h 0m'
        },
        countsByStatus: {
          scheduled: 8,
          in_progress: 3,
          ready: 2,
          completed: 11,
          cancelled: 1
        },
        carsOnPremises: [
          { license: 'ABC-123', customer: 'John Doe', arrival: '09:30' },
          { license: 'XYZ-789', customer: 'Jane Smith', arrival: '11:15' }
        ],
        unpaidTotal: 1250.50
      },
      errors: null,
      meta: { request_id: generateRequestId() }
    });
  }),

  // Enhanced protected admin endpoints with 401 scenarios
  http.get('http://localhost:3001/api/admin/dashboard/stats', async () => {
    // Check for 401 unauthorized scenario
    if (shouldTriggerErrorScenario('unauthorizedAccess') ||
        shouldTriggerErrorScenario('protectedEndpoints401')) {
      console.log('🚨 MSW: Triggering 401 error for API dashboard stats');
      return HttpResponse.json(
        {
          data: null,
          errors: [{ status: '401', code: 'AUTH_REQUIRED', detail: 'Authentication required for admin endpoints' }],
          meta: { request_id: generateRequestId() }
        },
        { status: 401 }
      );
    }

    // Check for network delay scenario (>3s)
    if (shouldTriggerErrorScenario('dashboardStatsDelay')) {
      console.log('🚨 MSW: Triggering 3.5s delay for API dashboard stats');
      await new Promise(resolve => setTimeout(resolve, 3500)); // 3.5 second delay
    }

    // Normal response
    return HttpResponse.json({
      data: {
        totals: {
          today_completed: 3,
          today_booked: 5,
          avg_cycle: 120,
          avg_cycle_formatted: '2h 0m'
        },
        countsByStatus: {
          scheduled: 8,
          in_progress: 3,
          ready: 2,
          completed: 11,
          cancelled: 1
        },
        carsOnPremises: [
          { license: 'ABC-123', customer: 'John Doe', arrival: '09:30' },
          { license: 'XYZ-789', customer: 'Jane Smith', arrival: '11:15' }
        ],
        unpaidTotal: 1250.50
      },
      errors: null,
      meta: { request_id: generateRequestId() }
    });
  }),

  // Enhanced appointment board with 401 scenarios
  http.get('http://localhost:3001/api/admin/appointments/board', async ({ request }) => {
    // Check for 401 unauthorized scenario
    if (shouldTriggerErrorScenario('unauthorizedAccess') ||
        shouldTriggerErrorScenario('protectedEndpoints401')) {
      console.log('🚨 MSW: Triggering 401 error for appointment board');
      return HttpResponse.json(
        {
          data: null,
          errors: [{ status: '401', code: 'AUTH_REQUIRED', detail: 'Authentication required for admin endpoints' }],
          meta: { request_id: generateRequestId() }
        },
        { status: 401 }
      );
    }

    // Normal handler logic (from existing implementation)
    console.log('🔍 MSW: Board endpoint (with /api) hit!', request.url);
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const techId = url.searchParams.get('techId');

    console.log('📊 MSW: Board query params:', { from, to, techId });

    // Filter appointments based on query params
    let filteredAppointments = mockAppointments;

    if (from) {
      filteredAppointments = filteredAppointments.filter(apt =>
        new Date(apt.start_ts) >= new Date(from)
      );
    }

    if (to) {
      filteredAppointments = filteredAppointments.filter(apt =>
        new Date(apt.end_ts || apt.start_ts) <= new Date(to)
      );
    }

    if (techId) {
      filteredAppointments = filteredAppointments.filter(apt =>
        apt.tech_id === techId
      );
    }

    // Generate board columns
    const columns = [
      { key: 'SCHEDULED', title: 'Scheduled', count: 1, sum: 250.00 },
      { key: 'IN_PROGRESS', title: 'In Progress', count: 1, sum: 450.00 },
      { key: 'READY', title: 'Ready', count: 0, sum: 0 },
      { key: 'COMPLETED', title: 'Completed', count: 0, sum: 0 }
    ];

    // Generate board cards
    const cards = filteredAppointments.map((apt, index) => ({
      id: apt.id,
      status: apt.status,
      position: index + 1,
      start: apt.start_ts,
      end: apt.end_ts,
      customerName: apt.customer_name,
      vehicle: apt.vehicle_label,
      servicesSummary: apt.notes,
      price: apt.total_amount,
      tags: []
    }));

    const responseData = { columns, cards };
    console.log('✅ MSW: Returning board data (with /api):', JSON.stringify(responseData, null, 2));

    return HttpResponse.json(responseData);
  }),
];

// Replace existing handlers with enhanced versions for error scenario support
export { enhancedHandlers };

// Create the server instance with enhanced handlers for error scenario support
export const server = setupServer(...enhancedHandlers);
// Removed noisy global console log to avoid duplicate MSW enable messages in tests.
