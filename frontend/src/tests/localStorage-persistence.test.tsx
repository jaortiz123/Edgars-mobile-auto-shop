import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { BoardStoreProvider } from '../state/BoardStoreProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../components/ui/Toast';

// NOTE: The original localStorage persistence for the add-service form was removed.
// These tests were rewritten to validate the CURRENT behaviour (no persistence, simple add flow).
// Mock API minimal responses required by AppointmentDrawer.
vi.mock('@/lib/api', async () => {
  const actual = (await vi.importActual('@/lib/api')) as Record<string, unknown>;
  const baseAppointment = {
    id: 'test-appointment-123',
    status: 'SCHEDULED',
    start: '2024-01-15T14:00:00Z',
    end: '2024-01-15T15:00:00Z',
    total_amount: 250.0,
    paid_amount: 0,
    check_in_at: null,
    check_out_at: null,
    tech_id: null
  };
  const customer = { id: 'cust-123', name: 'Test Customer', phone: '555-1111', email: 'test@example.com', vehicles: [{ id: 'veh-123', year: 2020, make: 'Toyota', model: 'Camry', vin: 'TEST123456' }] };
  const vehicle = { id: 'veh-123', year: 2020, make: 'Toyota', model: 'Camry', vin: 'TEST123456' };
  return {
    ...actual,
    getDrawer: vi.fn().mockResolvedValue({
      appointment: baseAppointment,
      customer,
      vehicle,
      services: []
    }),
    // New rich appointment fetch used by AppointmentDrawer edit flow
    getAppointment: vi.fn().mockResolvedValue({
      appointment: baseAppointment,
      customer,
      vehicle,
      services: [],
      service_operation_ids: [],
      meta: { version: 1 }
    }),
    getServiceOperations: vi.fn().mockResolvedValue([
      { id: 'op-brake', name: 'Brake Service', category: 'Safety', default_hours: 2, default_price: 150 },
      { id: 'op-oil', name: 'Oil Change', category: 'General', default_hours: 1, default_price: 80 }
    ]),
    // createAppointmentService no longer invoked directly after refactor; keep stub for safety
    createAppointmentService: vi.fn(),
    handleApiError: vi.fn()
  };
});

// Mock Tabs component
vi.mock('@/components/ui/Tabs', () => ({
  // Deliberately using unknown for generic test tab shape
  Tabs: ({ children, value, onValueChange, tabs }: { children: React.ReactNode; value: string; onValueChange: (v: string) => void; tabs: Array<{ value: string; label: string }> }) => (
    <div data-testid="tabs">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onValueChange(tab.value)}
          data-testid={`tab-${tab.value}`}
          className={value === tab.value ? 'active' : ''}
        >
          {tab.label}
        </button>
      ))}
      {children}
    </div>
  )
}));

// Import the component after mocking
import AppointmentDrawer from '../components/admin/AppointmentDrawer';

// Test wrapper
function TestWrapper({ children }: { children: React.ReactNode }) {
  // Provide a dedicated QueryClient for each test render to satisfy hooks using React Query
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <ToastProvider>
      <BrowserRouter>
        <QueryClientProvider client={qc}>
          <BoardStoreProvider>
            {children}
          </BoardStoreProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </ToastProvider>
  );
}

describe('Add Service Form (no persistence)', () => {
  const appointmentId = 'test-appointment-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows opening the form, entering valid data and staging a new service', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <AppointmentDrawer open onClose={() => {}} id={appointmentId} />
      </TestWrapper>
    );

  await screen.findByTestId('drawer-open');
    await user.click(screen.getByTestId('tab-services'));

    // Open the form
    const addBtn = await screen.findByTestId('add-service-button');
    await user.click(addBtn);
    const form = await screen.findByTestId('add-service-form');
    const formScope = within(form);

  // ServiceOperationSelect first textbox (search)
  const nameSearchInput = formScope.getAllByRole('textbox')[0];
  expect(nameSearchInput).toHaveValue('');
  const submit = formScope.getByTestId('add-service-submit-button');
  expect(submit).toBeDisabled();

  // Type partial to trigger dropdown then select option
  await user.type(nameSearchInput, 'Brake');
  const option = await screen.findByTestId('service-op-option-op-brake');
  await user.click(option);

  // After selection, hours/price/category should auto-populate via effect
  await user.type(formScope.getByLabelText(/notes/i), 'Replace pads');

  // Submit should now be enabled (name is set via selection)
  await waitFor(() => expect(submit).not.toBeDisabled());
    await user.click(submit);

    // After submit, form should hide and empty state should disappear
    await waitFor(() => expect(screen.queryByTestId('add-service-form')).not.toBeInTheDocument());
    expect(screen.queryByTestId('services-empty-state')).not.toBeInTheDocument();
    // Services list should contain a staged item (by staged background class marker data attribute)
    await waitFor(() => {
      const items = screen.queryAllByTestId(/service-item-/i);
      const hasBrake = items.some(el => /Brake Service/.test(el.textContent || ''));
      expect(hasBrake).toBe(true);
    });
  });

  it('allows cancelling the form which resets fields and hides it', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <AppointmentDrawer open onClose={() => {}} id={appointmentId} />
      </TestWrapper>
    );

  await screen.findByTestId('drawer-open');
    await user.click(screen.getByTestId('tab-services'));

    const addBtn = await screen.findByTestId('add-service-button');
    await user.click(addBtn);
    const form = await screen.findByTestId('add-service-form');
    const formScope = within(form);

  const searchInput = formScope.getAllByRole('textbox')[0];
  await user.type(searchInput, 'Oil');
  const oilOption = await screen.findByTestId('service-op-option-op-oil');
  await user.click(oilOption);
  // After selecting, the input should show the operation name
  await waitFor(() => expect(searchInput).toHaveValue('Oil Change'));

    await user.click(formScope.getByTestId('add-service-cancel-button'));
    await waitFor(() => expect(screen.queryByTestId('add-service-form')).not.toBeInTheDocument());

    // Re-open and ensure field reset
    await user.click(await screen.findByTestId('add-service-button'));
    const form2 = await screen.findByTestId('add-service-form');
    const nameInput2 = within(form2).getAllByRole('textbox')[0];
    expect(nameInput2).toHaveValue('');
  });
});
