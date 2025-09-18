import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VehicleCard } from '../VehicleCard';
import type { Vehicle, Appointment } from '@/types/customerProfile';

// Mock utilities
vi.mock('@/utils/format', () => ({
  money: (amount: number) => `$${amount.toFixed(2)}`,
  dtLocal: (date: string) => new Date(date).toLocaleDateString()
}));

const mockVehicle: Vehicle = {
  id: 'vehicle-1',
  year: 2020,
  make: 'Toyota',
  model: 'Camry',
  plate: 'ABC123',
  vin: '1234567890',
  notes: 'Regular maintenance vehicle'
};

const mockVehicleMinimal: Vehicle = {
  id: 'vehicle-2',
  year: null,
  make: null,
  model: null,
  plate: null,
  vin: null,
  notes: null
};

const mockAppointments: Appointment[] = [
  {
    id: 'apt-1',
    vehicle_id: 'vehicle-1',
    scheduled_at: '2023-12-01T10:00:00Z',
    status: 'completed',
    services: [
      { service_id: 'service-1', name: 'Oil Change', display_order: 1 },
      { service_id: 'service-2', name: 'Tire Rotation', display_order: 2 }
    ],
    invoice: { id: 'inv-1', total: 85.50, paid: 85.50, unpaid: 0 },
    technician_name: 'John Smith',
    completed_at: '2023-12-01T11:00:00Z'
  },
  {
    id: 'apt-2',
    vehicle_id: 'vehicle-1',
    scheduled_at: '2023-06-15T14:00:00Z',
    status: 'completed',
    services: [
      { service_id: 'service-3', name: 'Brake Service', display_order: 1 }
    ],
    invoice: { id: 'inv-2', total: 150.00, paid: 100.00, unpaid: 50.00 },
    technician_name: 'Jane Doe',
    completed_at: '2023-06-15T16:00:00Z'
  },
  {
    id: 'apt-3',
    vehicle_id: 'vehicle-2',
    scheduled_at: '2023-11-01T09:00:00Z',
    status: 'scheduled',
    services: [
      { service_id: 'service-4', name: 'Inspection', display_order: 1 }
    ],
    invoice: null
  }
];

