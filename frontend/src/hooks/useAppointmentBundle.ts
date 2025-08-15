import { useQuery } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type { DrawerPayload, AppointmentService } from '@/types/models';

export interface AppointmentBundle {
  appointment: DrawerPayload['appointment'];
  services: AppointmentService[];
  customer: DrawerPayload['customer'];
  vehicle: DrawerPayload['vehicle'];
  // Placeholder for future: history, messages summary, etc.
}

async function fetchAppointmentBundle(id: string): Promise<AppointmentBundle> {
  // Single round-trip today still composed of existing endpoints (can be replaced by backend bundle)
  const drawer = await api.getDrawer(id);
  let services: AppointmentService[] = [];
  try {
    services = await api.getAppointmentServices(id);
  } catch {
    services = drawer.services || [];
  }
  return {
    appointment: drawer.appointment,
    services,
    customer: drawer.customer,
    vehicle: drawer.vehicle
  };
}

export function useAppointmentBundle(id: string | null) {
  const enabled = Boolean(id) && Boolean(import.meta.env.VITE_APPT_DRAWER_BUNDLE === '1' || window.__APPT_DRAWER_BUNDLE__);
  return useQuery<AppointmentBundle>({
    queryKey: ['appointment-bundle', id],
    queryFn: () => fetchAppointmentBundle(id as string),
    enabled,
    staleTime: 15_000,
  });
}

// Global feature flag shim (for non-Vite inline toggling in console)
declare global { interface Window { __APPT_DRAWER_BUNDLE__?: boolean; } }
