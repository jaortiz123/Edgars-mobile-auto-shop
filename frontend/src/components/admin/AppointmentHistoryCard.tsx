import { useState } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { money, dtLocal } from '../../utils/format';
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
  Mail,
  Shield,
  ShieldCheck,
  ShieldX,
  Tag
} from 'lucide-react';
import type { Appointment, Vehicle, AppointmentService, Money } from '../../types/customerProfile';

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

  // Status styling with enhanced completed/scheduled distinction
  const getStatusInfo = (status: string, isCompleted?: boolean) => {
    // Use is_completed flag for more reliable status detection
    const effectiveStatus = isCompleted ? 'completed' : status.toLowerCase();
    
    switch (effectiveStatus) {
      case 'completed':
        return {
          variant: 'success' as const,
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          cardBg: 'bg-green-50/30'
        };
      case 'in-progress':
      case 'in_progress':
        return {
          variant: 'warning' as const,
          icon: Clock,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          cardBg: 'bg-orange-50/30'
        };
      case 'scheduled':
        return {
          variant: 'primary' as const,
          icon: Calendar,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          cardBg: 'bg-blue-50/30'
        };
      case 'cancelled':
      case 'no-show':
        return {
          variant: 'destructive' as const,
          icon: XCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          cardBg: 'bg-red-50/30'
        };
      default:
        return {
          variant: 'outline' as const,
          icon: AlertCircle,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          cardBg: 'bg-gray-50/30'
        };
    }
  };

  const statusInfo = getStatusInfo(appointment.status, appointment.is_completed);
  const StatusIcon = statusInfo.icon;
  const hasInvoice = !!appointment.invoice;
  const hasUnpaidBalance = appointment.invoice && appointment.invoice.unpaid > 0;
  const isCompleted = appointment.is_completed || appointment.status.toLowerCase() === 'completed';

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

  // Warranty badge rendering
  const renderWarrantyBadge = () => {
    if (!isCompleted || !appointment.warranty_info || !appointment.warranty_info.has_warranty_active) {
      return null;
    }

    const activeWarranties = appointment.warranty_info.warranty_services.filter(
      w => w.warranty_status === 'Active'
    );

    if (activeWarranties.length === 0) return null;

    // Find warranty with shortest remaining time for display
    const shortestWarranty = activeWarranties.reduce((shortest, current) => {
      if (!current.warranty_days_remaining) return shortest;
      if (!shortest.warranty_days_remaining) return current;
      return current.warranty_days_remaining < shortest.warranty_days_remaining ? current : shortest;
    });

    const daysRemaining = shortestWarranty.warranty_days_remaining;
    const isExpiringSoon = daysRemaining && daysRemaining <= 30;

    return (
      <Badge 
        variant={isExpiringSoon ? "warning" : "success"} 
        className="text-xs flex items-center gap-1"
        data-testid="warranty-badge"
      >
        <Shield className="h-3 w-3" />
        Warranty: {daysRemaining ? `${daysRemaining} days` : 'Active'}
      </Badge>
    );
  };

  // Service type badges rendering
  const renderServiceTypeBadges = () => {
    if (!appointment.service_summary) return null;

    const { parts_count, labor_count, diagnostic_count } = appointment.service_summary;
    const badges = [];

    if (parts_count > 0) {
      badges.push(
        <Badge key="parts" variant="outline" className="text-xs flex items-center gap-1">
          <Tag className="h-3 w-3" />
          {parts_count} Parts
        </Badge>
      );
    }

    if (labor_count > 0) {
      badges.push(
        <Badge key="labor" variant="outline" className="text-xs flex items-center gap-1">
          <Wrench className="h-3 w-3" />
          {labor_count} Labor
        </Badge>
      );
    }

    if (diagnostic_count > 0) {
      badges.push(
        <Badge key="diagnostic" variant="outline" className="text-xs flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {diagnostic_count} Diagnostic
        </Badge>
      );
    }

    return badges.length > 0 ? (
      <div className="flex flex-wrap gap-1 mt-1" data-testid="service-type-badges">
        {badges}
      </div>
    ) : null;
  };

  const handleEmailInvoice = () => {
    if (email && onEmailInvoice) {
      onEmailInvoice(appointment.id, email);
      setShowEmailModal(false);
      setEmail('');
    }
  };

  return (
    <Card 
      className={`transition-all duration-200 hover:shadow-md border-l-4 ${statusInfo.borderColor} ${statusInfo.cardBg} ${className}`} 
      data-testid="appointment-history-card"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          {/* Left side: Main appointment info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg ${statusInfo.bgColor}`}>
                <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold text-base" data-testid="appointment-date">
                    {dtLocal(appointment.scheduled_at)}
                  </h3>
                  <Badge variant={statusInfo.variant} className="text-xs" data-testid="appointment-status">
                    {appointment.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Badge>
                  {renderWarrantyBadge()}
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
                <div className="space-y-1">
                  <div className="flex items-start gap-1 text-sm text-gray-600">
                    <Wrench className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2" data-testid="appointment-services">
                      {formatServices(appointment.services)}
                    </span>
                  </div>
                  {renderServiceTypeBadges()}
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
            {hasInvoice && isCompleted && (
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

            {/* Service Advisor Quick Actions */}
            {isCompleted && (
              <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-gray-200">
                {appointment.warranty_info?.has_warranty_active && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDetails(true)}
                    className="text-xs h-7 text-blue-600 border-blue-300 hover:bg-blue-50"
                    data-testid="check-warranty-btn"
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    Warranty
                  </Button>
                )}
                {appointment.major_services?.length && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDetails(true)}
                    className="text-xs h-7 text-green-600 border-green-300 hover:bg-green-50"
                    data-testid="view-services-btn"
                  >
                    <Wrench className="h-3 w-3 mr-1" />
                    Services
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Toggle details button */}
        {(appointment.notes || appointment.completed_at || appointment.check_in_at || 
          appointment.warranty_info || appointment.major_services?.length) && (
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
            {/* Service Advisor Quick Summary */}
            {isCompleted && (appointment.major_services?.length || appointment.service_summary) && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Service Summary
                </h4>
                {appointment.major_services?.length && (
                  <div className="mb-2">
                    <span className="text-blue-700 font-medium">Major Services: </span>
                    <span className="text-blue-600">{appointment.major_services.join(', ')}</span>
                  </div>
                )}
                {appointment.service_summary && (
                  <div className="text-xs text-blue-600">
                    Total: {appointment.service_summary.total_services} services • 
                    Parts: {appointment.service_summary.parts_count} • 
                    Labor: {appointment.service_summary.labor_count} • 
                    Diagnostic: {appointment.service_summary.diagnostic_count}
                  </div>
                )}
              </div>
            )}

            {/* Warranty Information */}
            {isCompleted && appointment.warranty_info && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-700 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Warranty Status
                </h4>
                {appointment.warranty_info.has_warranty_active ? (
                  <div className="space-y-1">
                    {appointment.warranty_info.warranty_services.map((warranty, index) => (
                      <div 
                        key={index}
                        className={`flex items-center justify-between p-2 rounded text-xs ${
                          warranty.warranty_status === 'Active' 
                            ? 'bg-green-100 border border-green-200' 
                            : 'bg-red-100 border border-red-200'
                        }`}
                        data-testid={`warranty-detail-${index}`}
                      >
                        <div className="flex items-center gap-2">
                          {warranty.warranty_status === 'Active' ? (
                            <ShieldCheck className="h-3 w-3 text-green-600" />
                          ) : (
                            <ShieldX className="h-3 w-3 text-red-600" />
                          )}
                          <span className="font-medium">{warranty.service_name}</span>
                        </div>
                        <div className="text-right">
                          <div className={warranty.warranty_status === 'Active' ? 'text-green-700' : 'text-red-700'}>
                            {warranty.warranty_status}
                          </div>
                          {warranty.warranty_days_remaining !== null && warranty.warranty_status === 'Active' && (
                            <div className="text-green-600">
                              {warranty.warranty_days_remaining} days remaining
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 italic">No active warranties</div>
                )}
              </div>
            )}

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
