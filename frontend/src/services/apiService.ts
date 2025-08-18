// Centralized API service for backend communication

// --- Environment Variable Guard Clause ---
// Ensures the application fails fast with a clear error during development
// if the API endpoint URL is not configured.
// Prefer explicit endpoint when provided; otherwise rely on Vite dev proxy by using relative '/api'
const API_BASE_URL: string = import.meta.env.VITE_API_ENDPOINT_URL || '';

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

  const response = await fetch(`${API_BASE_URL}/api/admin/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(backendPayload),
  });

  // --- Hardened Error Handling ---
  // If the response is not successful, attempt to parse the error as JSON first.
  if (!response.ok) {
    let errorMessage = 'Failed to create appointment due to an unknown server error.';
    try {
      // Attempt to parse a structured error message from the API.
      const errorBody = await response.json();
      errorMessage = errorBody.error || errorBody.message || JSON.stringify(errorBody);
    } catch {
      // If the body isn't JSON, fall back to the raw text response.
      errorMessage = await response.text();
    }
    throw new Error(errorMessage);
  }

  // If successful, return the parsed JSON response from the server.
  return response.json();
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
  const response = await fetch(`${API_BASE_URL}/api/admin/appointments`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    let errorMessage = 'Failed to fetch admin appointments.';
    try {
      const errorBody = await response.json();
      errorMessage = errorBody.error || errorBody.message || JSON.stringify(errorBody);
    } catch {
      errorMessage = await response.text();
    }
    throw new Error(errorMessage);
  }
  const data = await response.json();
  // Return the data.appointments from the admin endpoint response structure
  return { appointments: data.data?.appointments || [] };
}

/**
 * Fetches today's appointments for admin dashboard.
 * @returns An array of today's appointments.
 */
export async function getAdminAppointmentsToday(): Promise<AdminAppointment[]> {
  const response = await fetch(`${API_BASE_URL}/api/admin/appointments/today`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    let errorMessage = 'Failed to fetch today\'s appointments.';
    try {
      const errorBody = await response.json();
      errorMessage = errorBody.error || errorBody.message || JSON.stringify(errorBody);
    } catch {
      errorMessage = await response.text();
    }
    throw new Error(errorMessage);
  }
  const data = await response.json();
  return data.appointments || [];
}

/**
 * Updates an appointment by ID (admin).
 * @param id Appointment ID
 * @param updateData Fields to update (e.g., { status, notes })
 * @returns The updated appointment or success message.
 */
export async function updateAppointment(id: string, updateData: Partial<AdminAppointment>): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/admin/appointments/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updateData),
  });
  if (!response.ok) {
    let errorMessage = 'Failed to update appointment.';
    try {
      const errorBody = await response.json();
      errorMessage = errorBody.error || errorBody.message || JSON.stringify(errorBody);
    } catch {
      errorMessage = await response.text();
    }
    throw new Error(errorMessage);
  }
  return response.json();
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
  const url = `${API_BASE_URL}/api/admin/invoices${qs ? `?${qs}` : ''}`;
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  if (!response.ok) {
    let errorMessage = 'Failed to fetch invoices.';
    try {
      const errorBody = await response.json();
      errorMessage = errorBody.error || errorBody.message || JSON.stringify(errorBody);
    } catch {
      errorMessage = await response.text();
    }
    throw new Error(errorMessage);
  }
  const data = await response.json();
  return data.data as InvoiceListResponse;
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
  const response = await fetch(`${API_BASE_URL}/api/admin/invoices/${id}`, { headers: { 'Content-Type': 'application/json' } });
  if (!response.ok) {
    let errorMessage = 'Failed to fetch invoice.';
    try {
      const errorBody = await response.json();
      errorMessage = errorBody.error || errorBody.message || JSON.stringify(errorBody);
    } catch {
      errorMessage = await response.text();
    }
    throw new Error(errorMessage);
  }
  const data = await response.json();
  return data.data as InvoiceDetailResponse;
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
  const response = await fetch(`${API_BASE_URL}/api/admin/invoices/${invoiceId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let errorMessage = 'Failed to record payment.';
    try {
      const errorBody = await response.json();
      errorMessage = errorBody.error || errorBody.message || JSON.stringify(errorBody);
    } catch {
      errorMessage = await response.text();
    }
    throw new Error(errorMessage);
  }
  const data = await response.json();
  return data.data as RecordPaymentResponse;
}

// Void invoice response type (reuse InvoiceSummary shape)
export interface VoidInvoiceResponse { invoice: InvoiceSummary }

/** Void an invoice */
export async function voidInvoice(invoiceId: string): Promise<VoidInvoiceResponse> {
  const response = await fetch(`${API_BASE_URL}/api/admin/invoices/${invoiceId}/void`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    let errorMessage = 'Failed to void invoice.';
    try {
      const errorBody = await response.json();
      errorMessage = errorBody.error || errorBody.message || JSON.stringify(errorBody);
    } catch {
      errorMessage = await response.text();
    }
    throw new Error(errorMessage);
  }
  const data = await response.json();
  return data.data as VoidInvoiceResponse;
}

/** Generate an invoice for a COMPLETED appointment (idempotent server-side) */
export async function generateInvoice(appointmentId: string): Promise<GenerateInvoiceResponse> {
  const response = await fetch(`${API_BASE_URL}/api/admin/appointments/${appointmentId}/invoice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    let errorMessage = 'Failed to generate invoice.';
    try {
      const errorBody = await response.json();
      errorMessage = errorBody.error || errorBody.message || JSON.stringify(errorBody);
    } catch {
      errorMessage = await response.text();
    }
    throw new Error(errorMessage);
  }
  const data = await response.json();
  return data.data as GenerateInvoiceResponse;
}

// ---------------------------------------------------------------------------
// Invoice Package Addition
// ---------------------------------------------------------------------------
export interface AddPackageResponse {
  invoice: InvoiceDetailResponse['invoice'];
  added_line_items: InvoiceDetailResponse['line_items'];
  package_id: string;
  package_name: string;
  added_subtotal_cents: number;
}

/** Add a service package to an invoice (expands children into line items) */
export async function addPackageToInvoice(invoiceId: string, packageId: string): Promise<AddPackageResponse> {
  const response = await fetch(`${API_BASE_URL}/api/admin/invoices/${invoiceId}/add-package`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ packageId }),
  });
  if (!response.ok) {
    // Attempt structured error
    try {
      const err = await response.json();
      const detail = err?.errors?.[0]?.detail || err?.errors?.[0]?.code || err?.error || 'Failed to add package';
      throw new Error(detail);
    } catch (e: unknown) {
      if (e instanceof Error) throw e;
      throw new Error('Failed to add package');
    }
  }
  const data = await response.json();
  return data.data as AddPackageResponse;
}
