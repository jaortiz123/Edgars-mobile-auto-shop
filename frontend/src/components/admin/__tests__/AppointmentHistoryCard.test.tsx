import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppointmentHistoryCard } from '@/components/admin/AppointmentHistoryCard';
import type { Appointment, Vehicle } from '@/types/customerProfile';

const mockVehicle: Vehicle = {
  id: 'vehicle-1',
  year: 2020,
  make: 'Toyota',
  model: 'Camry',
  plate: 'ABC123',
  vin: '1234567890ABCDEFG',
  notes: 'Customer preferred vehicle'
};

const mockCompletedAppointment: Appointment = {
  id: 'appt-1',
  vehicle_id: 'vehicle-1',
  scheduled_at: '2024-01-15T10:00:00Z',
  status: 'completed',
  services: [
    { service_id: 'svc-1', name: 'Oil Change', display_order: 1 },
    { service_id: 'svc-2', name: 'Tire Rotation', display_order: 2 }
  ],
  invoice: {
    id: 'inv-1',
    total: 85.00,
    paid: 85.00,
    unpaid: 0
  },
  technician_name: 'John Smith',
  technician_id: 'tech-1',
  notes: 'Customer requested synthetic oil',
  mileage: 45000,
  completed_at: '2024-01-15T11:30:00Z',
  check_in_at: '2024-01-15T09:45:00Z',
  check_out_at: '2024-01-15T11:30:00Z',
  estimated_duration: 90
};

const mockScheduledAppointment: Appointment = {
  id: 'appt-2',
  vehicle_id: 'vehicle-1',
  scheduled_at: '2024-02-01T14:00:00Z',
  status: 'scheduled',
  services: [
    { service_id: 'svc-3', name: 'Brake Inspection', display_order: 1 }
  ],
  technician_name: 'Jane Doe',
  estimated_duration: 60
};

const mockAppointmentWithBalance: Appointment = {
  id: 'appt-3',
  vehicle_id: 'vehicle-1',
  scheduled_at: '2024-01-10T13:00:00Z',
  status: 'completed',
  services: [
    { service_id: 'svc-4', name: 'Engine Diagnostic', display_order: 1 }
  ],
  invoice: {
    id: 'inv-3',
    total: 150.00,
    paid: 50.00,
    unpaid: 100.00
  },
  technician_name: 'Mike Johnson'
};

