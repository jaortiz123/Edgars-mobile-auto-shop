import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, expect, beforeEach, describe } from 'vitest';
import AppointmentDrawer from '../components/admin/AppointmentDrawer';
import { ToastProvider } from '../components/ui/Toast';

// Mock the API module before importing the component
vi.mock('@/lib/api', async () => {
  const actual = (await vi.importActual('@/lib/api')) as Record<string, unknown>;
  return {
    ...actual,
    getDrawer: vi.fn(),
    createAppointmentService: vi.fn(),
    updateAppointmentService: vi.fn(),
    deleteAppointmentService: vi.fn(),
    handleApiError: vi.fn((error, defaultMessage) => defaultMessage),
  };
});

// Mock the toast library
vi.mock('../lib/toast', () => ({
  setToastPush: vi.fn(),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

// Import the mocked functions after the mock is defined
import { getDrawer, createAppointmentService, updateAppointmentService, deleteAppointmentService, handleApiError } from '@/lib/api';

const mockDrawerData = {
  appointment: {
    id: 'apt-123',
    status: 'SCHEDULED',
    total_amount: 150.00,
    paid_amount: 0,
    check_in_at: null
  },
  customer: {
    id: 'cust-1',
    name: 'John Doe',
    phone: '+15551234567',
    email: 'john@example.com'
  },
  vehicle: {
    id: 'veh-1',
    year: 2020,
    make: 'Honda',
    model: 'Civic',
    vin: '1HGBH41JXMN109186'
  },
  services: [
    {
      id: 'svc-1',
      appointment_id: 'apt-123',
      name: 'Oil Change',
      notes: 'Full synthetic oil',
      estimated_hours: 1.0,
      estimated_price: 75.00,
      category: 'Maintenance'
    },
    {
      id: 'svc-2',
      appointment_id: 'apt-123',
      name: 'Brake Inspection',
      notes: null,
      estimated_hours: 0.5,
      estimated_price: 75.00,
      category: 'Inspection'
    }
  ]
};

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {children}
    </ToastProvider>
  );
}

describe('Services CRUD in AppointmentDrawer', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    (getDrawer as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(mockDrawerData as unknown);
  });

  test('displays existing services correctly', async () => {
    render(
      <TestWrapper>
        <AppointmentDrawer open={true} onClose={() => {}} id="apt-123" />
      </TestWrapper>
    );

    // Wait for drawer to load
    expect(await screen.findByText('Appointment')).toBeInTheDocument();

    // Switch to Services tab
    await user.click(screen.getByRole('tab', { name: 'Services' }));

    // Check if services are displayed
    expect(await screen.findByTestId('service-name-svc-1')).toHaveTextContent('Oil Change');
    expect(screen.getByTestId('service-name-svc-2')).toHaveTextContent('Brake Inspection');
    expect(screen.getByTestId('service-notes-svc-1')).toHaveTextContent('Full synthetic oil');
    expect(screen.getByTestId('service-hours-svc-1')).toHaveTextContent('1h');
    expect(screen.getByTestId('service-price-svc-1')).toHaveTextContent('$75.00');
    expect(screen.getByTestId('services-total')).toHaveTextContent('Total: $150.00');
  });

  test('adds a new service successfully', async () => {
    const mockCreatedService = {
      service: {
        id: 'svc-3',
        appointment_id: 'apt-123',
        name: 'Tire Rotation',
        notes: 'All four tires',
        estimated_hours: 0.5,
        estimated_price: 50.00,
        category: 'Maintenance'
      },
      appointment_total: 200.00
    };

    vi.mocked(createAppointmentService).mockResolvedValue(mockCreatedService);

    render(
      <TestWrapper>
        <AppointmentDrawer open={true} onClose={() => {}} id="apt-123" />
      </TestWrapper>
    );

    expect(await screen.findByText('Appointment')).toBeInTheDocument();

    // Switch to Services tab
    await user.click(screen.getByRole('tab', { name: 'Services' }));

    // Click Add Service button
    await user.click(screen.getByTestId('add-service-button'));

    // Fill in the form
    await user.type(screen.getByLabelText('Service Name *'), 'Tire Rotation');
    await user.type(screen.getByLabelText('Notes'), 'All four tires');
    await user.type(screen.getByLabelText('Hours'), '0.5');
    await user.type(screen.getByLabelText('Price ($)'), '50.00');
    await user.selectOptions(screen.getByLabelText('Category'), 'Maintenance');

    // Submit the form
    await user.click(screen.getByTestId('add-service-submit-button'));

    await waitFor(() => {
      expect(createAppointmentService).toHaveBeenCalledWith('apt-123', {
        name: 'Tire Rotation',
        notes: 'All four tires',
        estimated_hours: 0.5,
        estimated_price: 50.00,
        category: 'Maintenance'
      });
    });

    // Check if the new service appears in the list
    expect(await screen.findByTestId('service-name-svc-3')).toHaveTextContent('Tire Rotation');
    expect(screen.getByTestId('services-total')).toHaveTextContent('Total: $200.00');
  });

  test('validates required fields when adding service', async () => {
    render(
      <TestWrapper>
        <AppointmentDrawer open={true} onClose={() => {}} id="apt-123" />
      </TestWrapper>
    );

    expect(await screen.findByText('Appointment')).toBeInTheDocument();

    // Switch to Services tab
    await user.click(screen.getByRole('tab', { name: 'Services' }));

    // Click Add Service button
    await user.click(screen.getByTestId('add-service-button'));

    // Try to submit without name
    const addButton = screen.getByTestId('add-service-submit-button');
    expect(addButton).toBeDisabled();

    // Add name and verify button is enabled
    await user.type(screen.getByLabelText('Service Name *'), 'Test Service');
    expect(addButton).not.toBeDisabled();
  });

  test('edits an existing service', async () => {
    const mockUpdatedService = {
      service: {
        id: 'svc-1',
        appointment_id: 'apt-123',
        name: 'Premium Oil Change',
        notes: 'Full synthetic premium oil',
        estimated_hours: 1.5,
        estimated_price: 95.00,
        category: 'Maintenance'
      },
      appointment_total: 170.00
    };

    vi.mocked(updateAppointmentService).mockResolvedValue(mockUpdatedService);

    render(
      <TestWrapper>
        <AppointmentDrawer open={true} onClose={() => {}} id="apt-123" />
      </TestWrapper>
    );

    expect(await screen.findByText('Appointment')).toBeInTheDocument();

    // Switch to Services tab
    await user.click(screen.getByRole('tab', { name: 'Services' }));

    // Click edit button for the first service
    await user.click(screen.getByTestId('edit-service-svc-1'));

    // Modify the service
    const nameInput = screen.getByDisplayValue('Oil Change');
    await user.clear(nameInput);
    await user.type(nameInput, 'Premium Oil Change');

    const notesInput = screen.getByDisplayValue('Full synthetic oil');
    await user.clear(notesInput);
    await user.type(notesInput, 'Full synthetic premium oil');

    const hoursInput = screen.getByDisplayValue('1');
    await user.clear(hoursInput);
    await user.type(hoursInput, '1.5');

    const priceInput = screen.getByDisplayValue('75');
    await user.clear(priceInput);
    await user.type(priceInput, '95.00');

    // Save changes
    await user.click(screen.getByTestId('save-edit-service-svc-1'));

    await waitFor(() => {
      expect(updateAppointmentService).toHaveBeenCalledWith('apt-123', 'svc-1', {
        name: 'Premium Oil Change',
        notes: 'Full synthetic premium oil',
        estimated_hours: 1.5,
        estimated_price: 95.00,
        category: 'Maintenance'
      });
    });

    // Check if the service is updated
    expect(await screen.findByText('Premium Oil Change')).toBeInTheDocument();
    expect(screen.getByText('Total: $170.00')).toBeInTheDocument();
  });

  test('deletes a service with confirmation', async () => {
    const mockDeleteResponse = {
      message: 'Service deleted successfully',
      appointment_total: 75.00
    };

    vi.mocked(deleteAppointmentService).mockResolvedValue(mockDeleteResponse);

    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <TestWrapper>
        <AppointmentDrawer open={true} onClose={() => {}} id="apt-123" />
      </TestWrapper>
    );

    expect(await screen.findByText('Appointment')).toBeInTheDocument();

    // Switch to Services tab
    await user.click(screen.getByRole('tab', { name: 'Services' }));

    // Click delete button for the first service
    await user.click(screen.getByTestId('delete-service-svc-1'));

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete this service?');

    await waitFor(() => {
      expect(deleteAppointmentService).toHaveBeenCalledWith('apt-123', 'svc-1');
    });

    // Check if total is updated
    expect(await screen.findByTestId('services-total')).toHaveTextContent('Total: $75.00');

    confirmSpy.mockRestore();
  });

  test('cancels delete when user declines confirmation', async () => {
    // Mock window.confirm to return false
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <TestWrapper>
        <AppointmentDrawer open={true} onClose={() => {}} id="apt-123" />
      </TestWrapper>
    );

    expect(await screen.findByText('Appointment')).toBeInTheDocument();

    // Switch to Services tab
    await user.click(screen.getByRole('tab', { name: 'Services' }));

    // Click delete button for the first service
    await user.click(screen.getByTestId('delete-service-svc-1'));

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete this service?');
    expect(deleteAppointmentService).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  test('handles API errors gracefully', async () => {
    vi.mocked(createAppointmentService).mockRejectedValue(new Error('Network error'));

    render(
      <TestWrapper>
        <AppointmentDrawer open={true} onClose={() => {}} id="apt-123" />
      </TestWrapper>
    );

    expect(await screen.findByText('Appointment')).toBeInTheDocument();

    // Switch to Services tab and add a service
    await user.click(screen.getByRole('tab', { name: 'Services' }));
    await user.click(screen.getByTestId('add-service-button'));

    await user.type(screen.getByLabelText('Service Name *'), 'Test Service');

    await user.click(screen.getByTestId('add-service-submit-button'));

    await waitFor(() => {
      expect(handleApiError).toHaveBeenCalled();
    });
  });

  test('validates numeric inputs', async () => {
    render(
      <TestWrapper>
        <AppointmentDrawer open={true} onClose={() => {}} id="apt-123" />
      </TestWrapper>
    );

    expect(await screen.findByText('Appointment')).toBeInTheDocument();

    // Switch to Services tab
    await user.click(screen.getByRole('tab', { name: 'Services' }));
    await user.click(screen.getByTestId('add-service-button'));

    // Enter invalid hours
    await user.type(screen.getByLabelText('Service Name *'), 'Test Service');
    await user.type(screen.getByLabelText('Hours'), 'invalid');

    await user.click(screen.getByTestId('add-service-submit-button'));

    // Should not call API with invalid data
    expect(createAppointmentService).not.toHaveBeenCalled();
  });

  test('shows empty state when no services exist', async () => {
    const emptyData = {
      ...mockDrawerData,
      services: []
    };
    vi.mocked(getDrawer).mockResolvedValue(emptyData);

    render(
      <TestWrapper>
        <AppointmentDrawer open={true} onClose={() => {}} id="apt-123" />
      </TestWrapper>
    );

    expect(await screen.findByText('Appointment')).toBeInTheDocument();

    // Switch to Services tab
    await user.click(screen.getByRole('tab', { name: 'Services' }));

    expect(await screen.findByText('No services added yet.')).toBeInTheDocument();
    expect(screen.getByText('Add your first service')).toBeInTheDocument();
  });
});
