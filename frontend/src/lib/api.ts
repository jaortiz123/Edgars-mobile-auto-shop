import axios from 'axios';
import type {
  Appointment, AppointmentService, AppointmentStatus,
  BoardCard, BoardColumn, DashboardStats, DrawerPayload,
  CarOnPremises, Message, MessageChannel, MessageStatus
} from '../types/models';

// Re-export types for components
export type {
  Appointment, AppointmentService, AppointmentStatus,
  BoardCard, BoardColumn, DashboardStats, DrawerPayload,
  Message, MessageChannel, MessageStatus
} from '../types/models';

export const toStatus = (s: string): AppointmentStatus =>
  (s || '').toUpperCase().replace('-', '_').replace('NO_SHOW', 'NO_SHOW') as AppointmentStatus;

const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

console.log('🔧 api.ts: BASE URL configuration:', {
  'import.meta.env.VITE_API_BASE_URL': import.meta.env.VITE_API_BASE_URL,
  'process.env.VITE_API_BASE_URL': globalThis.process?.env?.VITE_API_BASE_URL,
  'resolved BASE': BASE
});

const http = axios.create({
  baseURL: BASE,
  timeout: 10000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

/* eslint-disable @typescript-eslint/no-explicit-any */
// Unwrap API envelopes ({ data, errors, meta }) and throw on errors
http.interceptors.response.use(
  r => r,
  e => {
    const d = e.response?.data;
    if (d && typeof d === 'object' && 'errors' in d && Array.isArray((d as any).errors)) {
      const err = (d as { errors: Array<{ detail?: string; code?: string }> }).errors[0];
      return Promise.reject(new Error(err.detail || err.code || 'Request failed'));
    }
    const msg = (d && typeof d === 'object' && 'error' in d ? (d as { error?: string }).error : undefined)
      || e.message || 'Request failed';
    return Promise.reject(new Error(msg));
  }
);
/* eslint-enable @typescript-eslint/no-explicit-any */

// Standard API response envelope
export interface Envelope<T> {
  data: T;
  errors: null;
  meta: { request_id: string; [key: string]: unknown };
}

export async function getBoard(params: { from?: string; to?: string; techId?: string }) {
  console.error('CRITICAL: api.getBoard FUNCTION ENTRY - THIS SHOULD ALWAYS APPEAR IF FUNCTION IS CALLED');
  console.error('CRITICAL: getBoard params:', params);
  console.error('CRITICAL: getBoard function source location:', import.meta.url);
  console.log('🔧 api.getBoard: Function entry - START');
  console.log('🔧 api.getBoard: Axios config:', {
    baseURL: http.defaults.baseURL,
    timeout: http.defaults.timeout,
    headers: http.defaults.headers
  });
  try {
    console.log('🔧 api.getBoard: Starting request with params:', params);
    const response = await http.get<{ columns: BoardColumn[]; cards: BoardCard[] }>('/admin/appointments/board', { params });
    console.log('🔧 api.getBoard: Raw axios response:', {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data
    });
    
    const { data } = response;
    console.log('🔧 api.getBoard: Extracted data:', data);
    
    // JSON parse guard
    try {
      const serialized = JSON.stringify(data);
      console.log('🔧 api.getBoard: JSON stringify successful, length:', serialized.length);
      JSON.parse(serialized);
      console.log('🔧 api.getBoard: JSON parse guard passed');
    } catch (error) {
      console.error("🔧 api.getBoard: Failed to parse board data", error);
      return { columns: [], cards: [] };
    }
    
    console.log('🔧 api.getBoard: Returning data:', { 
      columnsCount: data?.columns?.length, 
      cardsCount: data?.cards?.length 
    });
    return data;
  } catch (error) {
    console.error('🔧 api.getBoard: Caught error at function start:', error);
    console.error('🔧 api.getBoard: Error details:', {
      message: (error as Error)?.message,
      stack: (error as Error)?.stack,
      name: (error as Error)?.name
    });
    throw error;
  }
}

export async function getAppointments(): Promise<{ appointments: Appointment[]; nextCursor: string | null }> {
  const resp = await http.get<Envelope<{ appointments: Appointment[]; nextCursor: string | null }>>(
    '/admin/appointments'
  );
  return resp.data.data;
}

export async function createAppointment(
  appointmentData: Partial<Appointment>
): Promise<string> {
  const resp = await http.post<{ id: string }>(
    '/admin/appointments',
    appointmentData
  );
  return resp.data.id;
}

export async function moveAppointment(
  id: string,
  body: { status: AppointmentStatus; position: number }
): Promise<{ id: string; status: AppointmentStatus; position: number }> {
  const resp = await http.patch<{ id: string; status: AppointmentStatus; position: number }>(
    `/admin/appointments/${id}/move`,
    body
  );
  return resp.data;
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus
): Promise<{ id: string; status: AppointmentStatus }> {
  const resp = await http.patch<{ id: string; status: AppointmentStatus }>(
    `/admin/appointments/${id}/status`,
    { status }
  );
  return resp.data;
}

export async function getStats(
  params: { from?: string; to?: string } = {}
): Promise<DashboardStats> {
  const resp = await http.get<DashboardStats>('/admin/dashboard/stats', { params });
  return resp.data;
}

export async function getCarsOnPremises(): Promise<CarOnPremises[]> {
  const resp = await http.get<{ cars_on_premises: CarOnPremises[] }>(
    '/admin/cars-on-premises'
  );
  return resp.data.cars_on_premises;
}

// Additional methods expected by Dashboard.tsx
export async function getDrawer(id: string) {
  const { data } = await http.get<DrawerPayload>(`/appointments/${id}`);
  return data;
}

// Services CRUD methods
export async function getAppointmentServices(appointmentId: string): Promise<AppointmentService[]> {
  const resp = await http.get<Envelope<{ services: AppointmentService[] }>>(
    `/appointments/${appointmentId}/services`
  );
  return resp.data.data.services;
}

export async function createAppointmentService(
  appointmentId: string, 
  service: Partial<AppointmentService>
): Promise<{ service: AppointmentService; appointment_total: number }> {
  const resp = await http.post<{ service: AppointmentService; appointment_total: number }>(
    `/appointments/${appointmentId}/services`,
    service
  );
  return resp.data;
}

export async function updateAppointmentService(
  appointmentId: string,
  serviceId: string,
  service: Partial<AppointmentService>
): Promise<{ service: AppointmentService; appointment_total: number }> {
  const resp = await http.patch<{ service: AppointmentService; appointment_total: number }>(
    `/appointments/${appointmentId}/services/${serviceId}`,
    service
  );
  return resp.data;
}

export async function deleteAppointmentService(
  appointmentId: string,
  serviceId: string
): Promise<{ message: string; appointment_total: number }> {
  const resp = await http.delete<{ message: string; appointment_total: number }>(
    `/appointments/${appointmentId}/services/${serviceId}`
  );
  return resp.data;
}
export async function patchAppointment(id: string, body: Partial<Appointment>) {
  const { data } = await http.patch<Appointment>(`/appointments/${id}`, body);
  return data;
}

export async function updateAppointment(id: string, body: Partial<Appointment>) {
  const { data } = await http.patch<Appointment>(`/appointments/${id}`, body);
  return data;
}

// Lightweight utilities expected by Dashboard.tsx
export function isOnline() {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

// ----------------------------------------------------------------------------
// Messaging (T-021)
// ----------------------------------------------------------------------------

export async function getAppointmentMessages(appointmentId: string): Promise<Message[]> {
  const { data } = await http.get<{ messages: Message[] }>(`/appointments/${appointmentId}/messages`);
  return data.messages;
}

export async function createAppointmentMessage(
  appointmentId: string,
  message: { channel: MessageChannel; body: string }
): Promise<{ id: string; status: MessageStatus }> {
  const { data } = await http.post<{ id: string; status: MessageStatus }>(
    `/appointments/${appointmentId}/messages`,
    message
  );
  return data;
}

export async function updateMessageStatus(
  appointmentId: string,
  messageId: string,
  update: { status: MessageStatus }
): Promise<{ id: string }> {
  const { data } = await http.patch<{ id: string }>(
    `/appointments/${appointmentId}/messages/${messageId}`,
    update
  );
  return data;
}

export async function deleteAppointmentMessage(
  appointmentId: string,
  messageId: string
): Promise<void> {
  await http.delete(`/appointments/${appointmentId}/messages/${messageId}`);
}

// ----------------------------------------------------------------------------
// Customer History (T-023)
// ----------------------------------------------------------------------------

export interface CustomerHistoryPayment {
  id: string;
  amount: number;
  method: string;
  created_at: string;
}

export interface CustomerHistoryAppointment {
  id: string;
  status: string;
  start: string;
  total_amount: number;
  paid_amount: number;
  created_at: string;
  payments: CustomerHistoryPayment[];
}

export interface CustomerHistoryResponse {
  data: {
    pastAppointments: CustomerHistoryAppointment[];
    payments: CustomerHistoryPayment[];
  };
  errors: null;
}

export async function getCustomerHistory(customerId: string): Promise<CustomerHistoryResponse> {
  const { data } = await http.get<CustomerHistoryResponse>(`/customers/${customerId}/history`);
  return data;
}

export async function checkConflict(slot: { date: string; time: string }): Promise<{ conflict: boolean; conflictingAppointment?: { id: string; customerName: string; serviceType: string; appointmentDate: string; appointmentTime: string } }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Mock conflict logic: conflict if time is 10:00 AM on any date
      if (slot.time === '10:00 AM') {
        resolve({
          conflict: true,
          conflictingAppointment: {
            id: 'mock-conflict-123',
            customerName: 'John Doe',
            serviceType: 'Engine Diagnostics',
            appointmentDate: slot.date,
            appointmentTime: slot.time,
          },
        });
      } else {
        resolve({ conflict: false });
      }
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

export function handleApiError(err: unknown, defaultMessage?: string): string {
  let msg: string;
  if (axios.isAxiosError(err)) {
    msg = (err.response?.data as { error?: string })?.error || err.message || defaultMessage || 'Request failed';
  } else {
    msg = (err as { message?: string })?.message || defaultMessage || 'Unknown error';
  }
  console.error('[api]', msg);
  return msg;
}

export async function login(username: string, password: string): Promise<{ token?: string; user?: unknown }> {
  const response = await http.post('/admin/login', { username, password });
  return response.data;
}

// Expose the axios instance for advanced callers
export function useApi() {
  return http;
}