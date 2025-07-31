import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, test, expect, beforeEach, describe } from 'vitest';
import AppointmentDrawer from '../components/admin/AppointmentDrawer';
import * as centralizedApiMock from '../test/mocks/api';
import { ToastProvider } from '../components/ui/Toast';

// Use centralized API mock instead of duplicate declarations
vi.mock('../lib/api', () => centralizedApiMock);

// Mock the toast library
vi.mock('../lib/toast', () => ({
  setToastPush: vi.fn(),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(centralizedApiMock.getDrawer).mockResolvedValue(mockDrawerData);
  });

  test('displays existing services correctly', async () => {
    render(
      <TestWrapper>
        <AppointmentDrawer open={true} onClose={() => {}} id="apt-123" />
      </TestWrapper>
    );

    // Wait for drawer to load
    await waitFor(() => {
      expect(screen.getByText('Appointment')).toBeInTheDocument();
    });

    // Switch to Services tab
    fireEvent.click(screen.getByRole('tab', { name: 'Services' }));

    // Check if services are displayed
    await waitFor(() => {
      expect(screen.getByTestId('service-name-svc-1')).toHaveTextContent('Oil Change');
      expect(screen.getByTestId('service-name-svc-2')).toHaveTextContent('Brake Inspection');
      expect(screen.getByTestId('service-notes-svc-1')).toHaveTextContent('Full synthetic oil');
      expect(screen.getByTestId('service-hours-svc-1')).toHaveTextContent('1h');
      expect(screen.getByTestId('service-price-svc-1')).toHaveTextContent('$75.00');
      expect(screen.getByTestId('services-total')).toHaveTextContent('Total: $150.00');
    });
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

    vi.mocked(centralizedApiMock.createAppointmentService).mockResolvedValue(mockCreatedService);

    render(
      <TestWrapper>
        <AppointmentDrawer open={true} onClose={() => {}} id="apt-123" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Appointment')).toBeInTheDocument();
    });

    // Switch to Services tab
    fireEvent.click(screen.getByRole('tab', { name: 'Services' }));

    // Click Add Service button
    fireEvent.click(screen.getByTestId('add-service-button'));

    // Fill in the form
    fireEvent.change(screen.getByLabelText('Service Name *'), {
      target: { value: 'Tire Rotation' }
    });
    fireEvent.change(screen.getByLabelText('Notes'), {
      target: { value: 'All four tires' }
    });
    fireEvent.change(screen.getByLabelText('Hours'), {
      target: { value: '0.5' }
    });
    fireEvent.change(screen.getByLabelText('Price ($)'), {
      target: { value: '50.00' }
    });
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'Maintenance' }
    });

    // Submit the form
    fireEvent.click(screen.getByTestId('add-service-submit-button'));

    await waitFor(() => {
      expect(api.createAppointmentService).toHaveBeenCalledWith('apt-123', {
        name: 'Tire Rotation',
        notes: 'All four tires',
        estimated_hours: 0.5,
        estimated_price: 50.00,
        category: 'Maintenance'
      });
    });

    // Check if the new service appears in the list
    await waitFor(() => {
      expect(screen.getByTestId('service-name-svc-3')).toHaveTextContent('Tire Rotation');
      expect(screen.getByTestId('services-total')).toHaveTextContent('Total: $200.00');
    });
  });

  test('validates required fields when adding service', async () => {
    render(
      <TestWrapper>
        <AppointmentDrawer open={true} onClose={() => {}} id="apt-123" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Appointment')).toBeInTheDocument();
    });

    // Switch to Services tab
    fireEvent.click(screen.getByRole('tab', { name: 'Services' }));

    // Click Add Service button
    fireEvent.click(screen.getByTestId('add-service-button'));

    // Try to submit without name
    const addButton = screen.getByTestId('add-service-submit-button');
    expect(addButton).toBeDisabled();

    // Add name and verify button is enabled
    fireEvent.change(screen.getByLabelText('Service Name *'), {
      target: { value: 'Test Service' }
    });
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

    vi.mocked(centralizedApiMock.updateAppointmentService).mockResolvedValue(mockUpdatedService);

    render(
      <TestWrapper>
        <AppointmentDrawer open={true} onClose={() => {}} id="apt-123" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Appointment')).toBeInTheDocument();
    });

    // Switch to Services tab
    fireEvent.click(screen.getByRole('tab', { name: 'Services' }));

    // Click edit button for the first service
    fireEvent.click(screen.getByTestId('edit-service-svc-1'));

    // Modify the service
    const nameInput = screen.getByDisplayValue('Oil Change');
    fireEvent.change(nameInput, { target: { value: 'Premium Oil Change' } });

    const notesInput = screen.getByDisplayValue('Full synthetic oil');
    fireEvent.change(notesInput, { target: { value: 'Full synthetic premium oil' } });

    const hoursInput = screen.getByDisplayValue('1');
    fireEvent.change(hoursInput, { target: { value: '1.5' } });

    const priceInput = screen.getByDisplayValue('75');
    fireEvent.change(priceInput, { target: { value: '95.00' } });

    // Save changes
    fireEvent.click(screen.getByTestId('save-edit-service-svc-1'));

    await waitFor(() => {
      expect(api.updateAppointmentService).toHaveBeenCalledWith('apt-123', 'svc-1', {
        name: 'Premium Oil Change',
        notes: 'Full synthetic premium oil',
        estimated_hours: 1.5,
        estimated_price: 95.00,
        category: 'Maintenance'
      });
    });

    // Check if the service is updated
    await waitFor(() => {
      expect(screen.getByText('Premium Oil Change')).toBeInTheDocument();
      expect(screen.getByText('Total: $170.00')).toBeInTheDocument();
    });
  });

  test('deletes a service with confirmation', async () => {
    const mockDeleteResponse = {
      message: 'Service deleted successfully',
      appointment_total: 75.00
    };

    vi.mocked(centralizedApiMock.deleteAppointmentService).mockResolvedValue(mockDeleteResponse);

    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <TestWrapper>
        <AppointmentDrawer open={true} onClose={() => {}} id="apt-123" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Appointment')).toBeInTheDocument();
    });

    // Switch to Services tab
    fireEvent.click(screen.getByRole('tab', { name: 'Services' }));

    // Click delete button for the first service
    fireEvent.click(screen.getByTestId('delete-service-svc-1'));

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete this service?');

    await waitFor(() => {
      expect(api.deleteAppointmentService).toHaveBeenCalledWith('apt-123', 'svc-1');
    });

    // Check if total is updated
    await waitFor(() => {
      expect(screen.getByTestId('services-total')).toHaveTextContent('Total: $75.00');
    });

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

    await waitFor(() => {
      expect(screen.getByText('Appointment')).toBeInTheDocument();
    });

    // Switch to Services tab
    fireEvent.click(screen.getByRole('tab', { name: 'Services' }));

    // Click delete button for the first service
    fireEvent.click(screen.getByTestId('delete-service-svc-1'));

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete this service?');
    expect(api.deleteAppointmentService).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  test('handles API errors gracefully', async () => {
    vi.mocked(centralizedApiMock.createAppointmentService).mockRejectedValue(new Error('Network error'));

    render(
      <TestWrapper>
        <AppointmentDrawer open={true} onClose={() => {}} id="apt-123" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Appointment')).toBeInTheDocument();
    });

    // Switch to Services tab and add a service
    fireEvent.click(screen.getByRole('tab', { name: 'Services' }));
    fireEvent.click(screen.getByTestId('add-service-button'));

    fireEvent.change(screen.getByLabelText('Service Name *'), {
      target: { value: 'Test Service' }
    });

    fireEvent.click(screen.getByTestId('add-service-submit-button'));

    await waitFor(() => {
      expect(api.handleApiError).toHaveBeenCalled();
    });
  });

  test('validates numeric inputs', async () => {
    render(
      <TestWrapper>
        <AppointmentDrawer open={true} onClose={() => {}} id="apt-123" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Appointment')).toBeInTheDocument();
    });

    // Switch to Services tab
    fireEvent.click(screen.getByRole('tab', { name: 'Services' }));
    fireEvent.click(screen.getByTestId('add-service-button'));

    // Enter invalid hours
    fireEvent.change(screen.getByLabelText('Service Name *'), {
      target: { value: 'Test Service' }
    });
    fireEvent.change(screen.getByLabelText('Hours'), {
      target: { value: 'invalid' }
    });

    fireEvent.click(screen.getByTestId('add-service-submit-button'));

    // Should not call API with invalid data
    expect(api.createAppointmentService).not.toHaveBeenCalled();
  });

  test('shows empty state when no services exist', async () => {
    const emptyData = {
      ...mockDrawerData,
      services: []
    };
    vi.mocked(centralizedApiMock.getDrawer).mockResolvedValue(emptyData);

    render(
      <TestWrapper>
        <AppointmentDrawer open={true} onClose={() => {}} id="apt-123" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Appointment')).toBeInTheDocument();
    });

    // Switch to Services tab
    fireEvent.click(screen.getByRole('tab', { name: 'Services' }));

    await waitFor(() => {
      expect(screen.getByText('No services added yet.')).toBeInTheDocument();
      expect(screen.getByText('Add your first service')).toBeInTheDocument();
    });
  });
});
