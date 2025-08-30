import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { Plus, Calendar, Clock, DollarSign, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { useCustomerProfileInfinite } from '@/hooks/useCustomerProfileInfinite';
import { useVehicleMutations, type VehicleCreateData, type VehicleUpdateData } from '@/hooks/useVehicleMutations';
import { VehicleModal } from '@/components/VehicleModal';
import { DeleteVehicleModal } from '@/components/DeleteVehicleModal';
import { money, dtLocal } from '@/utils/format';
import type { Vehicle, ProfileStats, Appointment, CustomerProfile } from '@/types/customerProfile';

/**
 * Customer Profile Foundation Page
 *
 * A clean, foundational implementation focusing on:
 * - Stats Tiles section with key metrics
 * - Vehicles List section with filtering capability
 * - Loading skeletons and empty states
 * - ETag/304 caching through enhanced useCustomerProfileInfinite hook
 */
export default function CustomerProfileFoundation() {
  const { id } = useParams<{ id: string }>();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>();

  // Vehicle modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);

  // Use enhanced hook with ETag/304 caching
  const {
    data,
    isLoading,
    isFetchingNextPage,
    error,
    hasNextPage,
    fetchNextPage,
  } = useCustomerProfileInfinite(id || '', {
    vehicleId: selectedVehicleId,
    includeInvoices: true,
    pageSize: 25,
  });

  // Vehicle mutations hook
  const {
    createVehicle,
    updateVehicle,
    deleteVehicle,
  } = useVehicleMutations(id || '');

  // Extract data from first page
  const firstPage = data?.pages?.[0];
  const customer = firstPage?.customer;
  const stats = firstPage?.stats;
  const vehicles = firstPage?.vehicles || [];

  // Handler functions
  const handleAddVehicle = async (vehicleData: Omit<VehicleCreateData, 'customer_id'>) => {
    try {
      await createVehicle.mutateAsync(vehicleData);
      setShowAddModal(false);
    } catch (error) {
      // Error is handled by the hook and displayed in modal
      console.error('Failed to create vehicle:', error);
    }
  };

  const handleEditVehicle = async (vehicleData: VehicleUpdateData) => {
    if (!editingVehicle?.id) return;

    try {
      await updateVehicle.mutateAsync({
        vehicleId: editingVehicle.id,
        data: vehicleData,
      });
      setEditingVehicle(null);
    } catch (error) {
      // Error is handled by the hook and displayed in modal
      console.error('Failed to update vehicle:', error);
    }
  };

  const handleDeleteVehicle = async () => {
    if (!deletingVehicle?.id) return;

    try {
      await deleteVehicle.mutateAsync(deletingVehicle.id);
      setDeletingVehicle(null);
      // Clear selection if deleted vehicle was selected
      if (selectedVehicleId === deletingVehicle.id) {
        setSelectedVehicleId(undefined);
      }
    } catch (error) {
      // Error is handled by the hook and displayed in modal
      console.error('Failed to delete vehicle:', error);
    }
  };

  const startEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
  };

  const startDeleteVehicle = (vehicle: Vehicle) => {
    setDeletingVehicle(vehicle);
  };

  if (!id) {
    return (
      <div className="p-6">
        <div className="text-red-600">Missing customer ID</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-600">Error loading customer: {String(error)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-background min-h-screen">
      {/* Page Header */}
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">
          Customer Profile
        </h1>
        {customer?.full_name && (
          <p className="text-muted-foreground">{customer.full_name}</p>
        )}
      </header>

      {/* Stats Tiles Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Key Metrics</h2>

        {isLoading && !stats ? (
          <StatsLoadingSkeleton />
        ) : (
          <StatsGrid stats={stats} />
        )}
      </section>

      {/* Vehicles Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Vehicles</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            data-testid="add-vehicle-button"
          >
            <Plus className="h-4 w-4" />
            Add Vehicle
          </button>
        </div>

        {isLoading && !vehicles.length ? (
          <VehiclesLoadingSkeleton />
        ) : (
          <VehiclesList
            vehicles={vehicles}
            selectedVehicleId={selectedVehicleId}
            onSelectVehicle={setSelectedVehicleId}
            onEditVehicle={startEditVehicle}
            onDeleteVehicle={startDeleteVehicle}
          />
        )}
      </section>

      {/* Appointment History Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Appointment History</h2>

        {isLoading && !data?.pages?.length ? (
          <AppointmentHistoryLoadingSkeleton />
        ) : (
          <AppointmentHistoryList
            pages={data?.pages || []}
            selectedVehicleId={selectedVehicleId}
            vehicles={vehicles}
          />
        )}
      </section>

      {/* Load More Button (for appointment history pagination) */}
      {hasNextPage && (
        <div className="flex justify-center">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-4 py-2 rounded-md border bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isFetchingNextPage ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {/* Vehicle Management Modals */}
      <VehicleModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddVehicle}
        isLoading={createVehicle.isLoading}
        error={createVehicle.error as string | null}
        title="Add New Vehicle"
        submitText="Add Vehicle"
      />

      <VehicleModal
        isOpen={!!editingVehicle}
        onClose={() => setEditingVehicle(null)}
        onSubmit={handleEditVehicle}
        isLoading={updateVehicle.isLoading}
        error={updateVehicle.error as string | null}
        vehicle={editingVehicle ? {
          id: editingVehicle.id,
          make: editingVehicle.make || undefined,
          model: editingVehicle.model || undefined,
          year: editingVehicle.year || undefined,
          vin: editingVehicle.vin || undefined,
          license_plate: editingVehicle.plate || undefined,
          notes: editingVehicle.notes || undefined,
        } : undefined}
        title="Edit Vehicle"
        submitText="Save Changes"
      />

      <DeleteVehicleModal
        isOpen={!!deletingVehicle}
        onClose={() => setDeletingVehicle(null)}
        onConfirm={handleDeleteVehicle}
        isLoading={deleteVehicle.isLoading}
        error={deleteVehicle.error as string | null}
        vehicle={deletingVehicle ? {
          id: deletingVehicle.id,
          make: deletingVehicle.make || undefined,
          model: deletingVehicle.model || undefined,
          year: deletingVehicle.year || undefined,
          license_plate: deletingVehicle.plate || undefined,
        } : null}
      />
    </div>
  );
}

/**
 * Stats Grid Component
 * Displays key customer metrics in a responsive grid layout
 */
function StatsGrid({ stats }: { stats?: ProfileStats }) {
  if (!stats) {
    return <StatsEmptyState />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <StatTile
        label="Lifetime Spend"
        value={money(stats.lifetime_spend)}
        testId="stat-lifetime-spend"
      />
      <StatTile
        label="Unpaid Balance"
        value={money(stats.unpaid_balance)}
        variant={stats.unpaid_balance > 0 ? "warning" : "default"}
        testId="stat-unpaid-balance"
      />
      <StatTile
        label="Total Visits"
        value={String(stats.total_visits)}
        testId="stat-total-visits"
      />
      <StatTile
        label="Average Ticket"
        value={money(stats.avg_ticket)}
        testId="stat-avg-ticket"
      />
      <StatTile
        label="Last Visit"
        value={dtLocal(stats.last_visit_at) || 'Never'}
        testId="stat-last-visit"
      />
      <StatTile
        label="Last Service"
        value={dtLocal(stats.last_service_at) || 'Never'}
        testId="stat-last-service"
      />
    </div>
  );
}

/**
 * Individual Stat Tile Component
 */
function StatTile({
  label,
  value,
  variant = "default",
  testId,
}: {
  label: string;
  value: string | number;
  variant?: "default" | "warning";
  testId?: string;
}) {
  const baseClasses = "p-4 rounded-xl border bg-card transition-colors";
  const variantClasses = {
    default: "border-border",
    warning: "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950",
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]}`}
      data-testid={testId}
    >
      <div className="text-sm text-muted-foreground font-medium mb-1">
        {label}
      </div>
      <div className="text-2xl font-bold text-card-foreground">
        {value}
      </div>
    </div>
  );
}

/**
 * Vehicles List Component
 */
function VehiclesList({
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
  onEditVehicle,
  onDeleteVehicle,
}: {
  vehicles: Vehicle[];
  selectedVehicleId?: string;
  onSelectVehicle: (vehicleId: string | undefined) => void;
  onEditVehicle: (vehicle: Vehicle) => void;
  onDeleteVehicle: (vehicle: Vehicle) => void;
}) {
  if (!vehicles.length) {
    return <VehiclesEmptyState />;
  }

  return (
    <div className="space-y-3">
      {/* Filter Controls */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => onSelectVehicle(undefined)}
          className={`px-3 py-2 rounded-full border text-sm transition-colors ${
            !selectedVehicleId
              ? 'bg-primary text-primary-foreground'
              : 'bg-background hover:bg-accent'
          }`}
        >
          All Vehicles ({vehicles.length})
        </button>
        {vehicles.map((vehicle) => (
          <VehicleFilterButton
            key={vehicle.id}
            vehicle={vehicle}
            isSelected={selectedVehicleId === vehicle.id}
            onSelect={() => onSelectVehicle(
              selectedVehicleId === vehicle.id ? undefined : vehicle.id
            )}
          />
        ))}
      </div>

      {/* Vehicle Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vehicles
          .filter(vehicle => !selectedVehicleId || vehicle.id === selectedVehicleId)
          .map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              onEdit={() => onEditVehicle(vehicle)}
              onDelete={() => onDeleteVehicle(vehicle)}
            />
          ))}
      </div>
    </div>
  );
}

/**
 * Vehicle Filter Button
 */
function VehicleFilterButton({
  vehicle,
  isSelected,
  onSelect,
}: {
  vehicle: Vehicle;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const displayName = [vehicle.year, vehicle.make, vehicle.model]
    .filter(Boolean)
    .join(' ') || 'Unknown Vehicle';

  return (
    <button
      onClick={onSelect}
      className={`px-3 py-2 rounded-full border text-sm transition-colors ${
        isSelected
          ? 'bg-primary text-primary-foreground'
          : 'bg-background hover:bg-accent'
      }`}
      data-testid={`vehicle-filter-${vehicle.id}`}
    >
      {displayName}
    </button>
  );
}

/**
 * Vehicle Card Component
 */
function VehicleCard({
  vehicle,
  onEdit,
  onDelete
}: {
  vehicle: Vehicle;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const displayName = [vehicle.year, vehicle.make, vehicle.model]
    .filter(Boolean)
    .join(' ') || 'Unknown Vehicle';

  return (
    <div
      className="p-4 rounded-lg border bg-card"
      data-testid={`vehicle-card-${vehicle.id}`}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-card-foreground">
          {displayName}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="px-3 py-1 text-sm rounded-md border bg-background hover:bg-accent transition-colors"
            data-testid={`edit-vehicle-${vehicle.id}`}
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-1 text-sm rounded-md border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
            data-testid={`delete-vehicle-${vehicle.id}`}
          >
            Delete
          </button>
        </div>
      </div>
      <div className="space-y-1 text-sm text-muted-foreground">
        {vehicle.plate && (
          <div>
            <span className="font-medium">License Plate:</span> {vehicle.plate}
          </div>
        )}
        {vehicle.vin && (
          <div>
            <span className="font-medium">VIN:</span> {vehicle.vin}
          </div>
        )}
        {vehicle.notes && (
          <div>
            <span className="font-medium">Notes:</span> {vehicle.notes}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Appointment History List Component
 */
function AppointmentHistoryList({
  pages,
  selectedVehicleId,
  vehicles,
}: {
  pages: CustomerProfile[];
  selectedVehicleId?: string;
  vehicles: Vehicle[];
}) {
  // Flatten all appointments from all pages
  const allAppointments = pages.flatMap(page => page.appointments || []);

  // Filter appointments by selected vehicle if applicable
  const filteredAppointments = selectedVehicleId
    ? allAppointments.filter(appointment => appointment.vehicle_id === selectedVehicleId)
    : allAppointments;

  if (!filteredAppointments.length) {
    return <AppointmentHistoryEmptyState selectedVehicleId={selectedVehicleId} vehicles={vehicles} />;
  }

  return (
    <div className="space-y-4">
      {filteredAppointments.map((appointment) => (
        <AppointmentCard
          key={appointment.id}
          appointment={appointment}
          vehicles={vehicles}
        />
      ))}
    </div>
  );
}

/**
 * Individual Appointment Card
 */
function AppointmentCard({
  appointment,
  vehicles
}: {
  appointment: Appointment;
  vehicles: Vehicle[];
}) {
  const vehicle = vehicles.find(v => v.id === appointment.vehicle_id);
  const vehicleDisplayName = vehicle
    ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Unknown Vehicle'
    : 'Unknown Vehicle';

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'scheduled':
        return <Calendar className="h-4 w-4 text-orange-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'cancelled':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'in_progress':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'scheduled':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div
      className="p-4 rounded-lg border bg-card"
      data-testid={`appointment-card-${appointment.id}`}
    >
      {/* Header with date and status */}
      <div className="flex items-start justify-between mb-3">
        <div className="space-y-1">
          <div className="text-sm font-medium text-card-foreground">
            {dtLocal(appointment.scheduled_at) || 'No date'}
          </div>
          <div className="text-sm text-muted-foreground">
            {vehicleDisplayName}
            {vehicle?.plate && ` (${vehicle.plate})`}
          </div>
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium ${getStatusColor(appointment.status)}`}>
          {getStatusIcon(appointment.status)}
          {formatStatus(appointment.status)}
        </div>
      </div>

      {/* Services */}
      {appointment.services?.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-medium text-muted-foreground mb-2">Services</div>
          <div className="flex flex-wrap gap-2">
            {appointment.services.map((service, index) => (
              <span
                key={service.service_id || index}
                className="px-2 py-1 text-xs bg-accent rounded-md text-accent-foreground"
              >
                {service.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Invoice information */}
      {appointment.invoice && (
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Total:</span>
            <span className="font-medium">{money(appointment.invoice.total)}</span>
          </div>
          {appointment.invoice.unpaid > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Unpaid:</span>
              <span className="font-medium text-orange-600">{money(appointment.invoice.unpaid)}</span>
            </div>
          )}
          {appointment.invoice.unpaid === 0 && appointment.invoice.total > 0 && (
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle className="h-3 w-3" />
              <span className="text-xs font-medium">Paid</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Loading Skeletons
 */
function AppointmentHistoryLoadingSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-4 rounded-lg border animate-pulse">
          <div className="flex items-start justify-between mb-3">
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-32"></div>
              <div className="h-3 bg-muted rounded w-24"></div>
            </div>
            <div className="h-6 bg-muted rounded-full w-20"></div>
          </div>
          <div className="mb-3">
            <div className="h-3 bg-muted rounded w-16 mb-2"></div>
            <div className="flex gap-2">
              <div className="h-6 bg-muted rounded w-20"></div>
              <div className="h-6 bg-muted rounded w-24"></div>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="h-4 bg-muted rounded w-20"></div>
            <div className="h-4 bg-muted rounded w-16"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsLoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="p-4 rounded-xl border animate-pulse">
          <div className="h-4 bg-muted rounded mb-2 w-3/4"></div>
          <div className="h-8 bg-muted rounded w-1/2"></div>
        </div>
      ))}
    </div>
  );
}

function VehiclesLoadingSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      {/* Filter buttons skeleton */}
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 bg-muted rounded-full w-20 animate-pulse"></div>
        ))}
      </div>

      {/* Vehicle cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="p-4 rounded-lg border animate-pulse">
            <div className="h-6 bg-muted rounded mb-2 w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-1/2"></div>
              <div className="h-4 bg-muted rounded w-2/3"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Empty States
 */
function StatsEmptyState() {
  return (
    <div className="p-8 text-center border rounded-xl bg-muted/20">
      <div className="text-muted-foreground">
        No statistics available yet
      </div>
    </div>
  );
}

function VehiclesEmptyState() {
  return (
    <div className="p-8 text-center border rounded-xl bg-muted/20">
      <div className="text-muted-foreground mb-2">
        No vehicles registered
      </div>
      <p className="text-sm text-muted-foreground">
        Add a vehicle to get started
      </p>
    </div>
  );
}

function AppointmentHistoryEmptyState({
  selectedVehicleId,
  vehicles
}: {
  selectedVehicleId?: string;
  vehicles: Vehicle[];
}) {
  if (selectedVehicleId) {
    const vehicle = vehicles.find(v => v.id === selectedVehicleId);
    const vehicleDisplayName = vehicle
      ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'this vehicle'
      : 'this vehicle';

    return (
      <div className="p-8 text-center border rounded-xl bg-muted/20">
        <div className="text-muted-foreground mb-2">
          No appointments found for {vehicleDisplayName}
        </div>
        <p className="text-sm text-muted-foreground">
          This vehicle has no appointment history yet
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 text-center border rounded-xl bg-muted/20">
      <div className="text-muted-foreground mb-2">
        No appointments found
      </div>
      <p className="text-sm text-muted-foreground">
        This customer has no appointment history yet
      </p>
    </div>
  );
}
