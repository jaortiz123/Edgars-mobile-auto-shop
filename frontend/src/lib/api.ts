// NOTE: This file contains full API utilities. Remove earlier temporary stub declarations to avoid duplicates.
import axios from 'axios';
import type { TemplateAnalyticsResponse, FetchTemplateAnalyticsParams } from '../types/analytics';
import type {
  Appointment, AppointmentService, AppointmentStatus,
  BoardCard, BoardColumn, Customer, DashboardStats, DrawerPayload,
  CarOnPremises, Message, MessageChannel, MessageStatus,
  ServiceOperation, ServiceOperationInput, Technician, Vehicle
} from '../types/models';

// Re-export types for components
export type {
  Appointment, AppointmentService, AppointmentStatus,
  BoardCard, BoardColumn, Customer, DashboardStats, DrawerPayload,
  Message, MessageChannel, MessageStatus, Vehicle
} from '../types/models';
export type { Technician } from '../types/models';
export type { TemplateAnalyticsResponse } from '../types/analytics';

export async function getServiceOperations(): Promise<ServiceOperation[]> {
  // Handle new envelope format: { ok: true, data: ServiceOperation[], ... }
  const { data } = await http.get<{ ok: boolean; data: ServiceOperation[]; } | ServiceOperation[] | { service_operations: ServiceOperation[] }>(
    '/admin/service-operations'
  );

  // Check for envelope format first
  if (typeof data === 'object' && data !== null && 'data' in data && Array.isArray(data.data)) {
    return data.data;
  }

  // Check for flat array
  if (Array.isArray(data)) return data;

  // Fallback to legacy wrapper (remove after legacy wrapper fully deprecated)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maybe = (data as any)?.service_operations;
  return Array.isArray(maybe) ? maybe : [];
}

// Service Management API Functions
export async function createServiceOperation(service: ServiceOperationInput): Promise<ServiceOperation> {
  const { data } = await http.post<ServiceOperation>('/admin/service-operations', service);
  return data;
}

export async function updateServiceOperation(id: string, service: Partial<ServiceOperationInput>): Promise<ServiceOperation> {
  const { data } = await http.patch<ServiceOperation>(`/admin/service-operations/${id}`, service);
  return data;
}

export async function deleteServiceOperation(id: string): Promise<{ message: string; id: string }> {
  const { data } = await http.delete<{ message: string; id: string }>(`/admin/service-operations/${id}`);
  return data;
}

export async function searchServiceOperations(params: {
  q?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  limit?: number;
  category?: string;
}): Promise<ServiceOperation[]> {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set('q', params.q);
  if (params.sort) searchParams.set('sort', params.sort);
  if (params.dir) searchParams.set('dir', params.dir);
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.category) searchParams.set('category', params.category);

  const { data } = await http.get<{ ok: boolean; data: ServiceOperation[]; } | ServiceOperation[] | { service_operations: ServiceOperation[] }>(`/admin/service-operations?${searchParams}`);

  // Check for envelope format first
  if (typeof data === 'object' && data !== null && 'data' in data && Array.isArray(data.data)) {
    return data.data;
  }

  // Check for flat array
  if (Array.isArray(data)) return data;

  // Fallback to legacy wrapper
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maybe = (data as any)?.service_operations;
  return Array.isArray(maybe) ? maybe : [];
}

export async function getTechnicians(): Promise<Technician[]> {
  const { data } = await http.get<{ technicians: Technician[] }>(
    '/admin/technicians'
  );
  return data.technicians;
}

export const toStatus = (s: string): AppointmentStatus =>
  (s || '').toUpperCase().replace('-', '_').replace('NO_SHOW', 'NO_SHOW') as AppointmentStatus;

// Use a relative base to leverage Vite's dev proxy and avoid CORS in development.
// In production, the frontend is typically served behind the same origin as the API gateway.
// In Docker/CI environment, connect directly to backend service

// Safe environment detection that works in both Node and Browser
const getApiUrl = (): string => {
  // Use environment variables with fallback hierarchy
  const baseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';

  // Ensure /api suffix for consistent API routing
  const apiUrl = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;

  return apiUrl;
}

const API_BASE_URL = getApiUrl()

