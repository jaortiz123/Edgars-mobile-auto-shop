// Centralized API mocks for tests
import type {
  BoardColumn, BoardCard, DashboardStats, DrawerPayload
} from '@/types/models';

export async function getBoard(): Promise<{ columns: BoardColumn[]; cards: BoardCard[] }> {
  return { columns: [], cards: [] };
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

export async function getDrawer(): Promise<DrawerPayload> {
  return {
    appointment: { status: 'PENDING', total_amount: 0, paid_amount: 0, check_in_at: null },
    customer: { name: '' },
    vehicle: { year: '', make: '', model: '' },
    services: [],
  };
}

export async function patchAppointment(): Promise<unknown> {
  return {};
}

export function isOnline(): boolean { return true; }
export function handleApiError(): string { return ''; }

// Export client and useApi to satisfy advanced imports
export const client = {};
export function useApi() { return client; }
