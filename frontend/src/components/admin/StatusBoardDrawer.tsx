/**
 * Status Board Appointment Drawer Component
 * Simple drawer for displaying appointment details in the Status Board
 */

import React from 'react';
import { AppointmentCard, AppointmentStatus } from '../../types/api';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { format } from 'date-fns';
import {
  X,
  Phone,
  MessageCircle,
  Clock,
  User,
  Car,
  Wrench,
  ArrowRight,
  Loader2
} from 'lucide-react';

interface StatusBoardDrawerProps {
  appointment: AppointmentCard | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (appointmentId: string, newStatus: AppointmentStatus) => Promise<void>;
}

const STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ['in_progress'],
  in_progress: ['ready', 'no_show'],
  ready: ['completed'],
  completed: [],
  no_show: []
};

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  ready: 'Ready',
  completed: 'Completed',
  no_show: 'No Show'
};

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-800 border-blue-200',
  in_progress: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  ready: 'bg-green-100 text-green-800 border-green-200',
  completed: 'bg-gray-100 text-gray-800 border-gray-200',
  no_show: 'bg-red-100 text-red-800 border-red-200'
};

export const StatusBoardDrawer: React.FC<StatusBoardDrawerProps> = ({
  appointment,
  isOpen,
  onClose,
  onStatusChange
}) => {
  const [isUpdating, setIsUpdating] = React.useState(false);

  if (!isOpen || !appointment) {
    return null;
  }

  const handleStatusChange = async (newStatus: AppointmentStatus) => {
    if (!onStatusChange) return;

    setIsUpdating(true);
    try {
      await onStatusChange(appointment.id, newStatus);
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const availableTransitions = STATUS_TRANSITIONS[appointment.status] || [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 bg-white w-full max-w-md shadow-xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Appointment Details</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="p-2 hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status Badge */}
          <div className="flex justify-between items-center">
            <Badge className={`${STATUS_COLORS[appointment.status]} border`}>
              {STATUS_LABELS[appointment.status]}
            </Badge>
            <div className="text-sm text-gray-500">
              ID: {appointment.id.slice(0, 8)}...
            </div>
          </div>

          {/* Customer */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <User className="w-5 h-5 text-gray-600" />
              Customer
            </h3>
            <div className="pl-7 space-y-2">
              <div className="font-medium text-lg">{appointment.customer_name}</div>
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="w-4 h-4" />
                <span>{appointment.customer_phone}</span>
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" className="flex-1">
                  <Phone className="w-4 h-4 mr-2" />
                  Call
                </Button>
                <Button size="sm" variant="outline" className="flex-1">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Text
                </Button>
              </div>
            </div>
          </div>

          {/* Vehicle */}
          {appointment.vehicle_info && (
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Car className="w-5 h-5 text-gray-600" />
                Vehicle
              </h3>
              <div className="pl-7">
                <div className="text-gray-700">{appointment.vehicle_info}</div>
              </div>
            </div>
          )}

          {/* Schedule */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-600" />
              Schedule
            </h3>
            <div className="pl-7 space-y-2">
              <div className="text-sm">
                <span className="text-gray-600">Start: </span>
                <span className="font-medium">
                  {format(new Date(appointment.appt_start), 'MMM dd, yyyy HH:mm')}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">End: </span>
                <span className="font-medium">
                  {format(new Date(appointment.appt_end), 'MMM dd, yyyy HH:mm')}
                </span>
              </div>
              {appointment.tech_name && (
                <div className="text-sm">
                  <span className="text-gray-600">Technician: </span>
                  <span className="font-medium">{appointment.tech_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Services */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Wrench className="w-5 h-5 text-gray-600" />
              Services ({appointment.services.length})
            </h3>
            <div className="pl-7 space-y-2">
              {appointment.services.map((service, index) => (
                <div key={index} className="flex justify-between items-center py-2">
                  <div>
                    <div className="font-medium">{service.name}</div>
                    {service.duration_minutes && (
                      <div className="text-xs text-gray-500">
                        {service.duration_minutes} min
                      </div>
                    )}
                  </div>
                  <div className="font-medium text-green-600">
                    ${service.price.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Status Actions */}
          {availableTransitions.length > 0 && (
            <div className="space-y-3 border-t pt-6">
              <h3 className="font-semibold">Quick Actions</h3>
              <div className="space-y-2">
                {availableTransitions.map((status) => (
                  <Button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    disabled={isUpdating}
                    className="w-full justify-between"
                    variant="outline"
                  >
                    <span>Mark as {STATUS_LABELS[status]}</span>
                    {isUpdating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* No Actions Available */}
          {availableTransitions.length === 0 && (
            <div className="border-t pt-6">
              <div className="text-center text-gray-500 py-4">
                No status changes available for {STATUS_LABELS[appointment.status].toLowerCase()} appointments
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default StatusBoardDrawer;