console.log('[API CONFIG] Using URL:', API_BASE_URL)

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  // Enable cookie-based auth with CSRF protection
  withCredentials: true, // Enable for cookie-based authentication
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-CSRF-Token',
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor to add tenant headers for cookie-based auth
http.interceptors.request.use(
  (config) => {
    // Cookie-based auth: tokens are automatically included via httpOnly cookies
    // No need to manually add Authorization header

    // For development and E2E testing, try Bearer token fallback if no cookies available
    const token = localStorage.getItem('auth_token');
    if (token && import.meta.env.DEV) {
      config.headers['Authorization'] = `Bearer ${token}`;
      console.log('[api-interceptor] Using fallback Bearer token for development/E2E'); // eslint-disable-line no-console
    }

    // Add tenant ID header - use E2E tenant if available, otherwise fallback
    const tenantId = (typeof window !== 'undefined' && (window as any).E2E_TENANT_ID)
      || localStorage.getItem('tenant_id')
      || '00000000-0000-0000-0000-000000000001';
    config.headers['X-Tenant-Id'] = tenantId;

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

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

    // Check for nested error object with message field (backend format)
    if (d && typeof d === 'object' && 'error' in d && typeof (d as any).error === 'object') {
      const errorObj = (d as { error: { message?: string; code?: string } }).error;
      const errorMessage = errorObj.message || errorObj.code || 'Request failed';
      return Promise.reject(new Error(errorMessage));
    }

    // Check for JSON error response with both error and message fields at top level
    if (d && typeof d === 'object' && 'error' in d && 'message' in d) {
      const errorData = d as { error?: string; message?: string };
      // Use the more detailed message field if available, fallback to error field
      const errorMessage = errorData.message || errorData.error || 'Request failed';
      return Promise.reject(new Error(errorMessage));
    }

    // Fallback for other error formats
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
    const response = await http.get<{ ok: boolean; data: { columns: BoardColumn[]; cards: BoardCard[] }; error?: any }>('/admin/appointments/board', { params });
    console.log('🔧 api.getBoard: HTTP response received:', {
      status: response.status,
      statusText: response.statusText,
      dataKeys: Object.keys(response.data || {}),
      isWrapped: 'data' in response.data,
      nestedDataKeys: response.data.data ? Object.keys(response.data.data) : null,
      columnsLength: response.data.data?.columns?.length,
      cardsLength: response.data.data?.cards?.length
    });

    // Extract the nested data from the envelope format
    const boardData = response.data.data || { columns: [], cards: [] };
    console.log('🔧 api.getBoard: Extracted board data:', {
      columnsCount: boardData.columns?.length || 0,
      cardsCount: boardData.cards?.length || 0
    });
    return boardData;
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
): Promise<{ appointment: Appointment; id: string }> {
  // Accept both direct and envelope forms from backend
  const resp = await http.post(
    '/admin/appointments',
    appointmentData
  );
  const payload = resp.data as unknown;
  if (payload && typeof payload === 'object') {
    // Direct form: { appointment, id }
    if ('appointment' in (payload as Record<string, unknown>)) {
      const p = payload as { appointment: Appointment; id: string };
      return { appointment: p.appointment, id: p.id };
    }
    // Envelope form: { data: { appointment, id }, meta? }
    const maybe = (payload as { data?: { appointment?: Appointment; id?: string } }).data;
    if (maybe && maybe.appointment) {
      return { appointment: maybe.appointment, id: maybe.id || '' };
    }
  }
  throw new Error('Unexpected appointment response shape');
}

// ---------------------------------------------------------------------------
// Rich single appointment fetch (edit workflow)
// Backend (get_appointment) returns a denormalized structure at root level.
// We accept both direct object and envelope forms for resilience during rollout.
// ---------------------------------------------------------------------------
export interface RichAppointmentServiceOperationMeta {
  id: string;
  name: string;
  default_hours?: number | null;
  default_price?: number | null;
  category?: string | null;
}
export interface RichAppointmentService extends AppointmentService {
  // The backend enriches each service with `operation` metadata when linked
  operation?: RichAppointmentServiceOperationMeta | null;
}
export interface RichAppointmentCustomerVehicle {
  id: string;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  vin?: string | null;
  license_plate?: string | null;
}
export interface RichAppointmentCustomer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  vehicles?: RichAppointmentCustomerVehicle[]; // added for edit flow vehicle selection
}
export interface RichAppointmentMeta { version?: number; [k: string]: unknown }
export interface RichAppointmentResponse {
  appointment: Appointment & { created_at?: string | null; updated_at?: string | null };
  customer: RichAppointmentCustomer | null;
  vehicle: RichAppointmentCustomerVehicle | null;
  services: RichAppointmentService[];
  service_operation_ids?: string[]; // convenience duplication from backend
  meta?: RichAppointmentMeta;
}

