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
