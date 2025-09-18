import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppointmentHistory } from '@/components/admin/AppointmentHistory';
import type { Appointment, Vehicle } from '@/types/customerProfile';

const mockVehicles: Vehicle[] = [
  {
    id: 'vehicle-1',
    year: 2020,
    make: 'Toyota',
    model: 'Camry',
    plate: 'ABC123',
    vin: '1234567890ABCDEFG',
    notes: 'Primary vehicle'
  },
  {
    id: 'vehicle-2',
    year: 2018,
    make: 'Honda',
    model: 'Civic',
    plate: 'XYZ789',
    vin: 'ABCDEFG1234567890',
    notes: null
  }
];

const mockAppointments: Appointment[] = [
  {
    id: 'appt-1',
    vehicle_id: 'vehicle-1',
    scheduled_at: '2024-01-15T10:00:00Z',
    status: 'completed',
    services: [
      { service_id: 'svc-1', name: 'Oil Change', display_order: 1 },
      { service_id: 'svc-2', name: 'Tire Rotation', display_order: 2 }
    ],
    invoice: { id: 'inv-1', total: 85.00, paid: 85.00, unpaid: 0 },
    technician_name: 'John Smith'
  },
  {
    id: 'appt-2',
    vehicle_id: 'vehicle-2',
    scheduled_at: '2024-02-01T14:00:00Z',
    status: 'scheduled',
    services: [
      { service_id: 'svc-3', name: 'Brake Inspection', display_order: 1 }
    ],
    technician_name: 'Jane Doe'
  },
  {
    id: 'appt-3',
    vehicle_id: 'vehicle-1',
    scheduled_at: '2024-01-10T13:00:00Z',
    status: 'in-progress',
    services: [
      { service_id: 'svc-4', name: 'Engine Diagnostic', display_order: 1 }
    ],
    invoice: { id: 'inv-3', total: 150.00, paid: 50.00, unpaid: 100.00 },
    technician_name: 'Mike Johnson'
  }
];

