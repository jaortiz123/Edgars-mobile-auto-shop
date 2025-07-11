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
}

/**
 * Sends a request to the backend to create a new appointment.
 * @param appointmentData The data for the new appointment.
 * @returns The JSON response from the server.
 * @throws An error with a user-friendly message if the request fails.
 */
export async function createAppointment(appointmentData: AppointmentPayload): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/appointments`, {
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
    } catch (e) {
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
export async function getAppointments(): Promise<any[]> {
  const response = await fetch(`${API_BASE_URL}/appointments`, {
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
    } catch (e) {
      errorMessage = await response.text();
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data.appointments || [];
}
