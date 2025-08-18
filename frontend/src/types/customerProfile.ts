// Unified Customer Profile types (frontend B6)
export type Money = number; // dollars with 2‑decimal precision per API contract

export type ProfileStats = {
  lifetime_spend: Money;
  unpaid_balance: Money;
  total_visits: number;
  last_visit_at: string | null; // ISO UTC
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
};

export type PageMeta = { next_cursor?: string | null; page_size: number; has_more: boolean };

export type CustomerProfile = {
  customer: { id: string; full_name: string; phone?: string | null; email?: string | null; created_at: string; tags?: string[] };
  stats: ProfileStats;
  vehicles: Vehicle[];
  appointments: Appointment[];
  page?: PageMeta;
};
