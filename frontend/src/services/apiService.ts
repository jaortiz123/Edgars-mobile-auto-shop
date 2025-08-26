// Centralized API service built on top of the shared axios client in lib/api.
import { http } from '@/lib/api';

// --- Reusable Type Definition ---
// Defines the shape of the data payload for creating an appointment.
// This can be exported and used by UI components to ensure type safety.
export interface AppointmentPayload {
  customer_id: string;
  service: string;
  requested_time: string; // ISO 8601 format string (e.g., "2024-09-01T13:00:00Z")
  customer_phone?: string;
  customer_email?: string;
  location_address?: string;
  notes?: string;
  sms_consent?: boolean;
  sms_consent_ip?: string;
  // Vehicle linkage (optional)
  license_plate?: string;
  vehicle_year?: string;
  vehicle_make?: string;
  vehicle_model?: string;
}

// Define a minimal type for admin appointment (expand as needed)
export interface AdminAppointment {
  id: string;
  customer_id: string;
  service_id: string;
  // Backend returns ISO timestamps as start_ts/end_ts
  start_ts?: string;
  end_ts?: string;
  location_address: string;
  status: string;
  notes?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  // Convenience label composed in backend
  vehicle_label?: string;
}

/**
 * Sends a request to the backend to create a new appointment.
 * @param appointmentData The data for the new appointment.
 * @returns The JSON response from the server.
 * @throws An error with a user-friendly message if the request fails.
 */
export async function createAppointment(appointmentData: AppointmentPayload): Promise<unknown> {
  // Map to backend payload expected by Flask local_server (/api/admin/appointments)
  // Backend currently accepts: status, start (ISO8601), total_amount, paid_amount
  const backendPayload = {
    status: 'SCHEDULED',
    start: appointmentData.requested_time,
    total_amount: 0,
    paid_amount: 0,
    // Pass-through extra metadata (ignored by backend today, future-proofing)
    ...appointmentData,
  };

  const { data } = await http.post('/admin/appointments', backendPayload);
  return data;
}

/**
 * Fetches the list of appointments from the backend.
 * @returns An array of appointments.
 * @throws An error with a user-friendly message if the request fails.
 */
// REMOVED: getAppointments() hitting legacy /api/appointments endpoint (404 in new backend).
// If needed for archived tests, prefer getAdminAppointments() or add a compatibility shim there.
// export async function getAppointments(): Promise<AdminAppointment[]> { ... }

/**
 * Fetches admin appointments from the proper admin endpoint.
 * @returns The admin appointments response with proper structure.
 */
export async function getAdminAppointments(): Promise<{ appointments: AdminAppointment[] }> {
  const { data } = await http.get('/admin/appointments');
  return { appointments: data?.data?.appointments || data?.appointments || [] };
}

/**
 * Fetches today's appointments for admin dashboard.
 * @returns An array of today's appointments.
 */
export async function getAdminAppointmentsToday(): Promise<AdminAppointment[]> {
  const { data } = await http.get('/admin/appointments/today');
  return data?.appointments || data?.data?.appointments || [];
}

/**
 * Updates an appointment by ID (admin).
 * @param id Appointment ID
 * @param updateData Fields to update (e.g., { status, notes })
 * @returns The updated appointment or success message.
 */
export async function updateAppointment(id: string, updateData: Partial<AdminAppointment>): Promise<{ message: string }> {
  const { data } = await http.put(`/admin/appointments/${id}`, updateData);
  return data;
}

// ---------------------------------------------------------------------------
// Invoicing API
// ---------------------------------------------------------------------------

export interface InvoiceSummary {
  id: string;
  status: string;
  total_cents: number;
  amount_due_cents: number;
  amount_paid_cents: number;
  subtotal_cents: number;
  tax_cents: number;
  created_at?: string;
  issued_at?: string;
  updated_at?: string;
  customer_id?: number;
  customer_name?: string;
}

export interface InvoiceListResponse {
  items: InvoiceSummary[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

// Response shape for generating an invoice from an appointment
export interface GenerateInvoiceResponse {
  invoice: InvoiceSummary; // backend returns newly created invoice summary
}

/** Fetch paginated invoices. Defaults to page 1 size 20. */
export async function fetchInvoices(params: { page?: number; pageSize?: number; status?: string; customerId?: string } = {}): Promise<InvoiceListResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.status) query.set('status', params.status);
  if (params.customerId) query.set('customerId', params.customerId);
  const qs = query.toString();
  const url = `/admin/invoices${qs ? `?${qs}` : ''}`;
  const { data } = await http.get(url);
  return (data?.data || data) as InvoiceListResponse;
}

// Single invoice detail response shape
export interface InvoiceDetailResponse {
  invoice: InvoiceSummary & { notes?: string; appointment_id?: number; currency?: string; voided_at?: string | null; paid_at?: string | null; issued_at?: string | null; };
  line_items: Array<{
    id: string; name: string; quantity: number; unit_price_cents: number; line_subtotal_cents: number; tax_cents: number; total_cents: number; description?: string;
  }>;
  payments: Array<{ id: string; amount_cents?: number; amount?: number; method?: string; created_at?: string; note?: string }>;
}

/** Fetch a single invoice with line items and payments */
export async function fetchInvoice(id: string): Promise<InvoiceDetailResponse> {
  const { data } = await http.get(`/admin/invoices/${id}`);
  return (data?.data || data) as InvoiceDetailResponse;
}

// Record payment payload and response types
export interface RecordPaymentPayload { amountCents: number; method: string; receivedDate?: string; note?: string }
export interface RecordPaymentResponse { invoice: InvoiceSummary; payment: { id: string; amount_cents: number; method: string; created_at?: string; note?: string } }

/** Record a payment for an invoice */
export async function recordInvoicePayment(invoiceId: string, payload: RecordPaymentPayload): Promise<RecordPaymentResponse> {
  const body = {
    amountCents: payload.amountCents,
    method: payload.method,
    receivedAt: payload.receivedDate,
    note: payload.note,
  };
  const { data } = await http.post(`/admin/invoices/${invoiceId}/payments`, body);
  return (data?.data || data) as RecordPaymentResponse;
}

// Void invoice response type (reuse InvoiceSummary shape)
export interface VoidInvoiceResponse { invoice: InvoiceSummary }

/** Void an invoice */
export async function voidInvoice(invoiceId: string): Promise<VoidInvoiceResponse> {
  const { data } = await http.post(`/admin/invoices/${invoiceId}/void`);
  return (data?.data || data) as VoidInvoiceResponse;
}

/** Generate an invoice for a COMPLETED appointment (idempotent server-side) */
export async function generateInvoice(appointmentId: string): Promise<GenerateInvoiceResponse> {
  const { data } = await http.post(`/admin/appointments/${appointmentId}/invoice`);
  return (data?.data || data) as GenerateInvoiceResponse;
}
