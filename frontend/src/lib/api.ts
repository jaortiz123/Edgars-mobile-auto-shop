import axios from 'axios';
import type {
  Appointment, AppointmentService, AppointmentStatus,
  BoardCard, BoardColumn, DashboardStats, DrawerPayload,
  CarOnPremises, Message, MessageChannel, MessageStatus,
  ServiceOperation, Technician
} from '../types/models';

// Re-export types for components
export type {
  Appointment, AppointmentService, AppointmentStatus,
  BoardCard, BoardColumn, DashboardStats, DrawerPayload,
  Message, MessageChannel, MessageStatus
} from '../types/models';
export type { Technician } from '../types/models';

export async function getServiceOperations(): Promise<ServiceOperation[]> {
  const { data } = await http.get<{ service_operations: ServiceOperation[] }>(
    '/admin/service-operations'
  );
  return data.service_operations;
}

export async function getTechnicians(): Promise<Technician[]> {
  const { data } = await http.get<{ technicians: Technician[] }>(
    '/admin/technicians'
  );
  return data.technicians;
}

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
  console.log('🔧 api.getBoard: Function entry - START');
  console.log('🔧 api.getBoard: Params:', params);
  
  try {
    console.log('🔧 api.getBoard: Starting HTTP request...');
    const response = await http.get<{ columns: BoardColumn[]; cards: BoardCard[] }>('/admin/appointments/board', { params });
    console.log('🔧 api.getBoard: HTTP response received:', {
      status: response.status,
      statusText: response.statusText,
      dataKeys: Object.keys(response.data || {}),
      columnsLength: response.data?.columns?.length,
      cardsLength: response.data?.cards?.length
    });
    
    const { data } = response;
    console.log('🔧 api.getBoard: Returning data successfully');
    return data;
  } catch (error) {
    console.log('🔧 api.getBoard: Caught error:', {
      message: (error as Error)?.message,
      stack: (error as Error)?.stack,
      name: (error as Error)?.name,
      fullError: error
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
  // Fallback for legacy callers: map to specific quick action endpoints
  if (status === 'IN_PROGRESS') {
    const { data } = await http.post<{ data: { id: string; status: AppointmentStatus } }>(`/appointments/${id}/start`, {});
    return data.data;
  }
  if (status === 'READY') {
    const { data } = await http.post<{ data: { id: string; status: AppointmentStatus } }>(`/appointments/${id}/ready`, {});
    return data.data;
  }
  if (status === 'COMPLETED') {
    const { data } = await http.post<{ data: { id: string; status: AppointmentStatus } }>(`/appointments/${id}/complete`, {});
    return data.data;
  }
  // Generic patch as last resort
  const { data } = await http.patch<{ data: { id: string; status: AppointmentStatus } }>(`/appointments/${id}`, { status });
  return data.data;
}

// Generic partial update for appointment fields (e.g., check_in_at without status change)
export async function patchAppointment(
  id: string,
  update: Partial<{
    status: AppointmentStatus;
    start: string | null;
    end: string | null;
    total_amount: number | null;
    paid_amount: number | null;
    check_in_at: string | null;
    check_out_at: string | null;
    tech_id: string | null;
  // Vehicle-related updates (upsert/link semantics on backend)
  license_plate: string;
  vehicle_year: number;
  vehicle_make: string;
  vehicle_model: string;
  }>
): Promise<{ id: string; updated_fields?: string[] }> {
  // Debug: log outgoing PATCH payload and URL
  try {
    console.debug('[api.patchAppointment] PATCH /appointments/%s payload:', id, update);
  } catch {
    /* ignore console errors in non-browser env */
  }
  const { data } = await http.patch<{ data: { id: string; updated_fields?: string[] } }>(`/appointments/${id}`, update);
  return data.data;
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
  // Preserve /api prefix regardless of how axios joins baseURL and paths
  const resp = await http.get<Envelope<DrawerPayload>>(`/appointments/${id}`);
  return resp.data.data;
}

// Services CRUD methods
export async function getAppointmentServices(appointmentId: string): Promise<AppointmentService[]> {
  const resp = await http.get<{ services: AppointmentService[] }>(
    `/appointments/${appointmentId}/services`
  );
  return resp.data.services;
}

export async function createAppointmentService(
  appointmentId: string, 
  service: Partial<AppointmentService>
): Promise<{ service: AppointmentService; appointment_total: number }> {
  console.log('🔧 API: createAppointmentService called with:', { appointmentId, service });
  console.log('🔧 API: baseURL configured as:', http.defaults.baseURL);
  
  // Create the service - backend returns just {id: serviceId}
  console.log('🔧 API: About to make POST request to /appointments/' + appointmentId + '/services');
  console.log('🔧 API: Full URL will be:', http.defaults.baseURL + '/appointments/' + appointmentId + '/services');
  
  try {
    const resp = await http.post<{ id: string }>(
      `/appointments/${appointmentId}/services`,
      service
    );
    console.log('🔧 API: POST request completed successfully, response:', resp.data);
    console.log('🔧 API: Response status:', resp.status);
    console.log('🔧 API: Response headers:', resp.headers);
    
    // Refetch all services to get the complete service object and updated total
    console.log('🔧 API: About to refetch all services');
    const allServices = await getAppointmentServices(appointmentId);
    console.log('🔧 API: Refetched services:', allServices);
    
    const newService = allServices.find(s => s.id === resp.data.id);
    console.log('🔧 API: Found new service:', newService);
    
    if (!newService) {
      throw new Error('Created service not found');
    }
    
    // Calculate total from services (since backend doesn't return it)
    const appointment_total = allServices.reduce((sum, s) => sum + (s.estimated_price || 0), 0);
    console.log('🔧 API: Calculated total:', appointment_total);
    
    const result = {
      service: newService,
      appointment_total
    };
    console.log('🔧 API: Returning final result:', result);
    
    return result;
  } catch (error) {
    console.error('🔧 API: Error in createAppointmentService:', error);
    console.error('🔧 API: Error type:', typeof error);
    console.error('🔧 API: Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      name: error instanceof Error ? error.name : 'Unknown error type'
    });
    throw error;
  }
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
// Deprecated: use typed patchAppointment above
// export async function patchAppointment(id: string, body: Partial<Appointment>) {
//   const { data } = await http.patch<Appointment>(`/appointments/${id}`, body);
//   return data;
// }

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

export async function deleteAppointment(id: string): Promise<void> {
  // Ensure we always hit the correct API prefix regardless of how axios joins baseURL
  const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
  const url = `${base}/admin/appointments/${id}`;
  await http.delete(url);
}

// Reschedule: update the start time of an appointment
export async function rescheduleAppointment(id: string, startISO: string): Promise<void> {
  // Backend accepts PATCH /api/appointments/:id with { start }
  await http.patch(`/appointments/${id}`, { start: startISO });
}

// Expose the axios instance for advanced callers
export function useApi() {
  return http;
}