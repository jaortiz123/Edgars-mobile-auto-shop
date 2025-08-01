// Centralized API service for backend communication

// --- Environment Variable Guard Clause ---
// Ensures the application fails fast with a clear error during development
// if the API endpoint URL is not configured.
const API_BASE_URL = import.meta.env.VITE_API_ENDPOINT_URL;
if (!API_BASE_URL) {
  throw new Error("CRITICAL ERROR: VITE_API_ENDPOINT_URL is not defined in the environment. Please check your .env.local file.");
}

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
}

// Define a minimal type for admin appointment (expand as needed)
export interface AdminAppointment {
  id: string;
  customer_id: string;
  service_id: string;
  scheduled_at?: string;
  scheduled_time?: string;
  location_address: string;
  status: string;
  notes?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
}

/**
 * Sends a request to the backend to create a new appointment.
 * @param appointmentData The data for the new appointment.
 * @returns The JSON response from the server.
 * @throws An error with a user-friendly message if the request fails.
 */
export async function createAppointment(appointmentData: AppointmentPayload): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}/api/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(appointmentData),
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
export async function getAppointments(): Promise<AdminAppointment[]> {
  const response = await fetch(`${API_BASE_URL}/api/appointments`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    let errorMessage = 'Failed to fetch appointments.';
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
