import React, { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
// Using native select elements for now
import { VehicleCard } from './VehicleCard';
import type { Vehicle, Appointment } from '@/types/customerProfile';

interface VehiclesSectionProps {
  vehicles: Vehicle[];
  appointments: Appointment[];
  onAddVehicle?: () => void;
  onEditVehicle?: (vehicleId: string) => void;
  onAddAppointment?: (vehicleId: string) => void;
  className?: string;
}

type SortOption = 'recent' | 'year' | 'make' | 'services';
type FilterOption = 'all' | 'overdue' | 'due-soon' | 'current';

export function VehiclesSection({
  vehicles,
  appointments,
  onAddVehicle,
  onEditVehicle,
  onAddAppointment,
  className = ''
}: VehiclesSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');

  // Helper function to determine service alert status for a vehicle
  const getVehicleAlertStatus = (vehicle: Vehicle): FilterOption => {
    const vehicleAppointments = appointments
      .filter(apt => apt.vehicle_id === vehicle.id && apt.status === 'completed')
      .sort((a, b) => new Date(b.completed_at || b.scheduled_at || '').getTime() - new Date(a.completed_at || a.scheduled_at || '').getTime());

    const lastService = vehicleAppointments[0];
    if (!lastService) return 'current';

    const lastServiceDate = lastService.completed_at || lastService.scheduled_at;
    if (!lastServiceDate) return 'current';

    const daysSinceService = Math.floor((Date.now() - new Date(lastServiceDate).getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceService > 180) return 'overdue';
    if (daysSinceService > 150) return 'due-soon';
    return 'current';
  };

  // Filter and sort vehicles
  const processedVehicles = React.useMemo(() => {
    let filtered = vehicles;

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(vehicle => {
        const searchableText = [
          vehicle.year?.toString(),
          vehicle.make,
          vehicle.model,
          vehicle.plate,
          vehicle.vin,
          vehicle.notes
        ].filter(Boolean).join(' ').toLowerCase();

        return searchableText.includes(search);
      });
    }

    // Apply service status filter
    if (filterBy !== 'all') {
      filtered = filtered.filter(vehicle => {
        const status = getVehicleAlertStatus(vehicle);
        return status === filterBy;
      });
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'year':
          return (b.year || 0) - (a.year || 0);

        case 'make': {
          const makeA = a.make || '';
          const makeB = b.make || '';
          return makeA.localeCompare(makeB);
        }

        case 'services': {
          const servicesA = appointments.filter(apt => apt.vehicle_id === a.id && apt.status === 'completed').length;
          const servicesB = appointments.filter(apt => apt.vehicle_id === b.id && apt.status === 'completed').length;
          return servicesB - servicesA;
        }

        case 'recent':
        default: {
          const getLastServiceDate = (vehicleId: string) => {
            const vehicleAppointments = appointments
              .filter(apt => apt.vehicle_id === vehicleId)
              .sort((x, y) => new Date(y.scheduled_at || y.completed_at || '').getTime() - new Date(x.scheduled_at || x.completed_at || '').getTime());

            const latest = vehicleAppointments[0];
            return latest ? new Date(latest.scheduled_at || latest.completed_at || '').getTime() : 0;
          };

          return getLastServiceDate(b.id) - getLastServiceDate(a.id);
        }
      }
    });

    return sorted;
  }, [vehicles, appointments, searchTerm, sortBy, filterBy]);

  // Calculate summary statistics
  const summaryStats = React.useMemo(() => {
    const statusCounts = vehicles.reduce(
      (acc, vehicle) => {
        const status = getVehicleAlertStatus(vehicle);
        acc[status]++;
        return acc;
      },
      { overdue: 0, 'due-soon': 0, current: 0, all: vehicles.length }
    );

    return statusCounts;
  }, [vehicles, appointments]);

  return (
    <section className={`bg-card rounded-lg border ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Vehicles ({vehicles.length})</h3>
            <p className="text-sm text-muted-foreground">
              Manage customer vehicles and service history
            </p>
          </div>
          <Button onClick={onAddVehicle} className="flex items-center gap-2">
            <Plus size={16} />
            Add Vehicle
          </Button>
        </div>

        {/* Summary Stats */}
        {vehicles.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center p-2 bg-muted/30 rounded">
              <div className="font-medium text-lg">{summaryStats.all}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
              <div className="font-medium text-lg text-green-700 dark:text-green-400">{summaryStats.current}</div>
              <div className="text-xs text-muted-foreground">Current</div>
            </div>
            <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
              <div className="font-medium text-lg text-yellow-700 dark:text-yellow-400">{summaryStats['due-soon']}</div>
              <div className="text-xs text-muted-foreground">Due Soon</div>
            </div>
            <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
              <div className="font-medium text-lg text-red-700 dark:text-red-400">{summaryStats.overdue}</div>
              <div className="text-xs text-muted-foreground">Overdue</div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        {vehicles.length > 0 && (
          <div className="flex gap-2 items-center">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search vehicles by make, model, plate, or VIN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2 border border-input rounded-md bg-background text-foreground"
              aria-label="Sort vehicles by"
              title="Sort vehicles by"
            >
              <option value="recent">Recent Activity</option>
              <option value="year">Year (Newest)</option>
              <option value="make">Make (A-Z)</option>
              <option value="services">Most Services</option>
            </select>

            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as FilterOption)}
              className="px-3 py-2 border border-input rounded-md bg-background text-foreground"
              aria-label="Filter vehicles by service status"
              title="Filter vehicles by service status"
            >
              <option value="all">All Vehicles</option>
              <option value="overdue">Service Overdue</option>
              <option value="due-soon">Due Soon</option>
              <option value="current">Current</option>
            </select>
          </div>
        )}
      </div>

      {/* Vehicle Cards */}
      <div className="p-4">
        {processedVehicles.length === 0 ? (
          <div className="text-center py-8">
            {vehicles.length === 0 ? (
              <div>
                <div className="text-muted-foreground mb-4">No vehicles registered for this customer</div>
                <Button onClick={onAddVehicle} variant="outline">
                  Add First Vehicle
                </Button>
              </div>
            ) : (
              <div className="text-muted-foreground">
                No vehicles match your search criteria
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {processedVehicles.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                appointments={appointments}
                onAddAppointment={onAddAppointment}
                onEditVehicle={onEditVehicle}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
