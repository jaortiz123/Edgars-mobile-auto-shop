/**
 * Sprint 7 T5: Enhanced Services CRUD Test - Refactored for userEvent
 * Demonstrates improved component isolation with proper async handling
 * Migrated from fireEvent to userEvent to eliminate act() warnings
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, test, expect, beforeEach, describe } from 'vitest';
import AppointmentDrawer from '../components/admin/AppointmentDrawer';
import { ToastProvider } from '../components/ui/Toast';

// Mock the API module before importing the component
vi.mock('@/lib/api', () => ({
  getDrawer: vi.fn(),
  createAppointmentService: vi.fn(),
  updateAppointmentService: vi.fn(),
  deleteAppointmentService: vi.fn(),
  handleApiError: vi.fn((error, defaultMessage) => defaultMessage)
}));

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
    status: 'SCHEDULED' as const,
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
      notes: 'Full synthetic oil change',
      estimated_hours: 1.0,
      estimated_price: 75.00,
      category: 'Maintenance'
    },
    {
      id: 'svc-2',
      appointment_id: 'apt-123',
      name: 'Tire Rotation',
      notes: 'Rotate all four tires',
      estimated_hours: 0.5,
      estimated_price: 50.00,
      category: 'Maintenance'
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

describe('Enhanced Services CRUD in AppointmentDrawer - userEvent Migration', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDrawer).mockResolvedValue(mockDrawerData);
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
    expect(screen.getByTestId('service-name-svc-2')).toHaveTextContent('Tire Rotation');
    expect(screen.getByTestId('service-notes-svc-1')).toHaveTextContent('Full synthetic oil change');
    expect(screen.getByTestId('service-hours-svc-1')).toHaveTextContent('1h');
    expect(screen.getByTestId('service-price-svc-1')).toHaveTextContent('$75.00');
  });

  test('adds a new service successfully with userEvent', async () => {
    const mockCreatedService = {
      service: {
        id: 'svc-3',
        appointment_id: 'apt-123',
        name: 'Brake Inspection',
        notes: 'Complete brake system check',
        estimated_hours: 0.5,
        estimated_price: 85.00,
        category: 'Inspection'
      },
      appointment_total: 235.00
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

    // Fill in the form using userEvent for better async handling
    const nameField = screen.getByLabelText('Service Name *');
    await user.clear(nameField);
    await user.type(nameField, 'Brake Inspection');
    
    const notesField = screen.getByLabelText('Notes');
    await user.clear(notesField);
    await user.type(notesField, 'Complete brake system check');
    
    const hoursField = screen.getByLabelText('Hours');
    await user.clear(hoursField);
    await user.type(hoursField, '0.5');
    
    const priceField = screen.getByLabelText('Price ($)');
    await user.clear(priceField);
    await user.type(priceField, '85.00');
    
    const categoryField = screen.getByLabelText('Category');
    await user.clear(categoryField);
    await user.type(categoryField, 'Inspection');

    // Submit the form
    await user.click(screen.getByTestId('add-service-submit-button'));

    await waitFor(() => {
      expect(createAppointmentService).toHaveBeenCalledWith('apt-123', {
        name: 'Brake Inspection',
        notes: 'Complete brake system check',
        estimated_hours: 0.5,
        estimated_price: 85.00,
        category: 'Inspection'
      });
    });

    // Check if the new service appears in the list
    expect(await screen.findByTestId('service-name-svc-3')).toHaveTextContent('Brake Inspection');
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

    // Try to submit without required fields
    const addButton = screen.getByTestId('add-service-submit-button');
    expect(addButton).toBeDisabled();

    // Add name and verify button is enabled
    await user.type(screen.getByLabelText('Service Name *'), 'Test Service');
    expect(addButton).not.toBeDisabled();
  });

  test('edits an existing service with userEvent', async () => {
    const mockUpdatedService = {
      service: {
        id: 'svc-1',
        appointment_id: 'apt-123',
        name: 'Premium Oil Change',
        notes: 'Updated notes',
        estimated_hours: 1.5,
        estimated_price: 95.00,
        category: 'Maintenance'
      },
      appointment_total: 145.00
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

    // Wait for edit form to appear and modify the service fields
    const nameInput = screen.getByLabelText('Service name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Premium Oil Change');

    const notesInput = screen.getByLabelText('Notes');
    await user.clear(notesInput);
    await user.type(notesInput, 'Updated notes');

    const hoursInput = screen.getByLabelText('Hours');
    await user.clear(hoursInput);
    await user.type(hoursInput, '1.5');

    const priceInput = screen.getByLabelText('Price');
    await user.clear(priceInput);
    await user.type(priceInput, '95.00');

    // Save changes
    await user.click(screen.getByTestId('save-edit-service-svc-1'));

    await waitFor(() => {
      expect(updateAppointmentService).toHaveBeenCalledWith('apt-123', 'svc-1', {
        name: 'Premium Oil Change',
        notes: 'Updated notes',
        estimated_hours: 1.5,
        estimated_price: 95.00,
        category: 'Maintenance'
      });
    });

    // Check if the service is updated
    expect(await screen.findByText('Premium Oil Change')).toBeInTheDocument();
  });

  test('deletes a service with confirmation using userEvent', async () => {
    const mockDeleteResponse = {
      message: 'Service deleted successfully',
      appointment_total: 50.00
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

  test('validates numeric inputs properly', async () => {
    render(
      <TestWrapper>
        <AppointmentDrawer open={true} onClose={() => {}} id="apt-123" />
      </TestWrapper>
    );

    expect(await screen.findByText('Appointment')).toBeInTheDocument();

    // Switch to Services tab
    await user.click(screen.getByRole('tab', { name: 'Services' }));
    await user.click(screen.getByTestId('add-service-button'));

    // Enter invalid hours using userEvent
    await user.type(screen.getByLabelText('Service Name *'), 'Test Service');
    
    const hoursField = screen.getByLabelText('Hours');
    await user.clear(hoursField);
    await user.type(hoursField, 'invalid');

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

  test('handles concurrent operations with userEvent', async () => {
    render(
      <TestWrapper>
        <AppointmentDrawer open={true} onClose={() => {}} id="apt-123" />
      </TestWrapper>
    );

    expect(await screen.findByText('Appointment')).toBeInTheDocument();

    // Switch to Services tab
    await user.click(screen.getByRole('tab', { name: 'Services' }));

    // Start add operation
    await user.click(screen.getByTestId('add-service-button'));

    // Start edit operation on existing service
    await user.click(screen.getByTestId('edit-service-svc-1'));

    // Verify both forms can be accessed
    expect(screen.getByLabelText('Service Name *')).toBeInTheDocument(); // Add form
    expect(screen.getByLabelText('Service name')).toBeInTheDocument(); // Edit form
  });

  test('handles form clearing and reentry with userEvent', async () => {
    render(
      <TestWrapper>
        <AppointmentDrawer open={true} onClose={() => {}} id="apt-123" />
      </TestWrapper>
    );

    expect(await screen.findByText('Appointment')).toBeInTheDocument();

    // Switch to Services tab
    await user.click(screen.getByRole('tab', { name: 'Services' }));
    await user.click(screen.getByTestId('add-service-button'));

    // Enter initial data
    const nameField = screen.getByLabelText('Service Name *');
    await user.type(nameField, 'Initial Service');
    
    // Clear and re-enter using userEvent
    await user.clear(nameField);
    await user.type(nameField, 'Final Service Name');

    // Verify the field contains the final value
    expect(nameField).toHaveValue('Final Service Name');
  });

  test('handles keyboard navigation and accessibility', async () => {
    render(
      <TestWrapper>
        <AppointmentDrawer open={true} onClose={() => {}} id="apt-123" />
      </TestWrapper>
    );

    expect(await screen.findByText('Appointment')).toBeInTheDocument();

    // Test tab navigation using userEvent
    await user.tab();
    await user.tab();
    
    // Switch to Services tab with keyboard
    const servicesTab = screen.getByRole('tab', { name: 'Services' });
    await user.click(servicesTab);

    // Verify tab is accessible
    expect(servicesTab).toHaveAttribute('aria-selected', 'true');
  });
});
