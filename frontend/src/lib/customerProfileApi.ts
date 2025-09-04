// Customer Profile API client helpers
// Provides typed access to /api/admin/customers/:id endpoint.

import { http } from '@/lib/api';

export interface CustomerProfileAppointmentLite {
  id: string;
  status: string;
  start: string | null;
  end: string | null;
  totalAmount: number;
  paidAmount: number;
  checkInAt: string | null;
  checkOutAt: string | null;
  vehicle?: {
    id?: string | null;
    plate?: string | null;
    year?: number | null;
    make?: string | null;
    model?: string | null;
  };
  // When include=appointmentDetails these will be present:
  services?: unknown[];
  payments?: unknown[];
  messages?: unknown[];
}

export interface CustomerVehicle {
  id: string;
  plate?: string;
  year?: number;
  make?: string;
  model?: string;
  visits?: number;
  totalSpent?: number;
}

export interface CustomerMetrics {
  totalSpent: number;
  unpaidBalance: number;
  visitsCount: number;
  completedCount: number;
  avgTicket: number;
  lastServiceAt: string | null;
  lastVisitAt: string | null;
  last12MonthsSpent: number;
  last12MonthsVisits: number;
  vehiclesCount: number;
  isVip: boolean;
  isOverdueForService: boolean;
}

export interface CustomerProfileResponse {
  customer: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    isVip: boolean;
    createdAt: string | null;
    updatedAt: string | null;
  };
  vehicles: CustomerVehicle[];
  appointments: CustomerProfileAppointmentLite[];
  metrics: CustomerMetrics;
  includes: string[];
}

export async function fetchCustomerProfile(id: string, opts?: { includeDetails?: boolean }): Promise<CustomerProfileResponse> {
  const params = new URLSearchParams();
  if (opts?.includeDetails) params.append('include', 'appointmentDetails');
  const { data } = await http.get(`/admin/customers/${id}${params.toString() ? '?' + params.toString() : ''}`);
  return (data?.data || data) as CustomerProfileResponse;
}

export interface CustomerSearchResult {
  id: string;
  full_name: string;
  phone?: string;
  email?: string;
}

/**
 * Search for customers by name or phone number (for Milestone 3 - Vehicle Transfer)
 */
export async function searchCustomers(query: string): Promise<CustomerSearchResult[]> {
  if (!query.trim() || query.length < 2) {
    return [];
  }

  const params = new URLSearchParams();
  params.append('q', query.trim());
  params.append('limit', '10');

  const { data } = await http.get(`/admin/customers/search?${params.toString()}`);
  return (data?.customers || data || []) as CustomerSearchResult[];
}
