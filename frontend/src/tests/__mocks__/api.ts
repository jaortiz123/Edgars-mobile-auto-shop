// Centralized API mocks for tests
import type {
  BoardColumn, BoardCard, DashboardStats, DrawerPayload
} from '@/types/models';

export async function getBoard(): Promise<{ columns: BoardColumn[]; cards: BoardCard[] }> {
  return { 
    columns: [
      { key: 'scheduled', title: 'Scheduled', count: 1, sum: 500 },
      { key: 'in-progress', title: 'In Progress', count: 1, sum: 750 },
      { key: 'completed', title: 'Completed', count: 1, sum: 300 }
    ], 
    cards: [
      {
        id: 'test-1',
        customerName: 'John Doe',
        vehicle: '2020 Toyota Camry',
        servicesSummary: 'Oil Change, Brake Inspection',
        status: 'scheduled',
        position: 1,
        price: 500
      },
      {
        id: 'test-2', 
        customerName: 'Jane Smith',
        vehicle: '2019 Honda Civic',
        servicesSummary: 'Tire Rotation, Engine Diagnostic',
        status: 'in-progress',
        position: 1,
        price: 750
      },
      {
        id: 'test-3',
        customerName: 'Bob Johnson', 
        vehicle: '2021 Ford F-150',
        servicesSummary: 'Air Filter Replacement',
        status: 'completed',
        position: 1,
        price: 300
      }
    ]
  };
}

export async function getAppointments(): Promise<{ appointments: unknown[]; nextCursor: string | null }> {
  return { appointments: [], nextCursor: null };
}

export async function getStats(): Promise<DashboardStats> {
  return {
    todayAppointments: 0,
    pendingAppointments: 0,
    completedToday: 0,
    totalCustomers: 0,
    partsOrdered: 0,
    todayRevenue: 0,
  };
}

export { getStats as getDashboardStats };

export async function getCarsOnPremises(): Promise<unknown[]> {
  return [];
}

export async function createAppointment(): Promise<string> {
  return '';
}

export async function moveAppointment(id: string, body: any): Promise<{ id: string; status: any; position: number }> {
  return { id, status: body.status, position: body.position };
}

export async function updateAppointmentStatus(): Promise<{ id: string; status: string }> {
  return { id: '', status: '' };
}

export async function getDrawer(id: string): Promise<DrawerPayload> {
  return Promise.resolve({
    appointment: { 
      status: 'PENDING', 
      total_amount: 0, 
      paid_amount: 0, 
      check_in_at: null 
    },
    customer: { name: `Test Customer ${id}` },
    vehicle: { year: '2020', make: 'Toyota', model: 'Camry' },
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
