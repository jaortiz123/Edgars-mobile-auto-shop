import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppointmentForm from '@/components/appointments/AppointmentForm';
import type { CustomerSearchResult } from '@/components/appointments/CustomerSearchInput';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// We reuse the service lite shape used by the form (subset of catalog fields)
interface ServiceLite { id: string; name: string; category?: string; estimated_hours?: number; estimated_price?: number; }

// Mock API module
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/api');
  return {
    ...actual,
    patchAppointment: vi.fn().mockResolvedValue({ id: 'appt-123' }),
    getTechnicians: vi.fn().mockResolvedValue([
      { id: 'tech-1', name: 'Edgar Diaz', initials: 'ED', isActive: true },
      { id: 'tech-2', name: 'Maria Lopez', initials: 'ML', isActive: true },
    ])
  } as Record<string, unknown>;
});
import * as api from '@/lib/api';

const PRESET: CustomerSearchResult = {
  customerId: 'cust-10',
  name: 'Jane Driver',
  phone: '555-2222',
  email: 'jane@example.com',
  vehicles: [
    { vehicleId: 'veh-10', plate: 'JDR123', vehicle: '2020 Toyota Corolla' },
    { vehicleId: 'veh-11', plate: 'JDR456', vehicle: '2021 Ford Escape' }
  ]
};

const INITIAL_SERVICES: ServiceLite[] = [
  { id: 'op-1', name: 'Oil Change', category: 'Maintenance', estimated_price: 69.99 },
  { id: 'op-2', name: 'Tire Rotation', category: 'Tires', estimated_price: 49.00 }
];

function setup(overrides: Partial<React.ComponentProps<typeof AppointmentForm>> = {}) {
  const client = new QueryClient();
  const utils = render(
    <QueryClientProvider client={client}>
      <AppointmentForm
        mode="edit"
        appointmentId="appt-123"
        initial={{
          title: 'Customer reported vibration',
          start: '2025-08-16T14:30:00.000Z',
          end: '2025-08-16T15:00:00.000Z',
          status: 'SCHEDULED',
          customerId: PRESET.customerId,
          vehicleId: PRESET.vehicles[0].vehicleId,
          techId: 'tech-1'
        }}
        presetCustomer={PRESET}
        initialServices={INITIAL_SERVICES}
        onSubmit={vi.fn()}
        {...overrides}
      />
    </QueryClientProvider>
  );
  return { ...utils };
}

describe('AppointmentForm edit mode', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('populates form fields from initial data', async () => {
    setup();
    // Title
    const title = await screen.findByLabelText(/appointment title/i);
    expect((title as HTMLInputElement).value).toContain('Customer reported vibration');
    // Status
    expect((screen.getByLabelText(/status/i) as HTMLSelectElement).value).toBe('SCHEDULED');
    // Technician
    // Wait for technicians to load
  const techSelect = await screen.findByLabelText(/technician/i);
  expect((techSelect as HTMLSelectElement).value).toBe('tech-1');
    // Vehicle selection
    expect((screen.getByLabelText(/vehicle/i) as HTMLSelectElement).value).toBe('veh-10');
    // Services listed
    expect(screen.getByText('Oil Change')).toBeInTheDocument();
    expect(screen.getByText('Tire Rotation')).toBeInTheDocument();
    // Start / End converted to local input format (YYYY-MM-DDTHH:MM)
    const startInput = screen.getByLabelText(/start time/i) as HTMLInputElement;
    expect(startInput.value).toMatch(/2025-08-16T\d{2}:30/);
  });

  it('submits PATCH with updated fields', async () => {
    setup();
    const patchSpy = vi.spyOn(api, 'patchAppointment');
    // Change status and title
    await userEvent.clear(screen.getByLabelText(/appointment title/i));
    await userEvent.type(screen.getByLabelText(/appointment title/i), 'Updated vibration note');
    await userEvent.selectOptions(screen.getByLabelText(/status/i), 'READY');
    // Change technician
  const techSelect = await screen.findByLabelText(/technician/i);
  await userEvent.selectOptions(techSelect, 'tech-2');
    // Change vehicle
    await userEvent.selectOptions(screen.getByLabelText(/vehicle/i), 'veh-11');
    // Submit
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(patchSpy).toHaveBeenCalledTimes(1);
    const [id, payload] = patchSpy.mock.calls[0];
    expect(id).toBe('appt-123');
    expect(payload).toMatchObject({
      status: 'READY',
      notes: 'Updated vibration note',
      tech_id: 'tech-2',
      vehicle_id: 'veh-11'
    });
  });

  it('shows field-level validation errors on failed PATCH', async () => {
    const patchSpy = vi.spyOn(api, 'patchAppointment').mockRejectedValueOnce({
      response: {
        data: {
          errors: [
            { field: 'start_ts', detail: 'Start time invalid' },
            { detail: 'General failure' }
          ]
        }
      }
    });
    setup();
    // Force a change to trigger submit
    await userEvent.clear(screen.getByLabelText(/appointment title/i));
    await userEvent.type(screen.getByLabelText(/appointment title/i), 'Edited');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(patchSpy).toHaveBeenCalled();
    // Field error appears
    expect(await screen.findByText(/start time invalid/i)).toBeInTheDocument();
    // General error visible
    expect(screen.getByText(/general failure/i)).toBeInTheDocument();
  });
});
