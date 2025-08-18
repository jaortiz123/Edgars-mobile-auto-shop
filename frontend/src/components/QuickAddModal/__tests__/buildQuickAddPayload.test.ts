import { describe, it, expect } from 'vitest';
import { buildQuickAddPayload, validateQuickAdd, type QuickAddFormState } from '../buildQuickAddPayload';

const baseForm: QuickAddFormState = {
  customerName: 'Alex Customer',
  customerPhone: '5551112222',
  serviceType: 'Oil Change',
  appointmentDate: '2099-12-31',
  appointmentTime: '10:00 AM',
  serviceAddress: '123 Main',
  notes: '',
  licensePlate: 'ABC123',
  vehicleYear: '2020',
  vehicleMake: 'Honda',
  vehicleModel: 'Civic',
  quickAppointment: true,
};

describe('buildQuickAddPayload', () => {
  it('assembles payload with selected service ids preserving order', () => {
    const selected = [{ id: 'svc-1' }, { id: 'svc-2' }];
    const payload = buildQuickAddPayload(baseForm, selected);
    expect(payload.service_operation_ids).toEqual(['svc-1', 'svc-2']);
    expect(payload.customerName).toBe(baseForm.customerName);
  });
});

describe('validateQuickAdd', () => {
  it('returns valid=true for complete form & at least one service', () => {
    const result = validateQuickAdd(baseForm, [{ id: 'svc-1' }]);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('flags missing required fields', () => {
    const incomplete: QuickAddFormState = { ...baseForm, customerName: '', appointmentDate: '', appointmentTime: '', vehicleMake: '', vehicleModel: '', vehicleYear: '' };
    const result = validateQuickAdd(incomplete, []);
    expect(result.valid).toBe(false);
    expect(result.errors.customerName).toBeTruthy();
    expect(result.errors.serviceType).toBe('At least one service is required');
    expect(result.errors.appointmentDate).toBeTruthy();
    expect(result.errors.appointmentTime).toBeTruthy();
    expect(result.errors.vehicleMake).toBeTruthy();
    expect(result.errors.vehicleModel).toBeTruthy();
    expect(result.errors.vehicleYear).toBeTruthy();
  });

  it('validates phone format', () => {
    const bad: QuickAddFormState = { ...baseForm, customerPhone: 'INVALID' };
    const result = validateQuickAdd(bad, [{ id: 'svc-1' }]);
    expect(result.valid).toBe(false);
    expect(result.errors.customerPhone).toMatch(/valid phone/i);
  });

  it('rejects past dates', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const past: QuickAddFormState = { ...baseForm, appointmentDate: yesterday };
    const result = validateQuickAdd(past, [{ id: 'svc-1' }]);
    expect(result.valid).toBe(false);
    expect(result.errors.appointmentDate).toMatch(/future/);
  });
});
