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
  customerName: string;
  vehicle: string;
  servicesSummary?: string;
  price?: number;
  urgency?: 'urgent' | 'soon';
  // Sprint 3C: Additional properties for countdown timers and status management
  status: AppointmentStatus;
  position: number;
  start?: string | null; // ISO timestamp for countdown calculations
  end?: string | null;   // ISO timestamp
  checkInAt?: string | null; // ISO - when car arrived on premises
  checkOutAt?: string | null; // ISO - when car left premises
  // NEW: Time-aware fields
  scheduledTime?: string; // "10:30 AM"
  appointmentDate?: string; // ISO date
  isOverdue?: boolean;
  minutesLate?: number;
  timeUntilStart?: number; // minutes until appointment

  // NEW: Enhanced intelligence fields
  estimatedDuration?: number; // minutes
  actualDuration?: number; // minutes (for learning)
  techAssigned?: string | null;
  customerPhoto?: string | null;
  lastServiceDate?: string | null;
  serviceHistory?: ServiceHistoryItem[];
  partsRequired?: Part[];
  workspacePreference?: 'bay1' | 'bay2' | 'bay3' | string;
  complexity?: 'simple' | 'moderate' | 'complex';
  customerNotes?: string;
  internalNotes?: string;
  recommendedNextService?: string;
  vehicleYear?: number | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  mileage?: number | null;
  appointmentSource?: 'phone' | 'walk-in' | 'online' | 'repeat' | string;
  isRepeatCustomer?: boolean;
  priorityReason?: string | null;
  // optional future: when customer expects pickup (promise time)
  promiseBy?: string | null;
}

export interface ServiceHistoryItem {
  date: string; // ISO
  service: string;
  mileage?: number | null;
  techName?: string | null;
  outcome: 'completed' | 'partial' | 'rescheduled';
}

export interface Part {
  name: string;
  partNumber?: string | null;
  quantity: number;
  inStock: boolean;
  vendor?: string | null;
  estimatedCost?: number | null;
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
  // Additional dashboard metrics
  completedToday?: number;
  pendingAppointments?: number;
  todayRevenue?: number;
  partsOrdered?: number;
  // NEW v2 ENHANCED TOTALS
  totals?: {
    today_completed: number;
    today_booked: number;
    avg_cycle: number | null;
    avg_cycle_formatted: string;
  };
}

export interface DrawerPayload {
  appointment: Appointment;
  customer: Customer | null;
  vehicle: Vehicle | null;
  services: AppointmentService[];
}

export type MessageChannel = 'sms' | 'email';
export type MessageDirection = 'out' | 'in';
export type MessageStatus = 'sending' | 'delivered' | 'failed';

export interface Message {
  id: string;
  appointment_id: string;
  channel: MessageChannel;
  direction: MessageDirection;
  body: string;
  status: MessageStatus;
  sent_at?: string | null; // ISO timestamp
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

// Customer History Types (T-023)
export interface CustomerHistoryPayment {
  id: string;
  amount: number;
  method: string;
  created_at: string;
}

export interface CustomerHistoryAppointment {
  id: string;
  status: string;
  start: string;
  total_amount: number;
  paid_amount: number;
  created_at: string;
  payments: CustomerHistoryPayment[];
}

export interface CustomerHistoryResponse {
  data: {
    pastAppointments: CustomerHistoryAppointment[];
    payments: CustomerHistoryPayment[];
  };
  errors: null;
}

export interface Service {
  id: number;
  name: string;
  description: string;
  base_price?: number;
  duration?: number;
  duration_minutes?: number;
  category?: string;
}
