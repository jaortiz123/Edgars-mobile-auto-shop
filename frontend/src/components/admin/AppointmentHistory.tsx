import { useState, useMemo } from 'react';
import { AppointmentHistoryCard } from './AppointmentHistoryCard';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type { Appointment, Vehicle } from '../../types/customerProfile';
import { Calendar, Filter, Search } from 'lucide-react';

interface AppointmentHistoryProps {
  appointments: Appointment[];
  vehicles: Vehicle[];
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  onFetchNextPage?: () => void;
  onViewInvoice?: (appointmentId: string) => void;
  onDownloadInvoice?: (appointmentId: string) => void;
  onEmailInvoice?: (appointmentId: string, email: string) => void;
  className?: string;
}

export function AppointmentHistory({
  appointments,
  vehicles,
  isLoading = false,
  isFetchingNextPage = false,
  hasNextPage = false,
  onFetchNextPage,
  onViewInvoice,
  onDownloadInvoice,
  onEmailInvoice,
  className = ''
}: AppointmentHistoryProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Create vehicle lookup map for performance
  const vehicleMap = useMemo(() => {
    const map = new Map<string, Vehicle>();
    vehicles.forEach(vehicle => {
      map.set(vehicle.id, vehicle);
    });
    return map;
  }, [vehicles]);

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter(appointment => {
      // Status filter
      if (statusFilter !== 'all' && appointment.status.toLowerCase() !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const vehicle = vehicleMap.get(appointment.vehicle_id);
        const vehicleText = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`.toLowerCase() : '';
        const servicesText = appointment.services.map(s => s.name).join(' ').toLowerCase();
        const technicianText = appointment.technician_name?.toLowerCase() || '';
        const notesText = appointment.notes?.toLowerCase() || '';

        return (
          vehicleText.includes(searchLower) ||
          servicesText.includes(searchLower) ||
          technicianText.includes(searchLower) ||
          notesText.includes(searchLower)
        );
      }

      return true;
    });
  }, [appointments, statusFilter, searchTerm, vehicleMap]);

  // Get unique statuses for filter options
  const availableStatuses = useMemo(() => {
    const statusSet = new Set(appointments.map(a => a.status.toLowerCase()));
    return Array.from(statusSet).sort();
  }, [appointments]);

  // Summary stats
  const stats = useMemo(() => {
    const total = appointments.length;
    const completed = appointments.filter(a => a.status.toLowerCase() === 'completed').length;
    const totalRevenue = appointments.reduce((sum, a) => sum + (a.invoice?.total || 0), 0);
    const unpaidTotal = appointments.reduce((sum, a) => sum + (a.invoice?.unpaid || 0), 0);

    return { total, completed, totalRevenue, unpaidTotal };
  }, [appointments]);

  if (isLoading && appointments.length === 0) {
    return (
      <div className={`space-y-4 ${className}`} data-testid="appointment-history-loading">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Appointment History</h3>
        </div>
        {/* Loading skeletons */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-300 rounded w-32"></div>
                  <div className="h-3 bg-gray-300 rounded w-24"></div>
                  <div className="h-3 bg-gray-300 rounded w-48"></div>
                </div>
                <div className="h-6 bg-gray-300 rounded w-20"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className={`${className}`} data-testid="appointment-history-empty">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Appointment History</h3>
        </div>
        <div className="text-center py-12 text-gray-500">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium mb-2">No appointments yet</p>
          <p className="text-sm">Appointments will appear here once they're scheduled.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`} data-testid="appointment-history">
      {/* Header and Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Appointment History</h3>
          <Badge variant="outline" data-testid="appointments-count">
            {stats.total} {stats.total === 1 ? 'appointment' : 'appointments'}
          </Badge>
        </div>

        {/* Quick stats */}
        <div className="flex flex-wrap gap-2 text-sm text-gray-600">
          <span data-testid="completed-count">{stats.completed} completed</span>
          {stats.totalRevenue > 0 && (
            <span data-testid="total-revenue">• ${stats.totalRevenue.toLocaleString()}</span>
          )}
          {stats.unpaidTotal > 0 && (
            <span className="text-red-600" data-testid="unpaid-total">
              • ${stats.unpaidTotal.toLocaleString()} due
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search appointments, vehicles, services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border rounded-md text-sm"
            data-testid="appointment-search"
          />
        </div>

        {/* Status filter */}
        {availableStatuses.length > 1 && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-md text-sm bg-white"
              data-testid="status-filter"
              aria-label="Filter appointments by status"
              title="Filter appointments by status"
            >
              <option value="all">All Statuses</option>
              {availableStatuses.map(status => (
                <option key={status} value={status}>
                  {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Results info */}
      {(searchTerm || statusFilter !== 'all') && (
        <div className="text-sm text-gray-600">
          Showing {filteredAppointments.length} of {appointments.length} appointments
          {filteredAppointments.length !== appointments.length && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
              }}
              className="ml-2 text-blue-600 hover:text-blue-800 underline"
              data-testid="clear-filters-btn"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Appointment Cards */}
      <div className="space-y-4" data-testid="appointments-list">
        {filteredAppointments.map((appointment) => {
          const vehicle = vehicleMap.get(appointment.vehicle_id);
          return (
            <AppointmentHistoryCard
              key={appointment.id}
              appointment={appointment}
              vehicle={vehicle}
              onViewInvoice={onViewInvoice}
              onDownloadInvoice={onDownloadInvoice}
              onEmailInvoice={onEmailInvoice}
            />
          );
        })}

        {/* Loading more indicator */}
        {isFetchingNextPage && (
          <div className="animate-pulse">
            <div className="bg-gray-200 rounded-lg p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-300 rounded w-32"></div>
                  <div className="h-3 bg-gray-300 rounded w-24"></div>
                  <div className="h-3 bg-gray-300 rounded w-48"></div>
                </div>
                <div className="h-6 bg-gray-300 rounded w-20"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Load More Button */}
      {hasNextPage && !isFetchingNextPage && (
        <div className="text-center pt-4">
          <Button
            onClick={onFetchNextPage}
            variant="outline"
            disabled={isFetchingNextPage}
            data-testid="load-more-btn"
          >
            Load More Appointments
          </Button>
        </div>
      )}

      {/* No results after filtering */}
      {filteredAppointments.length === 0 && appointments.length > 0 && (
        <div className="text-center py-8 text-gray-500">
          <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="font-medium">No appointments match your filters</p>
          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
            }}
            className="mt-2 text-blue-600 hover:text-blue-800 underline text-sm"
            data-testid="clear-filters-no-results"
          >
            Clear filters to see all appointments
          </button>
        </div>
      )}
    </div>
  );
}
