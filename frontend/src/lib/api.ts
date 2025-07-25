// API utilities for Edgar's Mobile Auto Shop
const API_BASE_URL = import.meta.env.VITE_API_ENDPOINT_URL || 'http://localhost:3001';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface Appointment {
  id: string;
  customer: string;
  vehicle: string;
  service: string;
  timeSlot: string;
  dateTime: Date;
  status: 'scheduled' | 'in-progress' | 'completed' | 'canceled';
  phone?: string;
  address?: string;
  estimatedDuration?: string;
  reminderStatus?: 'sent' | 'failed' | 'pending';
}

export interface DashboardStats {
  todayAppointments: number;
  pendingAppointments: number;
  completedToday: number;
  totalCustomers: number;
  partsOrdered: number;
  todayRevenue: number;
}

export interface CarOnPremises {
  id: string;
  make: string;
  model: string;
  owner: string;
  arrivalTime: string;
  status: string;
  pickupTime: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`⏰ Request timeout for ${endpoint}`);
      controller.abort();
    }, 8000); // 8 second timeout
    
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
        ...options,
      });

      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('API request failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Appointment API methods
  async getAppointments(date?: string): Promise<ApiResponse<Appointment[]>> {
    const params = date ? `?date=${date}` : '';
    return this.request<Appointment[]>(`/api/appointments${params}`);
  }

  async getTodaysAppointments(): Promise<ApiResponse<Appointment[]>> {
    return this.request<Appointment[]>(`/api/admin/appointments/today`);
  }

  async updateAppointmentStatus(
    appointmentId: string, 
    status: Appointment['status']
  ): Promise<ApiResponse<Appointment>> {
    return this.request<Appointment>(`/api/appointments/${appointmentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async createAppointment(appointment: Partial<Appointment>): Promise<ApiResponse<Appointment>> {
    return this.request<Appointment>('/api/appointments', {
      method: 'POST',
      body: JSON.stringify(appointment),
    });
  }

  // Dashboard API methods
  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    return this.request<DashboardStats>('/api/admin/dashboard/stats');
  }

  async getCarsOnPremises(): Promise<ApiResponse<CarOnPremises[]>> {
    return this.request<CarOnPremises[]>('/api/admin/cars-on-premises');
  }

  // Notification API methods
  async getNotificationStats(): Promise<ApiResponse<unknown>> {
    return this.request('/api/admin/notifications/stats');
  }

  async retryNotification(appointmentId: string): Promise<ApiResponse<unknown>> {
    return this.request(`/api/admin/notifications/${appointmentId}/retry`, {
      method: 'POST',
    });
  }
}

export const apiClient = new ApiClient();

// Hook for using API in React components
export function useApi() {
  return apiClient;
}

// Utility functions for handling API responses
export function handleApiError(response: ApiResponse<unknown>, defaultMessage = 'An error occurred') {
  if (!response.success) {
    console.error('API Error:', response.error);
    alert(response.error || defaultMessage);
  }
  return response.success;
}

export function isOnline(): boolean {
  return navigator.onLine;
}

// Mock data for development/offline mode
export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: '1',
    customer: 'John Smith',
    vehicle: '2018 Toyota Camry',
    service: 'Oil Change & Filter',
    timeSlot: '9:00 AM',
    dateTime: new Date(2025, 6, 21, 9, 0),
    status: 'completed',
    phone: '(555) 123-4567',
    address: '123 Main St, Anywhere'
  },
  {
    id: '2',
    customer: 'Maria Rodriguez',
    vehicle: '2020 Honda Civic',
    service: 'Brake Inspection',
    timeSlot: '11:00 AM',
    dateTime: new Date(2025, 6, 21, 11, 0),
    status: 'in-progress',
    phone: '(555) 234-5678',
    address: '456 Oak Ave, Somewhere'
  },
  {
    id: '3',
    customer: 'David Wilson',
    vehicle: '2019 Ford F-150',
    service: 'Battery Replacement',
    timeSlot: '2:00 PM',
    dateTime: new Date(2025, 6, 21, 14, 0),
    status: 'scheduled',
    phone: '(555) 345-6789',
    address: '789 Pine Rd, Elsewhere'
  },
  {
    id: '4',
    customer: 'Sarah Johnson',
    vehicle: '2017 Chevy Malibu',
    service: 'Tire Rotation',
    timeSlot: '4:00 PM',
    dateTime: new Date(2025, 6, 21, 16, 0),
    status: 'scheduled',
    phone: '(555) 456-7890',
    address: '321 Elm St, Anytown'
  }
];

export const MOCK_STATS: DashboardStats = {
  todayAppointments: 4,
  pendingAppointments: 2,
  completedToday: 1,
  totalCustomers: 127,
  partsOrdered: 12,
  todayRevenue: 150
};