export async function getAppointment(id: string): Promise<RichAppointmentResponse> {
  // Primary endpoint: /api/admin/appointments/:id (admin namespace)
  // Fallbacks: /api/appointments/:id (legacy drawer) if needed.
  const paths = [`/admin/appointments/${id}`, `/appointments/${id}`];
  let lastErr: unknown;
  for (const p of paths) {
    try {
      const resp = await http.get(p);
      const payload = resp.data as unknown;
      if (payload && typeof payload === 'object') {
        // Envelope form
        if ('data' in (payload as Record<string, unknown>)) {
          const inner = (payload as { data?: unknown }).data;
          if (inner && typeof inner === 'object' && 'appointment' in (inner as Record<string, unknown>)) {
            return inner as RichAppointmentResponse;
          }
        }
        // Direct form
        if ('appointment' in (payload as Record<string, unknown>)) {
          return payload as RichAppointmentResponse;
        }
      }
      throw new Error('Unexpected appointment response shape');
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Failed to load appointment');
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
  const resp = await http.get(`/appointments/${id}`);
  const payload = resp.data as unknown;
  // Accept both envelope and direct DrawerPayload forms
  if (payload && typeof payload === 'object') {
    // Envelope: { data: { appointment, customer, vehicle, services } }
    if ('data' in (payload as Record<string, unknown>)) {
      const inner = (payload as { data?: unknown }).data;
      if (inner && typeof inner === 'object' && 'appointment' in (inner as Record<string, unknown>)) {
        return inner as DrawerPayload;
      }
    }
    // Direct: { appointment, customer, vehicle, services }
    if ('appointment' in (payload as Record<string, unknown>)) {
      return payload as DrawerPayload;
    }
  }
  throw new Error('Unexpected drawer response shape');
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
  try {
    const resp = await http.post<{ id: string }>(
      `/appointments/${appointmentId}/services`,
      service
    );

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

// ----------------------------------------------------------------------------
// Analytics - Template Usage
// ----------------------------------------------------------------------------
export async function fetchTemplateAnalytics(params: FetchTemplateAnalyticsParams = {}): Promise<TemplateAnalyticsResponse> {
  const { data } = await http.get<TemplateAnalyticsResponse>('/admin/analytics/templates', { params });
  return data;
}
// Deprecated: use typed patchAppointment above
// export async function patchAppointment(id: string, body: Partial<Appointment>) {
//   const { data } = await http.patch<Appointment>(`/appointments/${id}`, body);
//   return data;
// }

export async function updateAppointment(id: string, body: Partial<Appointment>): Promise<{ appointment: Appointment }> {
  const resp = await http.patch(`/appointments/${id}`, body);
  const payload = resp.data as unknown;
  if (payload && typeof payload === 'object') {
    if ('appointment' in (payload as Record<string, unknown>)) {
      const p = payload as { appointment: Appointment };
      return { appointment: p.appointment };
    }
    const maybe = (payload as { data?: { appointment?: Appointment } }).data;
    if (maybe && maybe.appointment) {
      return { appointment: maybe.appointment };
    }
  }
  throw new Error('Unexpected appointment update response');
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

// Extended send with template metadata (Phase 5 Increment 3)
export interface CreateAppointmentMessageWithTemplateRequest {
  channel: MessageChannel;
  body: string;
  template_id?: string | null;
  variables_used?: string[];
}
export interface CreateAppointmentMessageWithTemplateResponse {
  id: string;
  status: MessageStatus; // initial status from backend
}

export async function createAppointmentMessageWithTemplate(
  appointmentId: string,
  payload: CreateAppointmentMessageWithTemplateRequest
): Promise<CreateAppointmentMessageWithTemplateResponse> {
  const { data } = await http.post<CreateAppointmentMessageWithTemplateResponse>(
    `/appointments/${appointmentId}/messages`,
    payload
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

// Customer Update Types
export interface CustomerUpdatePayload {
  name?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  notes?: string;
  sms_consent?: boolean;
  preferred_contact_method?: 'phone' | 'email' | 'sms';
  preferred_contact_time?: string;
}

export interface CustomerUpdateResponse {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address?: string;  // deprecated but kept for compatibility
  tags: string[];
  notes: string | null;
  sms_consent: boolean;
  preferred_contact_method: string;
  preferred_contact_time: string | null;
}

export async function getCustomerHistory(customerId: string): Promise<CustomerHistoryResponse> {
  // Leading slash ensures correct join with baseURL '/api' -> '/api/customers/...'
  const url = `/customers/${customerId}/history`;
  if (import.meta.env.DEV) {
    console.log('[history] GET start', { customerId, url });
  }
  try {
  const resp = await http.get<CustomerHistoryResponse>(url);
    if (import.meta.env.DEV) {
      const appts = resp.data?.data?.pastAppointments;
      console.log('[history] GET ok', {
        status: resp.status,
        count: Array.isArray(appts) ? appts.length : undefined,
        keys: resp.data ? Object.keys(resp.data) : null
      });
    }
    return resp.data;
  } catch (err) {
    if (import.meta.env.DEV) {
      const e = err as unknown as { response?: { status?: number; data?: unknown } };
      console.log('[history] GET fail', {
        message: (err as Error)?.message,
        status: e.response?.status,
        data: e.response?.data
      });
    }
    throw err;
  }
}

// Customer Update API
export async function updateCustomer(customerId: string, updates: CustomerUpdatePayload, currentETag?: string): Promise<CustomerUpdateResponse> {
  const url = `/admin/customers/${customerId}`;

  // Prepare headers with ETag if provided
  const headers: Record<string, string> = {};
  if (currentETag) {
    headers['If-Match'] = currentETag;
  }

  if (import.meta.env.DEV) {
    console.log('[customer] PATCH start', { customerId, updates, etag: currentETag });
  }

  try {
    const response = await http.patch<CustomerUpdateResponse>(url, updates, { headers });

    if (import.meta.env.DEV) {
      console.log('[customer] PATCH ok', {
        status: response.status,
        updatedFields: Object.keys(updates),
        newETag: response.headers?.etag
      });
    }

    return response.data;
  } catch (err) {
    if (import.meta.env.DEV) {
      const e = err as unknown as { response?: { status?: number; data?: unknown } };
      console.log('[customer] PATCH fail', {
        message: (err as Error)?.message,
        status: e.response?.status,
        data: e.response?.data
      });
    }
    throw err;
  }
}

export async function checkConflict(slot: { date: string; time: string }): Promise<{ conflict: boolean; conflictingAppointment?: { id: string; customerName: string; serviceType: string; appointmentDate: string; appointmentTime: string } }> {
  try {
    // Create a proper datetime from date and time
    const datetime = new Date(`${slot.date}T${slot.time}`);
    if (isNaN(datetime.getTime())) {
      console.warn('Invalid date/time provided to checkConflict:', slot);
      return { conflict: false };
    }

    // For now, return no conflict since the backend handles conflict detection
    // during actual appointment creation. This prevents false positives from mock data.
    // Real conflict detection happens server-side in the create/update endpoints.
    return { conflict: false };

    // TODO: Implement real-time conflict checking API endpoint if needed:
    // const response = await api('/api/appointments/check-conflicts', {
    //   method: 'POST',
    //   body: JSON.stringify({
    //     start_ts: datetime.toISOString(),
    //     // Add tech_id, vehicle_id etc. when available
    //   })
    // });
    // return response.data;

  } catch (error) {
    console.error('Error checking conflict:', error);
    return { conflict: false };
  }
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
  const payload = response.data as { token?: string; user?: unknown };
  // Cookie-based auth flow: cookies are set by the server; no localStorage usage.
  return payload;
}

export async function deleteAppointment(id: string): Promise<void> {
  await http.delete(`/admin/appointments/${id}`);
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

// Logout: clear session cookies on the server
export async function logout(): Promise<void> {
  await http.post('/logout', {});
}

// ----------------------------------------------------------------------------
// Message Templates (Increment 4 dynamic CRUD)
// ----------------------------------------------------------------------------
export interface MessageTemplateRecord {
  id: string; // UUID
  slug: string; // stable identifier
  label: string;
  channel: MessageChannel; // 'sms' | 'email'
  category?: string | null;
  body: string;
  variables: string[];
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}
export interface SuggestedMessageTemplate extends MessageTemplateRecord {
  relevance?: number;
  reason?: string;
}
export interface MessageTemplateListResponse {
  message_templates: MessageTemplateRecord[];
  suggested?: SuggestedMessageTemplate[]; // present only when appointment_status supplied
}

// Fetch list (active by default)
export async function fetchMessageTemplates(params: { channel?: MessageChannel; category?: string; q?: string; includeInactive?: boolean; appointment_status?: string } = {}): Promise<MessageTemplateListResponse> {
  const resp = await http.get<Envelope<MessageTemplateListResponse> | MessageTemplateListResponse>('/admin/message-templates', { params });
  const payload = resp.data as unknown;
  // Envelope form
  if (payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
    const data = (payload as { data?: MessageTemplateListResponse }).data;
    if (data && Array.isArray(data.message_templates)) return data as MessageTemplateListResponse;
  }
  // Direct form
  if (payload && typeof payload === 'object' && 'message_templates' in (payload as Record<string, unknown>)) {
    const direct = payload as MessageTemplateListResponse;
    if (Array.isArray(direct.message_templates)) return direct;
  }
  return { message_templates: [] };
}

export async function fetchMessageTemplate(idOrSlug: string): Promise<MessageTemplateRecord | null> {
  try {
    const resp = await http.get<Envelope<MessageTemplateRecord> | MessageTemplateRecord>(`/admin/message-templates/${idOrSlug}`);
    const payload = resp.data as unknown;
    if (typeof payload === 'object' && payload !== null) {
      if ('data' in (payload as Record<string, unknown>)) {
        const inner = (payload as { data?: MessageTemplateRecord }).data;
        if (inner && typeof inner === 'object' && 'id' in inner) return inner;
      }
      if ('id' in (payload as Record<string, unknown>)) return payload as MessageTemplateRecord;
    }
    return null;
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[templates] fetchMessageTemplate failed', err);
    return null;
  }
}

export interface CreateMessageTemplateInput {
  slug: string;
  label: string;
  channel: MessageChannel;
  category?: string | null;
  body: string;
}
export async function createMessageTemplate(payload: CreateMessageTemplateInput): Promise<MessageTemplateRecord> {
  const resp = await http.post<Envelope<MessageTemplateRecord> | MessageTemplateRecord>('/admin/message-templates', payload);
  const out = resp.data as unknown;
  if (typeof out === 'object' && out !== null) {
    if ('data' in (out as Record<string, unknown>)) {
      const inner = (out as { data?: MessageTemplateRecord }).data;
      if (inner && typeof inner === 'object' && 'id' in inner) return inner;
    }
    if ('id' in (out as Record<string, unknown>)) return out as MessageTemplateRecord;
  }
  throw new Error('Unexpected createMessageTemplate response shape');
}

export interface UpdateMessageTemplateInput {
  label?: string;
  channel?: MessageChannel;
  category?: string | null;
  body?: string;
  is_active?: boolean;
}
export async function updateMessageTemplate(idOrSlug: string, payload: UpdateMessageTemplateInput): Promise<MessageTemplateRecord> {
  const resp = await http.patch<Envelope<MessageTemplateRecord> | MessageTemplateRecord>(`/admin/message-templates/${idOrSlug}`, payload);
  const out = resp.data as unknown;
  if (typeof out === 'object' && out !== null) {
    if ('data' in (out as Record<string, unknown>)) {
      const inner = (out as { data?: MessageTemplateRecord }).data;
      if (inner && typeof inner === 'object' && 'id' in inner) return inner;
    }
    if ('id' in (out as Record<string, unknown>)) return out as MessageTemplateRecord;
  }
  throw new Error('Unexpected updateMessageTemplate response shape');
}

export async function deleteMessageTemplate(idOrSlug: string, opts: { soft?: boolean } = {}): Promise<{ deleted: boolean; soft: boolean }> {
  const params = opts.soft === false ? { soft: 'false' } : undefined;
  const resp = await http.delete<Envelope<{ deleted: boolean; soft: boolean }> | { deleted: boolean; soft: boolean }>(`/admin/message-templates/${idOrSlug}`, { params });
  const out = resp.data as unknown;
  if (typeof out === 'object' && out !== null) {
    if ('data' in (out as Record<string, unknown>)) {
      const inner = (out as { data?: { deleted: boolean; soft: boolean } }).data;
      if (inner && typeof inner === 'object' && 'deleted' in inner) return inner;
    }
    if ('deleted' in (out as Record<string, unknown>) && 'soft' in (out as Record<string, unknown>)) {
      return out as { deleted: boolean; soft: boolean };
    }
  }
  throw new Error('Unexpected deleteMessageTemplate response shape');
}

// ----------------------------------------------------------------------------
// Template Usage Telemetry (Increment 5)
// ----------------------------------------------------------------------------
export interface TemplateUsageEventRecord {
  id: string;
  template_id: string;
  template_slug: string;
  channel: MessageChannel;
  appointment_id?: number | null;
  user_id?: string | null;
  sent_at?: string | null;
  delivery_ms?: number | null;
  was_automated: boolean;
  hash?: string | null;
  idempotent?: boolean;
}
export interface LogTemplateUsageInput {
  template_id?: string; // uuid or slug
  template_slug?: string; // slug (optional if template_id provided)
  channel?: MessageChannel; // optional, resolved server-side if omitted
  appointment_id?: number;
  delivery_ms?: number;
  was_automated?: boolean;
  idempotency_key?: string;
  user_id?: string; // override (rare)
}
export async function logTemplateUsage(payload: LogTemplateUsageInput): Promise<TemplateUsageEventRecord | null> {
  try {
    const resp = await http.post<Envelope<{ template_usage_event: TemplateUsageEventRecord }> | { template_usage_event: TemplateUsageEventRecord }>(
      '/admin/template-usage',
      payload
    );
    const raw = resp.data;
    if (raw && typeof raw === 'object') {
      const env = raw as Envelope<{ template_usage_event: TemplateUsageEventRecord }>;
      if ('data' in env && env.data && typeof env.data === 'object' && 'template_usage_event' in env.data) {
        return env.data.template_usage_event;
      }
      const direct = raw as { template_usage_event?: TemplateUsageEventRecord };
      if (direct.template_usage_event) return direct.template_usage_event;
    }
    return null;
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[telemetry] logTemplateUsage failed', e);
    return null; // swallow errors, telemetry is best-effort
  }
}

// Resilient loader with static fallback (uses existing import lazily to avoid bundling if not needed)
let cachedTemplates: MessageTemplateRecord[] | null = null;
export async function loadTemplatesWithFallback(): Promise<MessageTemplateRecord[]> {
  if (cachedTemplates) return cachedTemplates;
  try {
    const response = await fetchMessageTemplates();
    if (response.message_templates.length > 0) {
      cachedTemplates = response.message_templates;
      return response.message_templates;
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[templates] primary fetch failed, will fallback', e);
  }
  // Dynamic import to keep tree-shaking; existing static JSON shape maps reasonably to our record.
  try {
    const mod = await import('@/data/messageTemplates.json');
    const rawList = (mod as { default: Array<{ id: string; label: string; channel: MessageChannel; category?: string; body: string }> }).default;
    const transformed: MessageTemplateRecord[] = rawList.map(t => ({
      id: t.id,
      slug: t.id,
      label: t.label,
      channel: t.channel,
      category: t.category,
      body: t.body,
      variables: [],
      is_active: true,
    }));
    cachedTemplates = transformed;
    return transformed;
  } catch (err) {
    if (import.meta.env.DEV) console.error('[templates] fallback load failed', err);
    return [];
  }
}

// Utility to clear cache (used by admin mutations to force refetch)
export function invalidateTemplatesCache() { cachedTemplates = null; }

// ----------------------------------------------------------------------------
// Recent Customers (Customers Page Phase 2)
// ----------------------------------------------------------------------------
export interface RecentCustomerRecord {
  customerId: string;
  name: string;
  phone?: string;
  email?: string;
  latestAppointmentId?: string;
  latestAppointmentAt?: string | null;
  latestStatus?: string | null;
  vehicles: Array<{ vehicleId: string; plate?: string; vehicle?: string }>;
  totalSpent: number;
  isVip?: boolean;
  isOverdueForService?: boolean;
}

interface RawRecentCustomer {
  customerId?: string; customer_id?: string;
  name?: string; customer_name?: string;
  phone?: string; email?: string;
  latestAppointmentId?: string; latest_appointment_id?: string;
  latestAppointmentAt?: string | null; latest_appointment_at?: string | null;
  latestStatus?: string | null; latest_status?: string | null;
  vehicles?: Array<{ vehicleId?: string; vehicle_id?: string; id?: string; plate?: string; vehicle?: string }>;
  totalSpent?: number; total_spent?: number;
  isVip?: boolean; is_vip?: boolean;
  isOverdueForService?: boolean; is_overdue_for_service?: boolean;
}

export async function fetchRecentCustomers(limit = 8): Promise<RecentCustomerRecord[]> {
  try {
    const { data } = await http.get<{ data: { recent_customers: RawRecentCustomer[] } }>(`/admin/recent-customers`, { params: { limit } });
    const list: RawRecentCustomer[] = data?.data?.recent_customers || [];
    return list.map(c => ({
      customerId: c.customerId || c.customer_id || '',
      name: c.name || c.customer_name || 'Unknown',
      phone: c.phone,
      email: c.email,
      latestAppointmentId: c.latestAppointmentId || c.latest_appointment_id,
      latestAppointmentAt: c.latestAppointmentAt || c.latest_appointment_at,
      latestStatus: c.latestStatus || c.latest_status,
      vehicles: Array.isArray(c.vehicles) ? c.vehicles.map(v => ({
        vehicleId: v.vehicleId || v.vehicle_id || v.id || '',
        plate: v.plate,
        vehicle: v.vehicle,
      })) : [],
      totalSpent: typeof c.totalSpent === 'number' ? c.totalSpent : (typeof c.total_spent === 'number' ? c.total_spent : 0),
  isVip: c.isVip ?? c.is_vip ?? false,
  isOverdueForService: c.isOverdueForService ?? c.is_overdue_for_service ?? false,
    }));
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[recent-customers] fetch failed', e);
    return [];
  }
}

// Get all customers for appointment dropdowns
export async function getCustomers(): Promise<Customer[]> {
  try {
    // Use the search endpoint with 'a' to match most customers (names often contain 'a')
    const response = await http.get('/admin/customers/search?q=a&limit=1000');
    console.log('[CUSTOMER_DEBUG] Full response:', response);
    console.log('[CUSTOMER_DEBUG] response.data:', response.data);
    console.log('[CUSTOMER_DEBUG] response.data type:', typeof response.data);

    const { data } = response;
    console.log('[CUSTOMER_DEBUG] Destructured data:', data);
    console.log('[CUSTOMER_DEBUG] Raw API response:', data);
    console.log('[CUSTOMER_DEBUG] Raw API response JSON:', JSON.stringify(data, null, 2));
    console.log('[CUSTOMER_DEBUG] data.data:', data.data);
    console.log('[CUSTOMER_DEBUG] data.data type:', typeof data.data);
    console.log('[CUSTOMER_DEBUG] data.data.items:', data.data?.items);
    console.log('[CUSTOMER_DEBUG] data.items type:', typeof data?.items);
    console.log('[CUSTOMER_DEBUG] data.items value:', data?.items);
    console.log('[CUSTOMER_DEBUG] data.items length:', data?.items?.length);

    // Try both possible paths
    const items = data?.data?.items || data?.items || [];
    console.log('[CUSTOMER_DEBUG] Final items array:', items);

    const customers = items.map((item: unknown) => ({
      id: (item as { customerId?: string })?.customerId?.toString() || '',
      name: (item as { name?: string })?.name || 'Unknown',
      email: (item as { email?: string })?.email || null,
      phone: (item as { phone?: string })?.phone || null
    }));
    console.log('[CUSTOMER_DEBUG] Mapped customers:', customers);
    return customers;
  } catch (error) {
    console.error('Failed to fetch customers:', error);
    return [];
  }
}

// Get all vehicles for appointment dropdowns
export async function getVehicles(): Promise<Vehicle[]> {
  try {
    // Use customer search with 'a' to get vehicles
    const { data } = await http.get('/admin/customers/search?q=a&limit=1000');
    const vehicles: Vehicle[] = [];

    // Fix: Use data.data.items since API returns nested structure
    const items = data?.data?.items || data?.items || [];
    if (items) {
      for (const item of items) {
        // Only include items that have vehicle information
        if (item.vehicleId && item.plate) {
          vehicles.push({
            id: item.vehicleId?.toString() || '',
            year: null, // Backend doesn't return year/make/model separately in this API
            make: null,
            model: null,
            vin: null,
            license_plate: item.plate || null
          });
        }
      }
    }

    return vehicles;
  } catch (error) {
    console.error('Failed to fetch vehicles:', error);
    return [];
  }
}
