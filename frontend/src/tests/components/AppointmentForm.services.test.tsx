import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@test-utils';
import userEvent from '@testing-library/user-event';
import AppointmentForm from '@/components/appointments/AppointmentForm';
import type { CustomerSearchResult } from '@/components/appointments/CustomerSearchInput';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Updated to reflect new single-add-per-row ServiceCatalogModal workflow.
// The modal allows inline Add which immediately invokes AppointmentForm's onConfirm path only
// when we click the confirm button (batch button). We simulate selecting via row Add buttons.

vi.mock('@/lib/api', async () => {
  const actual = (await vi.importActual('@/lib/api')) as Record<string, unknown>;
  return {
    ...actual,
    createAppointment: vi.fn().mockResolvedValue('new-appt-id'),
    getTechnicians: vi.fn().mockResolvedValue([])
  } as Record<string, unknown>;
});
import * as api from '@/lib/api';

// Provide full-ish shape so ServiceCatalogModal filters (which require is_active) don't drop them.
const SERVICES = [
  {
    id: 'svc-a',
    internal_code: 'ALIGN',
    name: 'Alignment',
    category: 'CHASSIS',
    subcategory: null,
    skill_level: 1,
    default_hours: 1,
    base_labor_rate: 120,
    keywords: ['alignment','wheel'],
    is_active: true,
    display_order: 1
  },
  {
    id: 'svc-b',
    internal_code: 'ROT',
    name: 'Rotation',
    category: 'TIRES',
    subcategory: null,
    skill_level: 1,
    default_hours: 0.5,
    base_labor_rate: 40,
    keywords: ['rotation','tire'],
    is_active: true,
    display_order: 2
  }
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
    const input = screen.getByPlaceholderText(/search within category/i);
    await userEvent.clear(input);
    await userEvent.type(input, value);
    // Rely on findBy* (wrapped in act) instead of manual setTimeout to satisfy debounce + fetch
    await screen.findByText(waitForText, {}, { timeout: 1500 });
  }

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens modal and lists services after search (single-add flow)', async () => {
    renderWithClient(<AppointmentForm mode="create" />);
    await userEvent.click(screen.getByRole('button', { name: /add service/i }));
    await typeSearch('al', 'Alignment');
    expect(screen.getByText('Alignment')).toBeInTheDocument();
  });

  it('adds a single service via inline Add button', async () => {
    renderWithClient(<AppointmentForm mode="create" />);
    await userEvent.click(screen.getByRole('button', { name: /add service/i }));
    await typeSearch('ro', 'Rotation');
    expect(screen.getByText('Rotation')).toBeInTheDocument();
    const row = screen.getByTestId('service-row-svc-b');
    const addBtn = within(row).getByRole('button', { name: /add/i });
    await userEvent.click(addBtn);
    const confirmBtn = screen.getByRole('button', { name: /add 1 service/i });
    await userEvent.click(confirmBtn);
    expect(screen.getByText('Rotation')).toBeInTheDocument();
  });

  it('submits with preset customer, vehicle and two services (inline adds)', async () => {
    const createSpy = vi.spyOn(api, 'createAppointment');
    renderWithClient(<AppointmentForm mode="create" presetCustomer={PRESET_CUSTOMER} />);
    await userEvent.selectOptions(screen.getByLabelText(/vehicle/i), 'veh-2');
    await userEvent.click(screen.getByRole('button', { name: /add service/i }));
    await typeSearch('al', 'Alignment');
    const rowA = screen.getByTestId('service-row-svc-a');
    await userEvent.click(within(rowA).getByRole('button', { name: /add/i }));
    await userEvent.clear(screen.getByTestId('service-search'));
    await userEvent.type(screen.getByTestId('service-search'), 'ro');
    await screen.findByText('Rotation');
    const rowB = screen.getByTestId('service-row-svc-b');
    await userEvent.click(within(rowB).getByRole('button', { name: /add/i }));
    const confirmBtn = screen.getByRole('button', { name: /add 2 services/i });
    await userEvent.click(confirmBtn);
    await userEvent.type(screen.getByLabelText(/start time/i), '2025-08-16T10:30');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(createSpy).toHaveBeenCalledTimes(1);
    const payload = createSpy.mock.calls[0][0];
    expect(payload).toMatchObject({
      customer_id: 'cust-1',
      vehicle_id: 'veh-2',
      service_operation_ids: ['svc-a', 'svc-b']
    });
  });

  it('removes a previously added service before submit (single-add path)', async () => {
    const createSpy = vi.spyOn(api, 'createAppointment');
    renderWithClient(<AppointmentForm mode="create" presetCustomer={PRESET_CUSTOMER} />);
    await userEvent.selectOptions(screen.getByLabelText(/vehicle/i), 'veh-1');
    await userEvent.click(screen.getByRole('button', { name: /add service/i }));
    await typeSearch('al', 'Alignment');
    await userEvent.click(within(screen.getByTestId('service-row-svc-a')).getByRole('button', { name: /add/i }));
    const confirm1 = screen.getByRole('button', { name: /add 1 service/i });
    await userEvent.click(confirm1);
    await userEvent.click(screen.getByRole('button', { name: /add service/i }));
    await userEvent.clear(screen.getByTestId('service-search'));
    await userEvent.type(screen.getByTestId('service-search'), 'ro');
    await screen.findByText('Rotation');
    await userEvent.click(within(screen.getByTestId('service-row-svc-b')).getByRole('button', { name: /add/i }));
    const confirm2 = screen.getByRole('button', { name: /add 1 service/i });
    await userEvent.click(confirm2);
    const removeAlignmentBtn = screen.getByRole('button', { name: /remove alignment/i });
    await userEvent.click(removeAlignmentBtn);
    expect(screen.queryByText('Alignment')).not.toBeInTheDocument();
    expect(screen.getByText('Rotation')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/start time/i), '2025-08-16T09:15');
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
