import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_PUBLIC_API_URL || 'http://localhost:3001'

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

async function getWithRetry(url: string, retries = 3, delayMs = 300) {
  for (let i = 0; i < retries; i++) {
    try {
      return await api.get(url)
    } catch (err) {
      if (i === retries - 1) throw err
      const wait = delayMs * 2 ** i
      await new Promise((res) => setTimeout(res, wait))
    }
  }
}

export interface Service {
  id: number
  name: string
  description?: string
  duration_minutes?: number
  base_price?: number
}

export interface Customer {
  id: number
  name: string
  phone?: string
  email?: string
  address?: string
}

export interface Appointment {
  id: number
  customer_id: number
  vehicle_id: number | null
  service_id: number
  scheduled_date: string
  scheduled_time: string
  location_address: string
  notes?: string
}

export const customerAPI = {
  getAll: () => getWithRetry('/api/customers'),
  getById: (id: number) => getWithRetry(`/api/customers/${id}`),
  create: (data: Omit<Customer, 'id'>) => api.post('/api/customers', data),
  update: (id: number, data: Partial<Customer>) => api.put(`/api/customers/${id}`, data),
  delete: (id: number) => api.delete(`/api/customers/${id}`),
}

export const appointmentAPI = {
  getAll: () => getWithRetry('/api/appointments'),
  getById: (id: number) => getWithRetry(`/api/appointments/${id}`),
  create: (data: Omit<Appointment, 'id'>) => api.post('/api/appointments', data),
  update: (id: number, data: Partial<Appointment>) => api.put(`/api/appointments/${id}`, data),
  delete: (id: number) => api.delete(`/api/appointments/${id}`),
  getAvailableSlots: (date: string) => getWithRetry(`/api/appointments/available-slots?date=${date}`),
}

export const serviceAPI = {
  getAll: () => getWithRetry('/api/services'),
  getById: (id: number) => getWithRetry(`/api/services/${id}`),
}

export const authAPI = {
  login: (credentials: { username: string; password: string }) => api.post('/admin/login', credentials),
  logout: () => api.post('/admin/logout'),
  getProfile: () => getWithRetry('/admin/me'),
}

export default api
