// Unified Customer Profile types (frontend B6)
export type Money = number; // dollars with 2‑decimal precision per API contract

export type ProfileStats = {
  lifetime_spend: Money;
  unpaid_balance: Money;
  total_visits: number;
  last_visit_at: string | null; // ISO UTC
  avg_ticket: Money;
  last_service_at: string | null; // ISO UTC
  // Enhanced metrics from Phase 1 backend enhancement
  totalSpent?: Money;
  unpaidBalance?: Money;
  visitsCount?: number;
  completedCount?: number;
  avgTicket?: Money;
  lastServiceAt?: string | null;
  lastVisitAt?: string | null;
  last12MonthsSpent?: Money;
  last12MonthsVisits?: number;
  vehiclesCount?: number;
  isVip?: boolean;
  isOverdueForService?: boolean;
};

export type Vehicle = {
  id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  plate: string | null;
  vin: string | null;
  notes: string | null;
};

export type AppointmentService = {
  service_id: string;
  name: string;
  display_order?: number | null;
};

export type Appointment = {
  id: string;
  vehicle_id: string;
  scheduled_at: string; // ISO UTC
  status: string;
  services: AppointmentService[];
  invoice?: { id: string; total: Money; paid: Money; unpaid: Money } | null;
  // Enhanced fields for richer appointment history
  technician_name?: string | null;
  technician_id?: string | null;
  notes?: string | null;
  mileage?: number | null;
  completed_at?: string | null;
  check_in_at?: string | null;
  check_out_at?: string | null;
  estimated_duration?: number | null; // minutes
};

export type PageMeta = { next_cursor?: string | null; page_size: number; has_more: boolean };

export type CustomerProfile = {
  customer: {
    id: string;
    full_name: string;
    phone?: string | null;
    email?: string | null;
    created_at: string;
    tags?: string[];
    notes?: string | null;
    sms_consent?: boolean;
    // Enhanced fields from Phase 1 backend enhancement
    customerSince?: string | null;
    relationshipDurationDays?: number | null;
    preferredContactMethod?: string | null;
    preferredContactTime?: string | null;
    isVip?: boolean;
  };
  stats: ProfileStats;
  vehicles: Vehicle[];
  appointments: Appointment[];
  page?: PageMeta;
};
