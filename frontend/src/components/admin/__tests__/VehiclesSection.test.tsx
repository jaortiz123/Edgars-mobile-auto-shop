import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VehiclesSection } from '../VehiclesSection';
import type { Vehicle, Appointment } from '@/types/customerProfile';

// Mock the VehicleCard component
vi.mock('../VehicleCard', () => ({
  VehicleCard: ({ vehicle, onAddAppointment, onEditVehicle }: any) => (
    <div data-testid={`vehicle-card-${vehicle.id}`}>
      <div>Vehicle: {vehicle.year} {vehicle.make} {vehicle.model}</div>
      <button onClick={() => onAddAppointment?.(vehicle.id)}>Book Service</button>
      <button onClick={() => onEditVehicle?.(vehicle.id)}>Edit</button>
    </div>
  )
}));

const mockVehicles: Vehicle[] = [
  {
    id: 'vehicle-1',
    year: 2020,
    make: 'Toyota',
    model: 'Camry',
    plate: 'ABC123',
    vin: '1234567890',
    notes: null
  },
  {
    id: 'vehicle-2',
    year: 2018,
    make: 'Honda',
    model: 'Accord',
    plate: 'XYZ789',
    vin: '0987654321',
    notes: null
  },
  {
    id: 'vehicle-3',
    year: 2022,
    make: 'Ford',
    model: 'F-150',
    plate: 'DEF456',
    vin: '1357924680',
    notes: null
  }
];

const mockAppointments: Appointment[] = [
  {
    id: 'apt-1',
    vehicle_id: 'vehicle-1',
    scheduled_at: '2023-12-01T10:00:00Z',
    status: 'completed',
    services: [{ service_id: 'service-1', name: 'Oil Change', display_order: 1 }],
    invoice: { id: 'inv-1', total: 50, paid: 50, unpaid: 0 },
    completed_at: '2023-12-01T11:00:00Z'
  },
  {
    id: 'apt-2',
    vehicle_id: 'vehicle-2',
    scheduled_at: '2023-01-01T10:00:00Z', // Old appointment - overdue
    status: 'completed',
    services: [{ service_id: 'service-2', name: 'Brake Service', display_order: 1 }],
    invoice: { id: 'inv-2', total: 100, paid: 100, unpaid: 0 },
    completed_at: '2023-01-01T11:00:00Z'
  },
  {
    id: 'apt-3',
    vehicle_id: 'vehicle-3',
    scheduled_at: '2023-11-01T10:00:00Z',
    status: 'scheduled',
    services: [{ service_id: 'service-3', name: 'Inspection', display_order: 1 }],
    invoice: null
  }
];

