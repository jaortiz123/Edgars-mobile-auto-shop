import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
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

export const getServices = async (): Promise<Service[]> => {
  try {
    const { data } = await api.get('/services')
    return data
  } catch (err) {
    console.error(err)
    throw err
  }
}

export const createCustomer = async (
  customer: Omit<Customer, 'id'>
): Promise<Customer> => {
  try {
    const { data } = await api.post('/customers', customer)
    return data
  } catch (err) {
    console.error(err)
    throw err
  }
}

export const createAppointment = async (
  appointment: Omit<Appointment, 'id'>
): Promise<Appointment> => {
  try {
    const { data } = await api.post('/appointments', appointment)
    return data
  } catch (err) {
    console.error(err)
    throw err
  }
}

export default api
