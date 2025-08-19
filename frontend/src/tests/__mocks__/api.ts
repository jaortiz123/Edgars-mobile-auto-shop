// Centralized API mocks for tests
import type {
  BoardColumn, BoardCard, DashboardStats, DrawerPayload, AppointmentStatus
} from '@/types/models';
import type { MockMoveAppointmentRequest, MockMoveAppointmentResponse } from '@/types/test';
import type { TemplateAnalyticsResponse } from '../../types/analytics';

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

export async function getAppointments(): Promise<{ appointments: unknown[]; nextCursor: string | null }> {
  return { appointments: [], nextCursor: null };
}

export async function getStats(): Promise<DashboardStats> {
  return {
    jobsToday: 0,
    carsOnPremises: 0,
    scheduled: 0,
    inProgress: 0,
    ready: 0,
    completed: 0,
    noShow: 0,
    unpaidTotal: 0,
    completedToday: 0,
    pendingAppointments: 0,
    todayRevenue: 0,
    partsOrdered: 0,
    totals: {
      today_completed: 0,
      today_booked: 0,
      avg_cycle: null,
      avg_cycle_formatted: 'N/A',
    },
  };
}

export { getStats as getDashboardStats };

export async function getCarsOnPremises(): Promise<unknown[]> {
  return [];
}

export async function createAppointment(): Promise<string> {
  return '';
}

export async function moveAppointment(
  id: string,
  body: MockMoveAppointmentRequest
): Promise<MockMoveAppointmentResponse> {
  return { id, status: body.status, position: body.position };
}

export async function updateAppointmentStatus(): Promise<{ id: string; status: string }> {
  return { id: '', status: '' };
}

export async function getDrawer(id: string): Promise<DrawerPayload> {
  return Promise.resolve({
    appointment: {
      id,
      status: 'SCHEDULED' as AppointmentStatus,
      total_amount: 0,
      paid_amount: 0,
      check_in_at: null
    },
    customer: {
      id: `cust-${id}`,
      name: `Test Customer ${id}`,
      email: 'test@example.com',
      phone: '555-0123'
    },
    vehicle: {
      id: `veh-${id}`,
      year: 2020,
      make: 'Toyota',
      model: 'Camry',
      vin: 'TEST123456789'
    },
    services: [],
  });
}

export async function patchAppointment(): Promise<unknown> {
  return {};
}

export function isOnline(): boolean { return true; }
export function handleApiError(): string { return ''; }

// Export client and useApi to satisfy advanced imports
export const client = {};
export function useApi() { return client; }

// Analytics mocks
export async function fetchTemplateAnalytics(): Promise<TemplateAnalyticsResponse> {
  throw new Error('fetchTemplateAnalytics mock not implemented');
}
