export type AppointmentStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'READY'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'CANCELED';

export interface Appointment {
  id: string;
  status: AppointmentStatus;
  start?: string | null; // ISO
  end?: string | null;   // ISO
  total_amount?: number | null;
  paid_amount?: number | null;
  check_in_at?: string | null;
  check_out_at?: string | null;
  tech_id?: string | null;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}

export interface Vehicle {
  id: string;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  vin?: string | null;
}

export interface AppointmentService {
  id: string;
  appointment_id: string;
  name: string;
  notes?: string | null;
  estimated_hours?: number | null;
  estimated_price?: number | null;
  category?: string | null;
}

export interface BoardColumn {
  key: AppointmentStatus;
  title: string;
  count: number;
  sum: number;
}

export interface BoardCard {
  id: string;
  status: AppointmentStatus;
  position: number;
  start?: string;
  end: string | null;
  customerName: string;
  vehicle: string;
  servicesSummary?: string;
  price?: number;
  tags?: string[];
}

export interface DashboardStats {
  jobsToday: number;
  carsOnPremises: number;
  scheduled: number;
  inProgress: number;
  ready: number;
  completed: number;
  noShow: number;
  unpaidTotal: number;
}

export interface DrawerPayload {
  appointment: Appointment;
  customer: Customer | null;
  vehicle: Vehicle | null;
  services: AppointmentService[];
}

export interface CarOnPremises {
  id: string;
  make?: string | null;
  model?: string | null;
  owner?: string | null;
  arrivalTime?: string | null;
  status?: AppointmentStatus | string | null;
  pickupTime?: string | null;
}

// Backend returns lowercase statuses in some legacy endpoints.
// Use this to type raw API payloads and normalize to `AppointmentStatus` in the API client.
export type ApiAppointmentStatusLower =
  | 'scheduled'
  | 'in-progress'
  | 'ready'
  | 'completed'
  | 'no_show'
  | 'canceled';
