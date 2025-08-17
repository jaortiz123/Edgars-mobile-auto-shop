import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppointmentForm from '@/components/appointments/AppointmentForm';
import type { CustomerSearchResult } from '@/components/appointments/CustomerSearchInput';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// NOTE: These tests cover the service selection integration path.
// Full submit with service_operation_ids depends on selecting a real customer.
// A future refactor might expose a test hook or allow injecting initial customer state.

vi.mock('@/lib/api', async () => {
  const actual = (await vi.importActual('@/lib/api')) as Record<string, unknown>;
  return {
    ...actual,
    createAppointment: vi.fn().mockResolvedValue('new-appt-id'),
    getTechnicians: vi.fn().mockResolvedValue([])
  } as Record<string, unknown>;
});
import * as api from '@/lib/api';

const SERVICES = [
  { id: 'svc-a', name: 'Alignment', default_price: 120, category: 'Chassis' },
  { id: 'svc-b', name: 'Rotation', default_price: 40, category: 'Tires' }
];

const PRESET_CUSTOMER: CustomerSearchResult = {
  customerId: 'cust-1',
  name: 'Test Customer',
  phone: '555-1111',
  email: 'test@example.com',
  vehicles: [
    { vehicleId: 'veh-1', plate: 'ABC123', vehicle: '2018 Honda Civic' },
    { vehicleId: 'veh-2', plate: 'XYZ999', vehicle: '2019 Toyota Camry' }
  ]
};

describe('AppointmentForm services integration', () => {
  beforeEach(() => {
    vi.useRealTimers();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).fetch = vi.fn(async (url: string) => {
      if (url.includes('/admin/service-operations')) {
        return new Response(JSON.stringify(SERVICES), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });
  });

  function renderWithClient(ui: React.ReactElement) {
    const client = new QueryClient();
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  }

  async function typeSearch(value: string, waitForText: string) {
    const input = screen.getByPlaceholderText(/search services/i);
    await userEvent.clear(input);
    await userEvent.type(input, value);
    // Rely on findBy* (wrapped in act) instead of manual setTimeout to satisfy debounce + fetch
    await screen.findByText(waitForText, {}, { timeout: 1500 });
  }

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens modal and lists services after search', async () => {
    renderWithClient(<AppointmentForm mode="create" />);
  await userEvent.click(screen.getByRole('button', { name: /add service/i }));
  await typeSearch('al', 'Alignment');
  // Alignment result awaited above
  expect(screen.getByText('Alignment')).toBeInTheDocument();
  });

  it('selects a service and shows it in the form after confirming', async () => {
    renderWithClient(<AppointmentForm mode="create" />);
  await userEvent.click(screen.getByRole('button', { name: /add service/i }));
  await typeSearch('ro', 'Rotation');
  // Rotation result awaited above
  expect(screen.getByText('Rotation')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Rotation'));
    await userEvent.click(screen.getByRole('button', { name: /add 1 service/i }));
    expect(screen.getByText('Rotation')).toBeInTheDocument();
  });

  it('submits with preset customer, selected vehicle and services', async () => {
    const createSpy = vi.spyOn(api, 'createAppointment');
    renderWithClient(<AppointmentForm mode="create" presetCustomer={PRESET_CUSTOMER} />);
    // choose a vehicle
    const vehicleSelect = screen.getByLabelText(/vehicle/i);
    await userEvent.selectOptions(vehicleSelect, 'veh-2');
    // open modal and select services
  await userEvent.click(screen.getByRole('button', { name: /add service/i }));
  await typeSearch('al', 'Alignment');
  expect(screen.getByText('Alignment')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Alignment'));
    await userEvent.click(screen.getByText('Rotation'));
    await userEvent.click(screen.getByRole('button', { name: /add 2 services/i }));
    // fill required start time
    const startInput = screen.getByLabelText(/start time/i);
    await userEvent.type(startInput, '2025-08-16T10:30');
    // submit
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(createSpy).toHaveBeenCalledTimes(1);
    const payload = createSpy.mock.calls[0][0];
    expect(payload).toMatchObject({
      customer_id: 'cust-1',
      vehicle_id: 'veh-2',
      service_operation_ids: ['svc-a', 'svc-b']
    });
  });

  it('removes a selected service before submit and payload reflects reduced list', async () => {
    const createSpy = vi.spyOn(api, 'createAppointment');
    renderWithClient(<AppointmentForm mode="create" presetCustomer={PRESET_CUSTOMER} />);
    // choose vehicle
    await userEvent.selectOptions(screen.getByLabelText(/vehicle/i), 'veh-1');
    // add two services
  await userEvent.click(screen.getByRole('button', { name: /add service/i }));
  await typeSearch('al', 'Alignment');
  expect(screen.getByText('Alignment')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Alignment'));
    await userEvent.click(screen.getByText('Rotation'));
    await userEvent.click(screen.getByRole('button', { name: /add 2 services/i }));
    // remove one
    const removeAlignmentBtn = screen.getByRole('button', { name: /remove alignment/i });
    await userEvent.click(removeAlignmentBtn);
    // ensure only Rotation remains
    expect(screen.queryByText('Alignment')).not.toBeInTheDocument();
    expect(screen.getByText('Rotation')).toBeInTheDocument();
    // fill start time
    await userEvent.type(screen.getByLabelText(/start time/i), '2025-08-16T09:15');
    // submit
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(createSpy).toHaveBeenCalledTimes(1);
    const payload = createSpy.mock.calls[0][0];
    expect(payload).toMatchObject({
      customer_id: 'cust-1',
      vehicle_id: 'veh-1',
      service_operation_ids: ['svc-b']
    });
  });
});
