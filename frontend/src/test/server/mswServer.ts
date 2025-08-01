/**
 * Phase 2 Task 1: MSW Integration Test Server
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

// Mock data fixtures
const mockAppointments: MockAppointment[] = [
  {
    id: 'apt-1',
    status: 'SCHEDULED',
    start_ts: '2024-01-15T14:00:00Z',
    end_ts: '2024-01-15T15:00:00Z',
    total_amount: 250.00,
    paid_amount: 0,
    customer_name: 'John Doe',
    vehicle_label: '2020 Toyota Camry',
    customer_id: 'cust-1',
    vehicle_id: 'veh-1',
    tech_id: null,
    notes: 'Oil change and inspection'
  },
  {
    id: 'apt-2',
    status: 'IN_PROGRESS',
    start_ts: '2024-01-15T16:00:00Z',
    end_ts: '2024-01-15T17:00:00Z',
    total_amount: 450.00,
    paid_amount: 450.00,
    customer_name: 'Jane Smith',
    vehicle_label: '2019 Honda Civic',
    customer_id: 'cust-2',
    vehicle_id: 'veh-2',
    tech_id: 'tech-1',
    notes: 'Brake pad replacement'
  }
];

const mockCustomers = [
  {
    id: 'cust-1',
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+15551234567'
  },
  {
    id: 'cust-2',
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    phone: '+15559876543'
  }
];

const mockVehicles = [
  {
    id: 'veh-1',
    year: 2020,
    make: 'Toyota',
    model: 'Camry',
    vin: '1HGBH41JXMN109186'
  },
  {
    id: 'veh-2',
    year: 2019,
    make: 'Honda',
    model: 'Civic',
    vin: '2HGBH41JXMN109187'
  }
];

const mockServices: MockService[] = [
  {
    id: 'svc-1',
    appointment_id: 'apt-1',
    name: 'Oil Change',
    notes: 'Full synthetic oil',
    estimated_hours: 0.5,
    estimated_price: 75.00,
    category: 'Maintenance'
  },
  {
    id: 'svc-2',
    appointment_id: 'apt-2',
    name: 'Brake Pad Replacement',
    notes: 'Front brake pads',
    estimated_hours: 2.0,
    estimated_price: 350.00,
    category: 'Repair'
  }
];

// Request handlers
const handlers = [
  // Board endpoint
  http.get('http://localhost:3001/api/admin/appointments/board', ({ request }) => {
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const techId = url.searchParams.get('techId');

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

    return HttpResponse.json({ columns, cards });
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
  http.get('http://localhost:3001/api/appointments/:id', ({ params }) => {
    const id = params.id as string;
    const appointment = mockAppointments.find(apt => apt.id === id);
    
    if (!appointment) {
      return HttpResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      );
    }

    const customer = mockCustomers.find(c => c.id === appointment.customer_id);
    const vehicle = mockVehicles.find(v => v.id === appointment.vehicle_id);
    const services = mockServices.filter(s => s.appointment_id === id);

    return HttpResponse.json({
      appointment,
      customer,
      vehicle,
      services,
      messages: [],
      payments: []
    });
  }),

  // Create appointment
  http.post('http://localhost:3001/api/admin/appointments', async ({ request }) => {
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
  http.patch('http://localhost:3001/api/admin/appointments/:id/move', async ({ params, request }) => {
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
  http.patch('http://localhost:3001/api/admin/appointments/:id/status', async ({ params, request }) => {
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
  http.get('http://localhost:3001/api/appointments/:id/services', ({ params }) => {
    const appointmentId = params.id as string;
    const services = mockServices.filter(s => s.appointment_id === appointmentId);
    
    return HttpResponse.json({
      services,
      errors: null,
      meta: { request_id: generateRequestId() }
    });
  }),

  http.post('http://localhost:3001/api/appointments/:id/services', async ({ params, request }) => {
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
  http.get('http://localhost:3001/api/admin/dashboard/stats', () => {
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
  http.get('http://localhost:3001/api/appointments/:id/messages', () => {
    return HttpResponse.json({
      messages: [],
      errors: null,
      meta: { request_id: generateRequestId() }
    });
  }),

  http.post('http://localhost:3001/api/appointments/:id/messages', async ({ request }) => {
    await request.json(); // Read body but don't use it
    
    return HttpResponse.json({
      id: `msg-${Date.now()}`,
      status: 'sent',
      errors: null,
      meta: { request_id: generateRequestId() }
    }, { status: 201 });
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
      id: 'apt-1',
      status: 'SCHEDULED',
      start_ts: '2024-01-15T14:00:00Z',
      end_ts: '2024-01-15T15:00:00Z',
      total_amount: 250.00,
      paid_amount: 0,
      customer_name: 'John Doe',
      vehicle_label: '2020 Toyota Camry',
      customer_id: 'cust-1',
      vehicle_id: 'veh-1',
      tech_id: null,
      notes: 'Oil change and inspection'
    },
    {
      id: 'apt-2',
      status: 'IN_PROGRESS',
      start_ts: '2024-01-15T16:00:00Z',
      end_ts: '2024-01-15T17:00:00Z',
      total_amount: 450.00,
      paid_amount: 450.00,
      customer_name: 'Jane Smith',
      vehicle_label: '2019 Honda Civic',
      customer_id: 'cust-2',
      vehicle_id: 'veh-2',
      tech_id: 'tech-1',
      notes: 'Brake pad replacement'
    }
  );

  // Reset services
  mockServices.length = 0;
  mockServices.push(
    {
      id: 'svc-1',
      appointment_id: 'apt-1',
      name: 'Oil Change',
      notes: 'Full synthetic oil',
      estimated_hours: 0.5,
      estimated_price: 75.00,
      category: 'Maintenance'
    },
    {
      id: 'svc-2',
      appointment_id: 'apt-2',
      name: 'Brake Pad Replacement',
      notes: 'Front brake pads',
      estimated_hours: 2.0,
      estimated_price: 350.00,
      category: 'Repair'
    }
  );
}

// Utility to add custom handlers for specific tests
export function addCustomHandler(handler: any) {
  server.use(handler);
}

// Log that MSW is enabled
console.log('🌐 MSW enabled for integration tests');
