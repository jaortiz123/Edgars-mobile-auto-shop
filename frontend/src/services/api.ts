import axios from 'axios';

// This baseURL is correct.
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- HELPER FUNCTIONS (UNCHANGED) ---
async function getWithRetry(url: string, retries = 3, delayMs = 300) {
  for (let i = 0; i < retries; i++) {
    try {
      return await api.get(url);
    } catch (err) {
      if (i === retries - 1) throw err;
      const wait = delayMs * 2 ** i;
      await new Promise((res) => setTimeout(res, wait));
    }
  }
}

async function postWithRetry(
  url: string,
  data: unknown,
  retries = 3,
  delayMs = 300
) {
  for (let i = 0; i < retries; i++) {
    try {
      return await api.post(url, data);
    } catch (err) {
      if (i === retries - 1) throw err;
      const wait = delayMs * 2 ** i;
      await new Promise((res) => setTimeout(res, wait));
    }
  }
}

// --- INTERFACES (UNCHANGED) ---
export interface Service {
  id: number;
  name: string;
  description?: string;
  duration_minutes?: number;
  duration?: string;
  base_price?: number;
  category?: string;
  popular?: boolean;
  includes?: string[];
}

export interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface Appointment {
  id: number;
  customer_id: number;
  vehicle_id: number | null;
  service_id: number;
  scheduled_date: string;
  scheduled_time: string;
  location_address: string;
  notes?: string;
}

// --- API DEFINITIONS (CORRECTED) ---

export const customerAPI = {
  // CORRECTED: Paths are now relative to the baseURL
  getAll: () => getWithRetry('/customers'),
  getById: (id: number) => getWithRetry(`/customers/${id}`),
  create: (data: Omit<Customer, 'id'>) => postWithRetry('/customers', data),
  update: (id: number, data: Partial<Customer>) => api.put(`/customers/${id}`, data),
  delete: (id: number) => api.delete(`/customers/${id}`),
};

export const appointmentAPI = {
  getAll: () => getWithRetry('/appointments'),
  getById: (id: number) => getWithRetry(`/appointments/${id}`),
  create: (data: Omit<Appointment, 'id'>) => postWithRetry('/appointments', data),
  update: (id: number, data: Partial<Appointment>) => api.put(`/appointments/${id}`, data),
  delete: (id: number) => api.delete(`/appointments/${id}`),
  getAvailableSlots: (date: string) => getWithRetry(`/appointments/available-slots?date=${date}`),
};

export const serviceAPI = {
  getAll: () => getWithRetry('/services'),
  getById: (id: number) => getWithRetry(`/services/${id}`),
};

export const authAPI = {
  // NOTE: These do not start with '/api', so they will NOT be proxied.
  // This is correct if your backend serves them from the root.
  login: (credentials: { username: string; password: string }) => api.post('/admin/login', credentials),
  logout: () => api.post('/admin/logout'),
  getProfile: () => getWithRetry('/admin/me'),
};

export default api;