describe('AppointmentHistoryCard', () => {
  it('renders basic appointment information', () => {
    render(
      <AppointmentHistoryCard
        appointment={mockCompletedAppointment}
        vehicle={mockVehicle}
      />
    );

    expect(screen.getByTestId('appointment-date')).toBeInTheDocument();
    expect(screen.getByTestId('appointment-status')).toHaveTextContent('Completed');
    expect(screen.getByTestId('appointment-vehicle')).toHaveTextContent('2020 Toyota Camry');
    expect(screen.getByTestId('appointment-services')).toHaveTextContent('Oil Change, Tire Rotation');
  });

  it('displays technician information when available', () => {
    render(
      <AppointmentHistoryCard
        appointment={mockCompletedAppointment}
        vehicle={mockVehicle}
      />
    );

    expect(screen.getByTestId('appointment-technician')).toHaveTextContent('Tech: John Smith');
  });

  it('shows mileage when available', () => {
    render(
      <AppointmentHistoryCard
        appointment={mockCompletedAppointment}
        vehicle={mockVehicle}
      />
    );

    expect(screen.getByTestId('appointment-mileage')).toHaveTextContent('Mileage: 45,000');
  });

  it('displays invoice information correctly', () => {
    render(
      <AppointmentHistoryCard
        appointment={mockCompletedAppointment}
        vehicle={mockVehicle}
      />
    );

    expect(screen.getByTestId('invoice-total')).toHaveTextContent('$85.00');
    expect(screen.getByTestId('invoice-paid')).toHaveTextContent('Paid: $85.00');
    expect(screen.queryByTestId('invoice-unpaid')).not.toBeInTheDocument();
  });

  it('shows unpaid balance when present', () => {
    render(
      <AppointmentHistoryCard
        appointment={mockAppointmentWithBalance}
        vehicle={mockVehicle}
      />
    );

    expect(screen.getByTestId('invoice-unpaid')).toHaveTextContent('Due: $100.00');
  });

  it('displays appropriate status badge and styling', () => {
    const { rerender } = render(
      <AppointmentHistoryCard
        appointment={mockCompletedAppointment}
        vehicle={mockVehicle}
      />
    );

    expect(screen.getByTestId('appointment-status')).toHaveTextContent('Completed');

    rerender(
      <AppointmentHistoryCard
        appointment={mockScheduledAppointment}
        vehicle={mockVehicle}
      />
    );

    expect(screen.getByTestId('appointment-status')).toHaveTextContent('Scheduled');
  });

  it('shows action buttons for completed appointments with invoices', () => {
    render(
      <AppointmentHistoryCard
        appointment={mockCompletedAppointment}
        vehicle={mockVehicle}
      />
    );

    expect(screen.getByTestId('view-invoice-btn')).toBeInTheDocument();
    expect(screen.getByTestId('download-invoice-btn')).toBeInTheDocument();
    expect(screen.getByTestId('email-invoice-btn')).toBeInTheDocument();
  });

  it('hides action buttons for scheduled appointments', () => {
    render(
      <AppointmentHistoryCard
        appointment={mockScheduledAppointment}
        vehicle={mockVehicle}
      />
    );

    expect(screen.queryByTestId('view-invoice-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('download-invoice-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('email-invoice-btn')).not.toBeInTheDocument();
  });

  it('calls onViewInvoice when view button is clicked', () => {
    const mockOnViewInvoice = vi.fn();

    render(
      <AppointmentHistoryCard
        appointment={mockCompletedAppointment}
        vehicle={mockVehicle}
        onViewInvoice={mockOnViewInvoice}
      />
    );

    fireEvent.click(screen.getByTestId('view-invoice-btn'));
    expect(mockOnViewInvoice).toHaveBeenCalledWith('appt-1');
  });

  it('calls onDownloadInvoice when download button is clicked', () => {
    const mockOnDownloadInvoice = vi.fn();

    render(
      <AppointmentHistoryCard
        appointment={mockCompletedAppointment}
        vehicle={mockVehicle}
        onDownloadInvoice={mockOnDownloadInvoice}
      />
    );

    fireEvent.click(screen.getByTestId('download-invoice-btn'));
    expect(mockOnDownloadInvoice).toHaveBeenCalledWith('appt-1');
  });

  it('opens email modal and calls onEmailInvoice', async () => {
    const mockOnEmailInvoice = vi.fn();

    render(
      <AppointmentHistoryCard
        appointment={mockCompletedAppointment}
        vehicle={mockVehicle}
        onEmailInvoice={mockOnEmailInvoice}
      />
    );

    // Open email modal
    fireEvent.click(screen.getByTestId('email-invoice-btn'));
    expect(screen.getByTestId('email-modal')).toBeInTheDocument();

    // Enter email and send
    const emailInput = screen.getByTestId('email-input');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByTestId('send-email-btn'));

    expect(mockOnEmailInvoice).toHaveBeenCalledWith('appt-1', 'test@example.com');
  });

  it('can cancel email modal', () => {
    render(
      <AppointmentHistoryCard
        appointment={mockCompletedAppointment}
        vehicle={mockVehicle}
      />
    );

    // Open email modal
    fireEvent.click(screen.getByTestId('email-invoice-btn'));
    expect(screen.getByTestId('email-modal')).toBeInTheDocument();

    // Cancel
    fireEvent.click(screen.getByTestId('cancel-email-btn'));
    expect(screen.queryByTestId('email-modal')).not.toBeInTheDocument();
  });

  it('shows details when toggle button is clicked', async () => {
    render(
      <AppointmentHistoryCard
        appointment={mockCompletedAppointment}
        vehicle={mockVehicle}
      />
    );

    // Should have toggle button since appointment has notes and timestamps
    const toggleBtn = screen.getByTestId('toggle-details-btn');
    expect(toggleBtn).toHaveTextContent('Show Details');

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveTextContent('Hide Details');

    // Details should be visible
    expect(screen.getByTestId('appointment-notes')).toHaveTextContent('Customer requested synthetic oil');
  });

  it('handles appointment without vehicle gracefully', () => {
    render(
      <AppointmentHistoryCard
        appointment={mockCompletedAppointment}
        vehicle={null}
      />
    );

    expect(screen.getByTestId('appointment-vehicle')).toHaveTextContent('Unknown Vehicle');
  });

  it('handles appointment without services', () => {
    const appointmentNoServices = {
      ...mockCompletedAppointment,
      services: []
    };

    render(
      <AppointmentHistoryCard
        appointment={appointmentNoServices}
        vehicle={mockVehicle}
      />
    );

    expect(screen.getByTestId('appointment-services')).toHaveTextContent('No services listed');
  });

  it('formats duration correctly', () => {
    render(
      <AppointmentHistoryCard
        appointment={mockCompletedAppointment}
        vehicle={mockVehicle}
      />
    );

    expect(screen.getByText('Duration: 1h 30m')).toBeInTheDocument();
  });

  it('displays vehicle plate when available', () => {
    render(
      <AppointmentHistoryCard
        appointment={mockCompletedAppointment}
        vehicle={mockVehicle}
      />
    );

    expect(screen.getByText('ABC123')).toBeInTheDocument();
  });
});