describe('AppointmentHistory', () => {
  it('renders appointment history with correct count', () => {
    render(
      <AppointmentHistory
        appointments={mockAppointments}
        vehicles={mockVehicles}
      />
    );

    expect(screen.getByTestId('appointments-count')).toHaveTextContent('3 appointments');
    expect(screen.getByTestId('completed-count')).toHaveTextContent('1 completed');
  });

  it('displays summary statistics correctly', () => {
    render(
      <AppointmentHistory
        appointments={mockAppointments}
        vehicles={mockVehicles}
      />
    );

    expect(screen.getByTestId('total-revenue')).toHaveTextContent('• $235');
    expect(screen.getByTestId('unpaid-total')).toHaveTextContent('• $100 due');
  });

  it('renders all appointment cards', () => {
    render(
      <AppointmentHistory
        appointments={mockAppointments}
        vehicles={mockVehicles}
      />
    );

    const appointmentCards = screen.getAllByTestId('appointment-history-card');
    expect(appointmentCards).toHaveLength(3);
  });

  it('shows loading state correctly', () => {
    render(
      <AppointmentHistory
        appointments={[]}
        vehicles={[]}
        isLoading={true}
      />
    );

    expect(screen.getByTestId('appointment-history-loading')).toBeInTheDocument();
  });

  it('shows empty state when no appointments', () => {
    render(
      <AppointmentHistory
        appointments={[]}
        vehicles={mockVehicles}
      />
    );

    expect(screen.getByTestId('appointment-history-empty')).toBeInTheDocument();
    expect(screen.getByText('No appointments yet')).toBeInTheDocument();
  });

  it('filters appointments by search term', () => {
    render(
      <AppointmentHistory
        appointments={mockAppointments}
        vehicles={mockVehicles}
      />
    );

    const searchInput = screen.getByTestId('appointment-search');
    fireEvent.change(searchInput, { target: { value: 'oil change' } });

    // Should show filtered result count
    expect(screen.getByText('Showing 1 of 3 appointments')).toBeInTheDocument();
  });

  it('filters appointments by status', () => {
    render(
      <AppointmentHistory
        appointments={mockAppointments}
        vehicles={mockVehicles}
      />
    );

    const statusFilter = screen.getByTestId('status-filter');
    fireEvent.change(statusFilter, { target: { value: 'completed' } });

    expect(screen.getByText('Showing 1 of 3 appointments')).toBeInTheDocument();
  });

  it('clears filters when clear button is clicked', () => {
    render(
      <AppointmentHistory
        appointments={mockAppointments}
        vehicles={mockVehicles}
      />
    );

    // Apply filters
    const searchInput = screen.getByTestId('appointment-search');
    fireEvent.change(searchInput, { target: { value: 'oil' } });

    const statusFilter = screen.getByTestId('status-filter');
    fireEvent.change(statusFilter, { target: { value: 'completed' } });

    // Clear filters
    fireEvent.click(screen.getByTestId('clear-filters-btn'));

    expect(searchInput).toHaveValue('');
    expect(statusFilter).toHaveValue('all');
  });

  it('shows no results message when filters match nothing', () => {
    render(
      <AppointmentHistory
        appointments={mockAppointments}
        vehicles={mockVehicles}
      />
    );

    const searchInput = screen.getByTestId('appointment-search');
    fireEvent.change(searchInput, { target: { value: 'nonexistent service' } });

    expect(screen.getByText('No appointments match your filters')).toBeInTheDocument();
    expect(screen.getByTestId('clear-filters-no-results')).toBeInTheDocument();
  });

  it('calls onFetchNextPage when load more is clicked', () => {
    const mockOnFetchNextPage = vi.fn();

    render(
      <AppointmentHistory
        appointments={mockAppointments}
        vehicles={mockVehicles}
        hasNextPage={true}
        onFetchNextPage={mockOnFetchNextPage}
      />
    );

    fireEvent.click(screen.getByTestId('load-more-btn'));
    expect(mockOnFetchNextPage).toHaveBeenCalled();
  });

  it('shows loading indicator when fetching next page', () => {
    render(
      <AppointmentHistory
        appointments={mockAppointments}
        vehicles={mockVehicles}
        isFetchingNextPage={true}
      />
    );

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('calls invoice action handlers correctly', () => {
    const mockOnViewInvoice = vi.fn();
    const mockOnDownloadInvoice = vi.fn();
    const mockOnEmailInvoice = vi.fn();

    render(
      <AppointmentHistory
        appointments={mockAppointments}
        vehicles={mockVehicles}
        onViewInvoice={mockOnViewInvoice}
        onDownloadInvoice={mockOnDownloadInvoice}
        onEmailInvoice={mockOnEmailInvoice}
      />
    );

    // Find the completed appointment card and click view invoice
    const viewInvoiceButtons = screen.getAllByTestId('view-invoice-btn');
    if (viewInvoiceButtons.length > 0) {
      fireEvent.click(viewInvoiceButtons[0]);
      expect(mockOnViewInvoice).toHaveBeenCalled();
    }
  });

  it('matches vehicles correctly with appointments', () => {
    render(
      <AppointmentHistory
        appointments={mockAppointments}
        vehicles={mockVehicles}
      />
    );

    // Check that vehicle information is displayed correctly (using getAllByText for multiple occurrences)
    expect(screen.getAllByText('2020 Toyota Camry')).toHaveLength(2); // Two appointments for vehicle-1
    expect(screen.getByText('2018 Honda Civic')).toBeInTheDocument(); // One appointment for vehicle-2
  });

  it('handles appointments with missing vehicle gracefully', () => {
    const appointmentWithMissingVehicle: Appointment[] = [
      {
        id: 'appt-orphan',
        vehicle_id: 'missing-vehicle-id',
        scheduled_at: '2024-01-20T10:00:00Z',
        status: 'scheduled',
        services: [
          { service_id: 'svc-5', name: 'Mystery Service', display_order: 1 }
        ]
      }
    ];

    render(
      <AppointmentHistory
        appointments={appointmentWithMissingVehicle}
        vehicles={mockVehicles}
      />
    );

    expect(screen.getByText('Unknown Vehicle')).toBeInTheDocument();
  });

  it('calculates and displays statistics correctly', () => {
    render(
      <AppointmentHistory
        appointments={mockAppointments}
        vehicles={mockVehicles}
      />
    );

    // Should show 1 completed out of 3 total
    expect(screen.getByTestId('completed-count')).toHaveTextContent('1 completed');
    expect(screen.getByTestId('appointments-count')).toHaveTextContent('3 appointments');

    // Total revenue: 85 + 0 + 150 = 235
    expect(screen.getByTestId('total-revenue')).toHaveTextContent('$235');

    // Unpaid: 0 + 0 + 100 = 100
    expect(screen.getByTestId('unpaid-total')).toHaveTextContent('$100 due');
  });

  it('searches across multiple fields', () => {
    render(
      <AppointmentHistory
        appointments={mockAppointments}
        vehicles={mockVehicles}
      />
    );

    const searchInput = screen.getByTestId('appointment-search');

    // Search by service name
    fireEvent.change(searchInput, { target: { value: 'brake' } });
    expect(screen.getByText('Showing 1 of 3 appointments')).toBeInTheDocument();

    // Search by vehicle make
    fireEvent.change(searchInput, { target: { value: 'toyota' } });
    expect(screen.getByText('Showing 2 of 3 appointments')).toBeInTheDocument();

    // Search by technician name
    fireEvent.change(searchInput, { target: { value: 'jane' } });
    expect(screen.getByText('Showing 1 of 3 appointments')).toBeInTheDocument();
  });
});
