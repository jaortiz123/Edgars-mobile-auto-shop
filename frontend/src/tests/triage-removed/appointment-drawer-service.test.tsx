// Test AppointmentDrawer service submission logic in isolation
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppointmentDrawer from '../../components/admin/AppointmentDrawer';

// Mock the API module completely
const mockCreateAppointmentService = vi.fn();
const mockGetAppointmentServices = vi.fn();

vi.mock('../../lib/api', () => ({
  createAppointmentService: mockCreateAppointmentService,
  getAppointmentServices: mockGetAppointmentServices,
  handleApiError: vi.fn(),
}));

// Mock other dependencies
vi.mock('../../components/admin/Services', () => ({
  default: () => <div data-testid="services-component">Services Component</div>
}));

describe('AppointmentDrawer Service Submission', () => {
  const mockData = {
    appointment: {
      id: 'apt-test-123',
      status: 'SCHEDULED' as const,
      total_amount: 100,
      paid_amount: 0,
      check_in_at: null,
    },
    customer: {
      id: 'cust-123',
      name: 'Test Customer',
      email: 'test@example.com',
      phone: '555-0123',
    },
    vehicle: {
      id: 'veh-123',
      year: 2020,
      make: 'Toyota',
      model: 'Camry',
      vin: 'TEST123456789',
    },
    services: []
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock responses
    mockCreateAppointmentService.mockResolvedValue({
      service: {
        id: 'svc-new-123',
        appointment_id: 'apt-test-123',
        name: 'Happy Path Test Service',
        notes: 'Integration test service',
        estimated_hours: 1,
        estimated_price: 199.99,
        category: 'Test'
      },
      appointment_total: 299.99
    });

    mockGetAppointmentServices.mockResolvedValue([]);
  });

  it('should submit a service successfully and update the UI', async () => {
    const user = userEvent.setup();

    render(
      <AppointmentDrawer
        data={mockData}
        isOpen={true}
        onClose={() => {}}
        onUpdate={() => {}}
      />
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByTestId('drawer-open')).toBeInTheDocument();
    });

    // Click "Add Service" button
    const addServiceButton = screen.getByRole('button', { name: /add.*service/i });
    await user.click(addServiceButton);

    // Wait for form to appear
    await waitFor(() => {
      expect(screen.getByTestId('add-service-form')).toBeInTheDocument();
    });

    // Fill out the service form
    const serviceNameInput = screen.getByLabelText(/service.*name|name/i);
    await user.click(serviceNameInput);
    await user.type(serviceNameInput, 'Happy Path Test Service');

    const notesInput = screen.queryByLabelText(/notes|description/i);
    if (notesInput) {
      await user.click(notesInput);
      await user.type(notesInput, 'Integration test service');
    }

    const priceInput = screen.queryByLabelText(/price|cost|amount/i);
    if (priceInput) {
      await user.click(priceInput);
      await user.type(priceInput, '199.99');
    }

    // Submit the form
    const submitButton = screen.getByTestId('add-service-submit-button');
    expect(submitButton).not.toBeDisabled();

    await user.click(submitButton);

    // Verify API was called correctly
    await waitFor(() => {
      expect(mockCreateAppointmentService).toHaveBeenCalledWith('apt-test-123', {
        name: 'Happy Path Test Service',
        notes: 'Integration test service',
        estimated_hours: undefined,
        estimated_price: 199.99,
        category: ''
      });
    });

    // Verify the form was reset
    await waitFor(() => {
      expect(screen.queryByTestId('add-service-form')).not.toBeInTheDocument();
    });

    console.log('✅ Service submission test passed');
  });

  it('should handle API errors gracefully', async () => {
    const user = userEvent.setup();

    // Mock API to fail
    mockCreateAppointmentService.mockRejectedValue(new Error('API Error'));

    render(
      <AppointmentDrawer
        data={mockData}
        isOpen={true}
        onClose={() => {}}
        onUpdate={() => {}}
      />
    );

    // Click "Add Service" and fill form
    const addServiceButton = screen.getByRole('button', { name: /add.*service/i });
    await user.click(addServiceButton);

    await waitFor(() => {
      expect(screen.getByTestId('add-service-form')).toBeInTheDocument();
    });

    const serviceNameInput = screen.getByLabelText(/service.*name|name/i);
    await user.type(serviceNameInput, 'Test Service');

    // Submit the form
    const submitButton = screen.getByTestId('add-service-submit-button');
    await user.click(submitButton);

    // Verify API was called and error was handled
    await waitFor(() => {
      expect(mockCreateAppointmentService).toHaveBeenCalled();
    });

    // Form should still be visible on error
    expect(screen.getByTestId('add-service-form')).toBeInTheDocument();

    console.log('✅ Error handling test passed');
  });
});