describe('VehicleCard', () => {
  const defaultProps = {
    vehicle: mockVehicle,
    appointments: mockAppointments,
    onAddAppointment: vi.fn(),
    onEditVehicle: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders vehicle information correctly', () => {
    render(<VehicleCard {...defaultProps} />);

    expect(screen.getByText('2020 Toyota Camry')).toBeInTheDocument();
    expect(screen.getByText('ABC123')).toBeInTheDocument();
    expect(screen.getByText('1234567890')).toBeInTheDocument();
    expect(screen.getByText('Regular maintenance vehicle')).toBeInTheDocument();
  });

  it('handles minimal vehicle data gracefully', () => {
    render(<VehicleCard {...defaultProps} vehicle={mockVehicleMinimal} appointments={[]} />);

    expect(screen.getByText('Unknown Vehicle')).toBeInTheDocument();
    expect(screen.queryByText(/License:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/VIN:/)).not.toBeInTheDocument();
  });

  it('displays service statistics correctly', () => {
    render(<VehicleCard {...defaultProps} />);

    expect(screen.getByText('2')).toBeInTheDocument(); // Total services
    expect(screen.getByText('Services')).toBeInTheDocument();
    expect(screen.getByText('$235.50')).toBeInTheDocument(); // Total spent
    expect(screen.getByText('Total Spent')).toBeInTheDocument();
    expect(screen.getByText('Dec 2023')).toBeInTheDocument(); // Last service
    expect(screen.getByText('Last Service')).toBeInTheDocument();
  });

  it('shows overdue service alert for old vehicles', () => {
    const oldAppointments = [{
      ...mockAppointments[0],
      scheduled_at: '2023-01-01T10:00:00Z', // Over 6 months ago
      completed_at: '2023-01-01T11:00:00Z'
    }];

    render(<VehicleCard {...defaultProps} appointments={oldAppointments} />);

    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('shows due soon alert for vehicles approaching service', () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 160); // 160 days ago, due soon

    const recentAppointments = [{
      ...mockAppointments[0],
      scheduled_at: recentDate.toISOString(),
      completed_at: recentDate.toISOString()
    }];

    render(<VehicleCard {...defaultProps} appointments={recentAppointments} />);

    expect(screen.getByText('Due Soon')).toBeInTheDocument();
  });

  it('shows current status for recently serviced vehicles', () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 30); // 30 days ago, current

    const recentAppointments = [{
      ...mockAppointments[0],
      scheduled_at: recentDate.toISOString(),
      completed_at: recentDate.toISOString()
    }];

    render(<VehicleCard {...defaultProps} appointments={recentAppointments} />);

    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('calls onAddAppointment when Book Service is clicked', () => {
    const mockAddAppointment = vi.fn();
    render(<VehicleCard {...defaultProps} onAddAppointment={mockAddAppointment} />);

    fireEvent.click(screen.getByText('Book Service'));

    expect(mockAddAppointment).toHaveBeenCalledWith('vehicle-1');
  });

  it('calls onEditVehicle when Edit is clicked', () => {
    const mockEditVehicle = vi.fn();
    render(<VehicleCard {...defaultProps} onEditVehicle={mockEditVehicle} />);

    fireEvent.click(screen.getByText('Edit'));

    expect(mockEditVehicle).toHaveBeenCalledWith('vehicle-1');
  });

  it('expands and collapses service history', () => {
    render(<VehicleCard {...defaultProps} />);

    const expandButton = screen.getByText('View Service History (2)');
    expect(expandButton).toBeInTheDocument();

    // History should not be visible initially
    expect(screen.queryByText('Recent Services')).not.toBeInTheDocument();

    // Expand history
    fireEvent.click(expandButton);
    expect(screen.getByText('Recent Services')).toBeInTheDocument();
    expect(screen.getByText('Oil Change, Tire Rotation')).toBeInTheDocument();
    expect(screen.getByText('by John Smith')).toBeInTheDocument();

    // Collapse history
    fireEvent.click(screen.getByText('Hide Service History (2)'));
    expect(screen.queryByText('Recent Services')).not.toBeInTheDocument();
  });

  it('displays appointment details in service history', () => {
    render(<VehicleCard {...defaultProps} />);

    // Expand history
    fireEvent.click(screen.getByText('View Service History (2)'));

    // Check first appointment
    expect(screen.getByText('Oil Change, Tire Rotation')).toBeInTheDocument();
    expect(screen.getByText('$85.50')).toBeInTheDocument();
    expect(screen.getByText('by John Smith')).toBeInTheDocument();

    // Check second appointment with unpaid amount
    expect(screen.getByText('Brake Service')).toBeInTheDocument();
    expect(screen.getByText('$150.00')).toBeInTheDocument();
    expect(screen.getByText('$50 due')).toBeInTheDocument();
    expect(screen.getByText('by Jane Doe')).toBeInTheDocument();
  });

  it('shows limited service history with overflow indicator', () => {
    // Create 6 appointments to test the 5-item limit
    const manyAppointments = Array.from({ length: 6 }, (_, i) => ({
      ...mockAppointments[0],
      id: `apt-${i + 1}`,
      scheduled_at: `2023-${String(12 - i).padStart(2, '0')}-01T10:00:00Z`
    }));

    render(<VehicleCard {...defaultProps} appointments={manyAppointments} />);

    // Expand history
    fireEvent.click(screen.getByText('View Service History (6)'));

    expect(screen.getByText('+ 1 more services')).toBeInTheDocument();
  });

  it('handles vehicles with no service history', () => {
    render(<VehicleCard {...defaultProps} appointments={[]} />);

    expect(screen.getByText('0')).toBeInTheDocument(); // Total services
    expect(screen.getByText('$0.00')).toBeInTheDocument(); // Total spent
    expect(screen.getByText('Never')).toBeInTheDocument(); // Last service
    expect(screen.queryByText(/View Service History/)).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<VehicleCard {...defaultProps} className="custom-class" />);

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('handles appointments without technician information', () => {
    const appointmentWithoutTech = [{
      ...mockAppointments[0],
      technician_name: undefined
    }];

    render(<VehicleCard {...defaultProps} appointments={appointmentWithoutTech} />);

    // Expand history
    fireEvent.click(screen.getByText('View Service History (1)'));

    expect(screen.queryByText(/by /)).not.toBeInTheDocument();
  });

  it('handles appointments without services', () => {
    const appointmentWithoutServices = [{
      ...mockAppointments[0],
      services: []
    }];

    render(<VehicleCard {...defaultProps} appointments={appointmentWithoutServices} />);

    // Expand history
    fireEvent.click(screen.getByText('View Service History (1)'));

    expect(screen.getByText('No services listed')).toBeInTheDocument();
  });
});