describe('VehiclesSection', () => {
  const defaultProps = {
    vehicles: mockVehicles,
    appointments: mockAppointments,
    onAddVehicle: vi.fn(),
    onEditVehicle: vi.fn(),
    onAddAppointment: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders section header with vehicle count', () => {
    render(<VehiclesSection {...defaultProps} />);

    expect(screen.getByText('Vehicles (3)')).toBeInTheDocument();
    expect(screen.getByText('Manage customer vehicles and service history')).toBeInTheDocument();
  });

  it('displays Add Vehicle button and calls handler', () => {
    const mockAddVehicle = vi.fn();
    render(<VehiclesSection {...defaultProps} onAddVehicle={mockAddVehicle} />);

    fireEvent.click(screen.getByText('Add Vehicle'));

    expect(mockAddVehicle).toHaveBeenCalled();
  });

  it('displays summary statistics correctly', () => {
    render(<VehiclesSection {...defaultProps} />);

    // Check that summary stats are shown with total count
    expect(screen.getByText('3')).toBeInTheDocument(); // Total vehicles count
    expect(screen.getByText('Total')).toBeInTheDocument();

    // Summary stats grid should be visible with color-coded sections
    const summaryGrid = document.querySelector('.grid.grid-cols-4');
    expect(summaryGrid).toBeInTheDocument();
  });

  it('renders all vehicle cards', () => {
    render(<VehiclesSection {...defaultProps} />);

    expect(screen.getByTestId('vehicle-card-vehicle-1')).toBeInTheDocument();
    expect(screen.getByTestId('vehicle-card-vehicle-2')).toBeInTheDocument();
    expect(screen.getByTestId('vehicle-card-vehicle-3')).toBeInTheDocument();

    expect(screen.getByText('Vehicle: 2020 Toyota Camry')).toBeInTheDocument();
    expect(screen.getByText('Vehicle: 2018 Honda Accord')).toBeInTheDocument();
    expect(screen.getByText('Vehicle: 2022 Ford F-150')).toBeInTheDocument();
  });

  it('filters vehicles by search term', () => {
    render(<VehiclesSection {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search vehicles by make, model, plate, or VIN...');

    // Search for Toyota
    fireEvent.change(searchInput, { target: { value: 'Toyota' } });

    expect(screen.getByTestId('vehicle-card-vehicle-1')).toBeInTheDocument();
    expect(screen.queryByTestId('vehicle-card-vehicle-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('vehicle-card-vehicle-3')).not.toBeInTheDocument();
  });

  it('searches by license plate', () => {
    render(<VehiclesSection {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search vehicles by make, model, plate, or VIN...');

    fireEvent.change(searchInput, { target: { value: 'ABC123' } });

    expect(screen.getByTestId('vehicle-card-vehicle-1')).toBeInTheDocument();
    expect(screen.queryByTestId('vehicle-card-vehicle-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('vehicle-card-vehicle-3')).not.toBeInTheDocument();
  });

  it('searches by VIN', () => {
    render(<VehiclesSection {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search vehicles by make, model, plate, or VIN...');

    fireEvent.change(searchInput, { target: { value: '1357924680' } });

    expect(screen.queryByTestId('vehicle-card-vehicle-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('vehicle-card-vehicle-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('vehicle-card-vehicle-3')).toBeInTheDocument();
  });

  it('sorts vehicles by year', () => {
    render(<VehiclesSection {...defaultProps} />);

    const sortSelect = screen.getByLabelText('Sort vehicles by');
    fireEvent.change(sortSelect, { target: { value: 'year' } });

    // Should show newest first: 2022 Ford F-150, then 2020 Toyota Camry, then 2018 Honda Accord
    const vehicleCards = screen.getAllByTestId(/vehicle-card-/);
    expect(vehicleCards[0]).toHaveAttribute('data-testid', 'vehicle-card-vehicle-3');
    expect(vehicleCards[1]).toHaveAttribute('data-testid', 'vehicle-card-vehicle-1');
    expect(vehicleCards[2]).toHaveAttribute('data-testid', 'vehicle-card-vehicle-2');
  });

  it('sorts vehicles by make alphabetically', () => {
    render(<VehiclesSection {...defaultProps} />);

    const sortSelect = screen.getByLabelText('Sort vehicles by');
    fireEvent.change(sortSelect, { target: { value: 'make' } });

    // Should show alphabetically: Ford, Honda, Toyota
    const vehicleCards = screen.getAllByTestId(/vehicle-card-/);
    expect(vehicleCards[0]).toHaveAttribute('data-testid', 'vehicle-card-vehicle-3');
    expect(vehicleCards[1]).toHaveAttribute('data-testid', 'vehicle-card-vehicle-2');
    expect(vehicleCards[2]).toHaveAttribute('data-testid', 'vehicle-card-vehicle-1');
  });

  it('sorts vehicles by service count', () => {
    render(<VehiclesSection {...defaultProps} />);

    const sortSelect = screen.getByLabelText('Sort vehicles by');
    fireEvent.change(sortSelect, { target: { value: 'services' } });

    // Vehicles with most completed services first
    const vehicleCards = screen.getAllByTestId(/vehicle-card-/);
    expect(vehicleCards).toHaveLength(3);
  });

  it('filters vehicles by service status', () => {
    render(<VehiclesSection {...defaultProps} />);

    const filterSelect = screen.getByLabelText('Filter vehicles by service status');

    // Filter to show only overdue vehicles
    fireEvent.change(filterSelect, { target: { value: 'overdue' } });

    // Should show fewer vehicles (only overdue ones)
    const vehicleCards = screen.getAllByTestId(/vehicle-card-/);
    expect(vehicleCards.length).toBeLessThan(3);
  });

  it('shows empty state when no vehicles exist', () => {
    render(<VehiclesSection {...defaultProps} vehicles={[]} appointments={[]} />);

    expect(screen.getByText('No vehicles registered for this customer')).toBeInTheDocument();
    expect(screen.getByText('Add First Vehicle')).toBeInTheDocument();
  });

  it('shows empty state when search yields no results', () => {
    render(<VehiclesSection {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search vehicles by make, model, plate, or VIN...');
    fireEvent.change(searchInput, { target: { value: 'NonexistentBrand' } });

    expect(screen.getByText('No vehicles match your search criteria')).toBeInTheDocument();
  });

  it('forwards onAddAppointment calls from vehicle cards', () => {
    const mockAddAppointment = vi.fn();
    render(<VehiclesSection {...defaultProps} onAddAppointment={mockAddAppointment} />);

    const vehicleCard = screen.getByTestId('vehicle-card-vehicle-1');
    fireEvent.click(within(vehicleCard).getByText('Book Service'));

    expect(mockAddAppointment).toHaveBeenCalledWith('vehicle-1');
  });

  it('forwards onEditVehicle calls from vehicle cards', () => {
    const mockEditVehicle = vi.fn();
    render(<VehiclesSection {...defaultProps} onEditVehicle={mockEditVehicle} />);

    const vehicleCard = screen.getByTestId('vehicle-card-vehicle-1');
    fireEvent.click(within(vehicleCard).getByText('Edit'));

    expect(mockEditVehicle).toHaveBeenCalledWith('vehicle-1');
  });

  it('applies custom className', () => {
    const { container } = render(<VehiclesSection {...defaultProps} className="custom-class" />);

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('does not show summary stats when no vehicles exist', () => {
    render(<VehiclesSection {...defaultProps} vehicles={[]} appointments={[]} />);

    expect(screen.queryByText('Total')).not.toBeInTheDocument();
    expect(screen.queryByText('Current')).not.toBeInTheDocument();
  });

  it('does not show search and filters when no vehicles exist', () => {
    render(<VehiclesSection {...defaultProps} vehicles={[]} appointments={[]} />);

    expect(screen.queryByPlaceholderText('Search vehicles by make, model, plate, or VIN...')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Sort vehicles by')).not.toBeInTheDocument();
  });

  it('handles vehicles with missing data gracefully', () => {
    const vehiclesWithMissingData: Vehicle[] = [
      {
        id: 'vehicle-missing',
        year: null,
        make: null,
        model: null,
        plate: null,
        vin: null,
        notes: null
      }
    ];

    render(<VehiclesSection {...defaultProps} vehicles={vehiclesWithMissingData} />);

    expect(screen.getByTestId('vehicle-card-vehicle-missing')).toBeInTheDocument();
  });

  it('clears search when input is emptied', () => {
    render(<VehiclesSection {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search vehicles by make, model, plate, or VIN...');

    // Search for something
    fireEvent.change(searchInput, { target: { value: 'Toyota' } });
    expect(screen.queryByTestId('vehicle-card-vehicle-2')).not.toBeInTheDocument();

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByTestId('vehicle-card-vehicle-2')).toBeInTheDocument();
  });
});
