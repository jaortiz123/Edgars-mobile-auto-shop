// Centralized API mocks with envelope format - Single Source of Truth
import type {
  BoardColumn, BoardCard, DashboardStats, DrawerPayload, Appointment,
  AppointmentService, AppointmentStatus, Message, MessageChannel, MessageStatus,
  CustomerHistoryResponse
} from '@/types/models';

// Standard API response envelope format
export interface Envelope<T> {
  data: T;
  errors: null;
  meta: { request_id: string; [key: string]: unknown };
}

// Helper to create mock envelope responses
const createEnvelope = <T>(data: T): Envelope<T> => ({
  data,
  errors: null,
  meta: { request_id: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` }
});

// Mock Board Data
export async function getBoard(): Promise<{ columns: BoardColumn[]; cards: BoardCard[] }> {
  return {
    columns: [
      { key: 'SCHEDULED', title: 'Scheduled', count: 1, sum: 500 },
      { key: 'IN_PROGRESS', title: 'In Progress', count: 1, sum: 750 },
      { key: 'COMPLETED', title: 'Completed', count: 1, sum: 300 }
    ],
    cards: [
      {
        id: 'test-1',
        customerName: 'John Doe',
        vehicle: '2020 Toyota Camry',
        servicesSummary: 'Oil Change, Brake Inspection',
        status: 'SCHEDULED',
        position: 1,
        price: 500,
        start: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes from now
        end: new Date(Date.now() + 90 * 60 * 1000).toISOString()
      },
      {
        id: 'test-2',
        customerName: 'Jane Smith',
        vehicle: '2019 Honda Civic',
        servicesSummary: 'Tire Rotation, Engine Diagnostic',
        status: 'IN_PROGRESS',
        position: 1,
        price: 750,
        start: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago (running late)
        end: new Date(Date.now() + 45 * 60 * 1000).toISOString()
      },
      {
        id: 'test-3',
        customerName: 'Bob Johnson',
        vehicle: '2021 Ford F-150',
        servicesSummary: 'Air Filter Replacement',
        status: 'COMPLETED',
        position: 1,
        price: 300,
        start: new Date(Date.now() - 120 * 60 * 1000).toISOString(), // 2 hours ago
        end: new Date(Date.now() - 60 * 60 * 1000).toISOString()
      }
    ]
  };
}

// Mock Appointments Data with Envelope
export async function getAppointments(): Promise<{ appointments: Appointment[]; nextCursor: string | null }> {
  const mockData = {
    appointments: [
      {
        id: 'apt-1',
        status: 'SCHEDULED' as AppointmentStatus,
        start: '2024-01-15T14:00:00Z',
        end: '2024-01-15T15:00:00Z',
        total_amount: 75.00,
        paid_amount: 0,
        check_in_at: null,
        check_out_at: null,
        tech_id: null
      }
    ],
    nextCursor: null
  };
  return mockData;
}

// Mock Stats Data
export async function getStats(): Promise<DashboardStats> {
  return {
    jobsToday: 5,
    carsOnPremises: 3,
    scheduled: 2,
    inProgress: 1,
    ready: 2,
    completed: 3,
    noShow: 0,
    unpaidTotal: 150.00,
    totals: {
      today_completed: 3,
      today_booked: 5,
      avg_cycle: 120,
      avg_cycle_formatted: '2h 0m'
    }
  };
}

export { getStats as getDashboardStats };

// Mock Cars on Premises
export async function getCarsOnPremises(): Promise<unknown[]> {
  return [];
}

// Mock Create Appointment
export async function createAppointment(_appointmentData: Partial<Appointment>): Promise<string> {
  return `mock-appointment-${Date.now()}`;
}

// Mock Move Appointment
export async function moveAppointment(
  id: string,
  body: { status: AppointmentStatus; position: number }
): Promise<{ id: string; status: AppointmentStatus; position: number }> {
  return { id, status: body.status, position: body.position };
}

// Mock Update Appointment Status
export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus
): Promise<{ id: string; status: AppointmentStatus }> {
  return { id, status };
}

// Mock Drawer Data
export async function getDrawer(id: string): Promise<DrawerPayload> {
  return {
    appointment: {
      id,
      status: 'SCHEDULED' as AppointmentStatus,
      start: new Date().toISOString(),
      end: null,
      total_amount: 150.00,
      paid_amount: 0,
      check_in_at: null,
      check_out_at: null,
      tech_id: null
    },
    customer: {
      id: 'cust-123',
      name: `Test Customer ${id}`,
      email: 'test@example.com',
      phone: '555-0123'
    },
    vehicle: {
      id: 'veh-456',
      year: 2020,
      make: 'Toyota',
      model: 'Camry',
      vin: 'TEST123456789'
    },
    services: []
  };
}

// Mock Patch Appointment
export async function patchAppointment(id: string, body: Partial<Appointment>): Promise<Appointment> {
  return {
    id,
    status: 'SCHEDULED' as AppointmentStatus,
    start: new Date().toISOString(),
    end: null,
    total_amount: 100,
    paid_amount: 0,
    check_in_at: null,
    check_out_at: null,
    tech_id: null,
    ...body
  };
}

// Service CRUD Operations
export async function getAppointmentServices(appointmentId: string): Promise<AppointmentService[]> {
  return [
    {
      id: 'svc-1',
      appointment_id: appointmentId,
      name: 'Oil Change',
      notes: 'Standard oil change service',
      estimated_hours: 0.5,
      estimated_price: 75.00,
      category: 'maintenance'
    }
  ];
}

export async function createAppointmentService(
  appointmentId: string,
  service: Partial<AppointmentService>
): Promise<{ service: AppointmentService; appointment_total: number }> {
  const mockService: AppointmentService = {
    id: `svc-${Date.now()}`,
    appointment_id: appointmentId,
    name: service.name || 'Mock Service',
    notes: service.notes || 'Mock service description',
    estimated_hours: service.estimated_hours || 1,
    estimated_price: service.estimated_price || 100,
    category: service.category || 'general'
  };

  return {
    service: mockService,
    appointment_total: 250.00
  };
}

export async function updateAppointmentService(
  appointmentId: string,
  serviceId: string,
  service: Partial<AppointmentService>
): Promise<{ service: AppointmentService; appointment_total: number }> {
  const mockService: AppointmentService = {
    id: serviceId,
    appointment_id: appointmentId,
    name: service.name || 'Updated Service',
    notes: service.notes || 'Updated service description',
    estimated_hours: service.estimated_hours || 0.75,
    estimated_price: service.estimated_price || 120,
    category: service.category || 'general'
  };

  return {
    service: mockService,
    appointment_total: 320.00
  };
}

export async function deleteAppointmentService(
  appointmentId: string,
  serviceId: string
): Promise<{ message: string; appointment_total: number }> {
  return {
    message: `Service ${serviceId} deleted from appointment ${appointmentId}`,
    appointment_total: 150.00
  };
}

// Messaging Operations
export async function getAppointmentMessages(appointmentId: string): Promise<Message[]> {
  return [
    {
      id: 'msg-1',
      appointment_id: appointmentId,
      channel: 'sms' as MessageChannel,
      direction: 'out' as const,
      body: 'Your car is ready for pickup',
      status: 'delivered' as MessageStatus,
      sent_at: '2025-01-28T10:00:00Z'
    }
  ];
}

export async function createAppointmentMessage(
  _appointmentId: string,
  _message: { channel: MessageChannel; body: string }
): Promise<{ id: string; status: MessageStatus }> {
  return {
    id: `msg-${Date.now()}`,
    status: 'sent' as MessageStatus
  };
}

export async function updateMessageStatus(
  _appointmentId: string,
  messageId: string,
  _update: { status: MessageStatus }
): Promise<{ id: string }> {
  return { id: messageId };
}

export async function deleteAppointmentMessage(
  _appointmentId: string,
  _messageId: string
): Promise<void> {
  // Mock delete - no return value
}

// Customer History
export async function getCustomerHistory(_customerId: string): Promise<CustomerHistoryResponse> {
  return {
    data: {
      pastAppointments: [
        {
          id: 'apt-history-1',
          status: 'COMPLETED',
          start: '2024-01-01T10:00:00Z',
          total_amount: 150.00,
          paid_amount: 150.00,
          created_at: '2024-01-01T09:00:00Z',
          payments: [
            {
              id: 'pay-1',
              amount: 150.00,
              method: 'credit_card',
              created_at: '2024-01-01T11:00:00Z'
            }
          ]
        }
      ],
      payments: [
        {
          id: 'pay-1',
          amount: 150.00,
          method: 'credit_card',
          created_at: '2024-01-01T11:00:00Z'
        }
      ]
    },
    errors: null
  };
}

// Utility Functions
export async function checkConflict(slot: { date: string; time: string }): Promise<{ conflict: boolean; conflictingAppointment?: Record<string, unknown> }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Test mock: no conflicts by default (conflict detection handled server-side)
      resolve({ conflict: false });
    }, 300);
  });
}

export async function markArrived(id: string): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`Appointment ${id} marked as arrived.`);
      resolve();
    }, 300);
  });
}

export function isOnline(): boolean {
  return true;
}

export function handleApiError(err: unknown, defaultMessage?: string): string {
  let msg: string;
  if (err && typeof err === 'object' && 'message' in err) {
    msg = (err as { message: string }).message || defaultMessage || 'Request failed';
  } else {
    msg = defaultMessage || 'Unknown error';
  }
  console.error('[api mock]', msg);
  return msg;
}

// Export client and useApi to satisfy advanced imports
export const client = {};
export function useApi() {
  return client;
}

// Export envelope creator for advanced use cases
export { createEnvelope };
