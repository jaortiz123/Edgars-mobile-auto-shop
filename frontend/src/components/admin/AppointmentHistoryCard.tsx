import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { money, dtLocal } from '@/utils/format';
import {
  Calendar,
  Clock,
  User,
  Wrench,
  DollarSign,
  Car,
  FileText,
  CheckCircle,
  AlertCircle,
  XCircle,
  Eye,
  Download,
  Mail
} from 'lucide-react';
import type { Appointment, Vehicle, AppointmentService, Money } from '@/types/customerProfile';

interface AppointmentHistoryCardProps {
  appointment: Appointment;
  vehicle?: Vehicle | null;
  onViewInvoice?: (appointmentId: string) => void;
  onDownloadInvoice?: (appointmentId: string) => void;
  onEmailInvoice?: (appointmentId: string, email: string) => void;
  className?: string;
}

export function AppointmentHistoryCard({
  appointment,
  vehicle,
  onViewInvoice,
  onDownloadInvoice,
  onEmailInvoice,
  className = ''
}: AppointmentHistoryCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [email, setEmail] = useState('');

  // Status styling
  const getStatusInfo = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return {
          variant: 'success' as const,
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50'
        };
      case 'in-progress':
      case 'in_progress':
        return {
          variant: 'warning' as const,
          icon: Clock,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50'
        };
      case 'scheduled':
        return {
          variant: 'primary' as const,
          icon: Calendar,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50'
        };
      case 'cancelled':
      case 'no-show':
        return {
          variant: 'destructive' as const,
          icon: XCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-50'
        };
      default:
        return {
          variant: 'outline' as const,
          icon: AlertCircle,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50'
        };
    }
  };

  const statusInfo = getStatusInfo(appointment.status);
  const StatusIcon = statusInfo.icon;
  const hasInvoice = !!appointment.invoice;
  const hasUnpaidBalance = appointment.invoice && appointment.invoice.unpaid > 0;

  // Format vehicle display
  const formatVehicle = (vehicle?: Vehicle | null) => {
    if (!vehicle) return 'Unknown Vehicle';
    const parts = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'Unknown Vehicle';
  };

  // Format services for display
  const formatServices = (services: AppointmentService[]) => {
    if (!services.length) return 'No services listed';
    return services.map(s => s.name).join(', ');
  };

  // Format duration
  const formatDuration = (minutes?: number | null) => {
    if (!minutes) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  const handleEmailInvoice = () => {
    if (email && onEmailInvoice) {
      onEmailInvoice(appointment.id, email);
      setShowEmailModal(false);
      setEmail('');
    }
  };

  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${className}`} data-testid="appointment-history-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          {/* Left side: Main appointment info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg ${statusInfo.bgColor}`}>
                <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-base" data-testid="appointment-date">
                    {dtLocal(appointment.scheduled_at)}
                  </h3>
                  <Badge variant={statusInfo.variant} className="text-xs" data-testid="appointment-status">
                    {appointment.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Badge>
                </div>

                {/* Vehicle information */}
                <div className="flex items-center gap-1 text-sm text-gray-600 mb-1">
                  <Car className="h-3 w-3" />
                  <span data-testid="appointment-vehicle">{formatVehicle(vehicle)}</span>
                  {vehicle?.plate && (
                    <span className="text-xs bg-gray-100 px-1 rounded">
                      {vehicle.plate}
                    </span>
                  )}
                </div>

                {/* Services */}
                <div className="flex items-start gap-1 text-sm text-gray-600">
                  <Wrench className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-2" data-testid="appointment-services">
                    {formatServices(appointment.services)}
                  </span>
                </div>
              </div>
            </div>

            {/* Technician and additional info */}
            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
              {appointment.technician_name && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span data-testid="appointment-technician">Tech: {appointment.technician_name}</span>
                </div>
              )}
              {appointment.mileage && (
                <div className="flex items-center gap-1">
                  <span data-testid="appointment-mileage">Mileage: {appointment.mileage.toLocaleString()}</span>
                </div>
              )}
              {appointment.estimated_duration && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>Duration: {formatDuration(appointment.estimated_duration)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right side: Payment info and actions */}
          <div className="text-right ml-4 flex-shrink-0">
            {hasInvoice && appointment.invoice && (
              <div className="mb-3">
                <div className="font-semibold text-lg" data-testid="invoice-total">
                  {money(appointment.invoice.total)}
                </div>
                {appointment.invoice.paid > 0 && (
                  <div className="text-xs text-green-600" data-testid="invoice-paid">
                    Paid: {money(appointment.invoice.paid)}
                  </div>
                )}
                {hasUnpaidBalance && (
                  <div className="text-xs text-red-600 font-medium" data-testid="invoice-unpaid">
                    Due: {money(appointment.invoice.unpaid)}
                  </div>
                )}
              </div>
            )}

            {/* Actions for completed appointments with invoices */}
            {hasInvoice && appointment.status.toLowerCase() === 'completed' && (
              <div className="flex flex-col gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewInvoice?.(appointment.id)}
                  className="text-xs h-7"
                  data-testid="view-invoice-btn"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDownloadInvoice?.(appointment.id)}
                  className="text-xs h-7"
                  data-testid="download-invoice-btn"
                >
                  <Download className="h-3 w-3 mr-1" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEmailModal(true)}
                  className="text-xs h-7"
                  data-testid="email-invoice-btn"
                >
                  <Mail className="h-3 w-3 mr-1" />
                  Email
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Toggle details button */}
        {(appointment.notes || appointment.completed_at || appointment.check_in_at) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs mt-2 self-start"
            data-testid="toggle-details-btn"
          >
            {showDetails ? 'Hide' : 'Show'} Details
          </Button>
        )}
      </CardHeader>

      {/* Expanded details */}
      {showDetails && (
        <CardContent className="pt-0 border-t bg-gray-50/50">
          <div className="space-y-3 text-sm">
            {/* Timestamps */}
            {(appointment.check_in_at || appointment.check_out_at || appointment.completed_at) && (
              <div className="space-y-1">
                <h4 className="font-medium text-gray-700">Timeline</h4>
                {appointment.check_in_at && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Clock className="h-3 w-3" />
                    <span>Checked in: {dtLocal(appointment.check_in_at)}</span>
                  </div>
                )}
                {appointment.check_out_at && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Clock className="h-3 w-3" />
                    <span>Checked out: {dtLocal(appointment.check_out_at)}</span>
                  </div>
                )}
                {appointment.completed_at && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <CheckCircle className="h-3 w-3" />
                    <span>Completed: {dtLocal(appointment.completed_at)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            {appointment.notes && (
              <div>
                <h4 className="font-medium text-gray-700 mb-1">Notes</h4>
                <div className="text-xs text-gray-600 bg-white p-2 rounded border" data-testid="appointment-notes">
                  {appointment.notes}
                </div>
              </div>
            )}

            {/* Vehicle details */}
            {vehicle && (vehicle.vin || vehicle.notes) && (
              <div>
                <h4 className="font-medium text-gray-700 mb-1">Vehicle Details</h4>
                {vehicle.vin && (
                  <div className="text-xs text-gray-600">VIN: {vehicle.vin}</div>
                )}
                {vehicle.notes && (
                  <div className="text-xs text-gray-600 mt-1">Notes: {vehicle.notes}</div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="email-modal">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <h3 className="font-semibold">Email Invoice</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="email-input" className="block text-sm font-medium mb-1">
                  Email Address
                </label>
                <input
                  id="email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  data-testid="email-input"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleEmailInvoice}
                  disabled={!email}
                  className="flex-1"
                  data-testid="send-email-btn"
                >
                  Send
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEmailModal(false);
                    setEmail('');
                  }}
                  data-testid="cancel-email-btn"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Card>
  );
}
