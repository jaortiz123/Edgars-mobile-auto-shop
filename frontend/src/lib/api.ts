import axios from 'axios';
import type {
  Appointment, AppointmentService, AppointmentStatus,
  BoardCard, BoardColumn, DashboardStats, DrawerPayload
} from '../types/models';

// Re-export types for components
export type {
  Appointment, AppointmentService, AppointmentStatus,
  BoardCard, BoardColumn, DashboardStats, DrawerPayload
} from '../types/models';

export const toStatus = (s: string): AppointmentStatus =>
  (s || '').toUpperCase().replace('-', '_').replace('NO_SHOW', 'NO_SHOW') as AppointmentStatus;

const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

const http = axios.create({
  baseURL: BASE,
  timeout: 10000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.response.use(r => r, e => {
  const msg = e?.response?.data?.error || e.message || 'Request failed';
  return Promise.reject(new Error(msg));
});

export async function getBoard(params: { from?: string; to?: string; techId?: string }) {
  const { data } = await http.get<{ columns: BoardColumn[]; cards: BoardCard[] }>('/admin/appointments/board', { params });
  // JSON parse guard
  try {
    JSON.parse(JSON.stringify(data));
  } catch (error) {
    console.error("Failed to parse board data", error);
    return { columns: [], cards: [] };
  }
  return data;
}
export async function moveAppointment(id: string, body: { status: AppointmentStatus; position: number }) {
  const { data } = await http.patch<Appointment>(`/admin/appointments/${id}/move`, body);
  return data;
}
export async function getDrawer(id: string) {
  const { data } = await http.get<DrawerPayload>(`/appointments/${id}`);
  return data;
}
export async function patchAppointment(id: string, body: Partial<Appointment>) {
  const { data } = await http.patch<Appointment>(`/appointments/${id}`, body);
  return data;
}
export async function getStats(params: { from?: string; to?: string } = {}) {
  const { data } = await http.get<DashboardStats>('/admin/dashboard/stats', { params });
  return data;
}
export async function getCarsOnPremises() {
  const { data } = await http.get<{ cars_on_premises: any[] }>('/admin/cars-on-premises');
  return data.cars_on_premises;
}

// Additional methods expected by Dashboard.tsx
export async function getAppointments() {
  const { data } = await http.get<{ appointments: Appointment[] }>('/admin/appointments');
  return data;
}

export async function getDashboardStats() {
  return getStats();
}

export async function createAppointment(appointmentData: any) {
  const { data } = await http.post<Appointment>('/admin/appointments', appointmentData);
  return data;
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  const { data } = await http.patch<Appointment>(`/admin/appointments/${id}/status`, { status });
  return data;
}

// Lightweight utilities expected by Dashboard.tsx
export function isOnline() {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

export function handleApiError(err: unknown, defaultMessage?: string): string {
  let msg: string;
  if (axios.isAxiosError(err)) {
    msg = (err.response?.data as any)?.error || err.message || defaultMessage || 'Request failed';
  } else {
    msg = (err as any)?.message || defaultMessage || 'Unknown error';
  }
  console.error('[api]', msg);
  return msg;
}

// Expose the axios instance for advanced callers
export const client = http;

// Minimal hook so callers can `useApi()` if they want symmetry
export function useApi() {
  return client;
}