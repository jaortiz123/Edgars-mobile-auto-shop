/**
 * buildQuickAddPayload
 * Pure helper to assemble the submission payload for QuickAddModal.
 * It intentionally contains no DOM access, side effects, or async code.
 */
export interface QuickAddFormState {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceType: string;
  appointmentDate: string;
  appointmentTime: string;
  serviceAddress: string;
  notes: string;
  licensePlate: string;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  quickAppointment?: boolean;
  // Phase 2: Vehicle selection support
  selectedVehicleId?: string; // ID of existing vehicle when selected from customer records
  vehicleId?: string; // Alternative name for backward compatibility
  [k: string]: unknown; // forward compatible extension
}

export interface SelectedServiceLike { id: string; name?: string }

export interface QuickAddPayload extends QuickAddFormState {
  service_operation_ids: string[];
}

export function buildQuickAddPayload(form: QuickAddFormState, selected: SelectedServiceLike[]): QuickAddPayload {
  const payload: QuickAddPayload = {
    ...form,
    service_operation_ids: selected.map(s => s.id),
  };

  // Phase 2: Include vehicle_id when existing vehicle is selected
  if (form.selectedVehicleId || form.vehicleId) {
    payload.vehicle_id = form.selectedVehicleId || form.vehicleId;
  }

  return payload;
}

/**
 * Minimal validation mirroring component logic (subset).
 */
export interface ValidationResult { valid: boolean; errors: Record<string,string>; }

export function validateQuickAdd(form: QuickAddFormState, selected: SelectedServiceLike[]): ValidationResult {
  const errors: Record<string,string> = {};
  if (!form.customerName?.trim()) errors.customerName = 'Customer name is required';
  if (!form.customerPhone?.trim()) errors.customerPhone = 'Phone number is required';
  if (form.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail)) errors.customerEmail = 'Please enter a valid email address';
  if (selected.length === 0) errors.serviceType = 'At least one service is required';
  if (!form.appointmentDate) errors.appointmentDate = 'Appointment date is required';
  if (!form.appointmentTime) errors.appointmentTime = 'Appointment time is required';
  if (!form.vehicleMake?.trim()) errors.vehicleMake = 'Vehicle make is required';
  if (!form.vehicleModel?.trim()) errors.vehicleModel = 'Vehicle model is required';
  if (!form.vehicleYear?.trim()) errors.vehicleYear = 'Vehicle year is required';
  if (form.customerPhone && !/^\+?[\d\s\-()]+$/.test(form.customerPhone)) errors.customerPhone = 'Please enter a valid phone number';
  if (form.appointmentDate) {
    const selectedDate = new Date(form.appointmentDate);
    const today = new Date(); today.setHours(0,0,0,0);
    if (selectedDate < today) errors.appointmentDate = 'Appointment date must be today or in the future';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
