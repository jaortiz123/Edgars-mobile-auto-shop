import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken')
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

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
  getAll: () => api.get('/api/customers'),
  getById: (id: number) => api.get(`/api/customers/${id}`),
  create: (data: Omit<Customer, 'id'>) => api.post('/api/customers', data),
  update: (id: number, data: Partial<Customer>) => api.put(`/api/customers/${id}`, data),
  delete: (id: number) => api.delete(`/api/customers/${id}`),
}

export const appointmentAPI = {
  getAll: () => api.get('/api/appointments'),
  getById: (id: number) => api.get(`/api/appointments/${id}`),
  create: (data: Omit<Appointment, 'id'>) => api.post('/api/appointments', data),
  update: (id: number, data: Partial<Appointment>) => api.put(`/api/appointments/${id}`, data),
  delete: (id: number) => api.delete(`/api/appointments/${id}`),
  getAvailableSlots: (date: string) => api.get(`/api/appointments/available-slots?date=${date}`),
}

export const serviceAPI = {
  getAll: () => api.get('/api/services'),
  getById: (id: number) => api.get(`/api/services/${id}`),
}

export const authAPI = {
  login: (credentials: { username: string; password: string }) => api.post('/api/admin/login', credentials),
  logout: () => api.post('/api/admin/logout'),
  getProfile: () => api.get('/api/admin/profile'),
}

export default api
