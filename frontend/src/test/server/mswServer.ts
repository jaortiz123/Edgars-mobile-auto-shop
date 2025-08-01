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

// Request handlers
const handlers = [
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

  // Services endpoints
  http.get('http://localhost:3001/appointments/:id/services', ({ params }) => {
    const appointmentId = params.id as string;
    const services = mockServices.filter(s => s.appointment_id === appointmentId);
    
    return HttpResponse.json({
      services,
      errors: null,
      meta: { request_id: generateRequestId() }
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

    return HttpResponse.json({
      service: newService,
      appointment_total: appointment?.total_amount || 0,
      errors: null,
      meta: { request_id: generateRequestId() }
    }, { status: 201 });
  }),

  // Dashboard stats
  http.get('http://localhost:3001/admin/dashboard/stats', () => {
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

// Create the server instance
export const server = setupServer(...handlers);

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

// Log that MSW is enabled
console.log('🌐 MSW enabled for integration tests');
