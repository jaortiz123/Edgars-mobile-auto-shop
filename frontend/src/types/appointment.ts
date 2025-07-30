// Standardized appointment interface for type consistency across Sprint 2B components
export interface Appointment {
  id: string;
  customer_name: string;
  customer_phone?: string;
  service: string;
  requested_time: string;
  scheduled_at?: string;
  status: string;
  location_address?: string;
  notes?: string;
  price?: number;
}

export interface AppointmentUrgencyInfo {
  label: string;
  icon: React.ComponentType<any>;
  badgeClass: string;
  cardClass: string;
  priority: number;
}

export interface AppointmentStatistics {
  total: number;
  startingSoon: number;
  runningLate: number;
  overdue: number;
  today: number;
}

export type AppointmentStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'in-progress' 
  | 'completed' 
  | 'cancelled' 
  | 'no-show';

export type UrgencyLevel = 
  | 'normal' 
  | 'today' 
  | 'starting-soon' 
  | 'running-late' 
  | 'overdue';

export interface UrgencyThresholds {
  overdue: number;      // Minutes past start time to consider overdue
  runningLate: number;  // Minutes past start time to consider running late
  startingSoon: number; // Minutes before start time to consider starting soon
}
