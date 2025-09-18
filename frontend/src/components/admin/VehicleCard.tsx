import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Calendar, AlertTriangle, CheckCircle, Clock, Plus, Settings } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { Vehicle, Appointment } from '@/types/customerProfile';
import { money, dtLocal } from '@/utils/format';

interface VehicleCardProps {
  vehicle: Vehicle;
  appointments: Appointment[]; // All appointments for this customer
  onAddAppointment?: (vehicleId: string) => void;
  onEditVehicle?: (vehicleId: string) => void;
  className?: string;
}

export function VehicleCard({
  vehicle,
  appointments,
  onAddAppointment,
  onEditVehicle,
  className = ''
}: VehicleCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Filter appointments for this vehicle and sort by most recent
  const vehicleAppointments = useMemo(() => {
    return appointments
      .filter(apt => apt.vehicle_id === vehicle.id)
      .sort((a, b) => new Date(b.scheduled_at || b.completed_at || '').getTime() - new Date(a.scheduled_at || a.completed_at || '').getTime());
  }, [appointments, vehicle.id]);

  // Calculate service statistics
  const serviceStats = useMemo(() => {
    const completed = vehicleAppointments.filter(apt => apt.status === 'completed');
    const lastService = completed[0];
    const totalServices = completed.length;

    // Calculate total spent on this vehicle
    const totalSpent = completed.reduce((sum, apt) => {
      return sum + (apt.invoice?.total || 0);
    }, 0);

    // Determine next service due (simplified logic - 6 months or 6000 miles)
    const lastServiceDate = lastService?.completed_at || lastService?.scheduled_at;
    const daysSinceService = lastServiceDate
      ? Math.floor((Date.now() - new Date(lastServiceDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const isOverdue = daysSinceService && daysSinceService > 180; // 6 months
    const isDueSoon = daysSinceService && daysSinceService > 150 && daysSinceService <= 180; // Due within 30 days

    return {
      totalServices,
      lastService,
      lastServiceDate,
      daysSinceService,
      totalSpent,
      isOverdue,
      isDueSoon
    };
  }, [vehicleAppointments]);

  // Get service alert status
  const getAlertStatus = () => {
    if (serviceStats.isOverdue) return 'overdue';
    if (serviceStats.isDueSoon) return 'due-soon';
    return 'good';
  };

  const alertStatus = getAlertStatus();

  // Format vehicle display name
  const vehicleName = [vehicle.year, vehicle.make, vehicle.model]
    .filter(Boolean)
    .join(' ') || 'Unknown Vehicle';

  return (
    <Card className={`p-4 hover:shadow-md transition-shadow ${className}`}>
      {/* Vehicle Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-medium text-lg">{vehicleName}</h4>
          <div className="text-sm text-muted-foreground space-y-1">
            {vehicle.plate && (
              <div>License: <span className="font-mono">{vehicle.plate}</span></div>
            )}
            {vehicle.vin && (
              <div>VIN: <span className="font-mono text-xs">{vehicle.vin}</span></div>
            )}
          </div>
        </div>

        {/* Service Alert Badge */}
        <div className="flex items-center gap-2">
          {alertStatus === 'overdue' && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle size={12} />
              Overdue
            </Badge>
          )}
          {alertStatus === 'due-soon' && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock size={12} />
              Due Soon
            </Badge>
          )}
          {alertStatus === 'good' && serviceStats.totalServices > 0 && (
            <Badge variant="outline" className="flex items-center gap-1">
              <CheckCircle size={12} />
              Current
            </Badge>
          )}
        </div>
      </div>

      {/* Service Summary */}
      <div className="grid grid-cols-3 gap-4 py-3 border-y border-border">
        <div className="text-center">
          <div className="font-medium">{serviceStats.totalServices}</div>
          <div className="text-xs text-muted-foreground">Services</div>
        </div>
        <div className="text-center">
          <div className="font-medium">{money(serviceStats.totalSpent)}</div>
          <div className="text-xs text-muted-foreground">Total Spent</div>
        </div>
        <div className="text-center">
          <div className="font-medium">
            {serviceStats.lastServiceDate
              ? format(new Date(serviceStats.lastServiceDate), 'MMM yyyy')
              : 'Never'
            }
          </div>
          <div className="text-xs text-muted-foreground">Last Service</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mt-3">
        <Button
          size="sm"
          onClick={() => onAddAppointment?.(vehicle.id)}
          className="flex-1 flex items-center gap-1"
        >
          <Plus size={14} />
          Book Service
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onEditVehicle?.(vehicle.id)}
          className="flex items-center gap-1"
        >
          <Settings size={14} />
          Edit
        </Button>
      </div>

      {/* Expandable Service History */}
      {vehicleAppointments.length > 0 && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="w-full mt-2 text-xs"
          >
            {expanded ? 'Hide' : 'View'} Service History ({vehicleAppointments.length})
          </Button>

          {expanded && (
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              <h5 className="text-sm font-medium">Recent Services</h5>
              {vehicleAppointments.slice(0, 5).map((appointment) => (
                <div key={appointment.id} className="flex justify-between items-start text-sm p-2 bg-muted/30 rounded">
                  <div className="flex-1">
                    <div className="font-medium">
                      {dtLocal(appointment.scheduled_at || appointment.completed_at || '')}
                    </div>
                    <div className="text-muted-foreground">
                      {appointment.services.map(s => s.name).join(', ') || 'No services listed'}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant={appointment.status === 'completed' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {appointment.status}
                      </Badge>
                      {appointment.technician_name && (
                        <span className="text-xs text-muted-foreground">
                          by {appointment.technician_name}
                        </span>
                      )}
                    </div>
                  </div>
                  {appointment.invoice && (
                    <div className="text-right">
                      <div className="font-medium">{money(appointment.invoice.total)}</div>
                      {appointment.invoice.unpaid > 0 && (
                        <div className="text-xs text-destructive">
                          ${appointment.invoice.unpaid} due
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {vehicleAppointments.length > 5 && (
                <div className="text-center">
                  <span className="text-xs text-muted-foreground">
                    + {vehicleAppointments.length - 5} more services
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Notes */}
      {vehicle.notes && (
        <div className="mt-3 p-2 bg-muted/30 rounded text-sm">
          <div className="font-medium mb-1">Notes:</div>
          <div className="text-muted-foreground">{vehicle.notes}</div>
        </div>
      )}
    </Card>
  );
}
