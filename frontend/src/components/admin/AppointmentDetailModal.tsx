import React from 'react';
import { X, Phone, MapPin, Clock, Wrench, Car } from 'lucide-react';

interface Appointment {
  id: string;
  customer: string;
  vehicle: string;
  service: string;
  timeSlot: string;
  dateTime: Date;
  status: 'scheduled' | 'in-progress' | 'completed' | 'canceled';
  phone?: string;
  address?: string;
}

interface AppointmentDetailModalProps {
  appointment: Appointment;
  isOpen: boolean;
  onClose: () => void;
  onStartJob?: (id: string) => void;
  onCompleteJob?: (id: string) => void;
  onCallCustomer?: (phone: string) => void;
}

export const AppointmentDetailModal: React.FC<AppointmentDetailModalProps> = ({
  appointment,
  isOpen,
  onClose,
  onStartJob,
  onCompleteJob,
  onCallCustomer
}) => {
  if (!isOpen) return null;

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'canceled': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">📋 Appointment Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close modal"
          >
            <X className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status Badge */}
          <div className="flex justify-center">
            <span className={`px-4 py-2 rounded-full text-sm font-bold border ${getStatusColor(appointment.status)}`}>
              {appointment.status.toUpperCase().replace('-', ' ')}
            </span>
          </div>

          {/* Time & Date */}
          <div className="text-center bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-center mb-2">
              <Clock className="h-5 w-5 text-gray-600 mr-2" />
              <span className="text-sm font-medium text-gray-600">Scheduled Time</span>
            </div>
            <div className="text-3xl font-bold text-orange-600 mb-1">
              {formatTime(appointment.dateTime)}
            </div>
            <div className="text-gray-600">
              {formatDate(appointment.dateTime)}
            </div>
          </div>

          {/* Customer Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-xl">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {appointment.customer.charAt(0)}
                </span>
              </div>
              <div>
                <div className="font-bold text-lg text-gray-900">
                  {appointment.customer}
                </div>
                <div className="text-gray-600">Customer</div>
              </div>
            </div>

            {/* Vehicle Info */}
            <div className="flex items-center space-x-3 p-4 bg-green-50 rounded-xl">
              <Car className="h-8 w-8 text-green-600" />
              <div>
                <div className="font-bold text-lg text-gray-900">
                  {appointment.vehicle}
                </div>
                <div className="text-gray-600">Vehicle</div>
              </div>
            </div>

            {/* Service Info */}
            <div className="flex items-center space-x-3 p-4 bg-orange-50 rounded-xl">
              <Wrench className="h-8 w-8 text-orange-600" />
              <div>
                <div className="font-bold text-lg text-gray-900">
                  {appointment.service}
                </div>
                <div className="text-gray-600">Service Requested</div>
              </div>
            </div>

            {/* Contact Info */}
            {appointment.phone && (
              <div className="flex items-center space-x-3 p-4 bg-purple-50 rounded-xl">
                <Phone className="h-8 w-8 text-purple-600" />
                <div className="flex-1">
                  <div className="font-bold text-lg text-gray-900">
                    {appointment.phone}
                  </div>
                  <div className="text-gray-600">Phone Number</div>
                </div>
                <button
                  onClick={() => onCallCustomer && onCallCustomer(appointment.phone!)}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-medium touch-manipulation"
                >
                  📞 Call
                </button>
              </div>
            )}

            {/* Address Info */}
            {appointment.address && (
              <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-xl">
                <MapPin className="h-8 w-8 text-gray-600" />
                <div>
                  <div className="font-bold text-lg text-gray-900">
                    {appointment.address}
                  </div>
                  <div className="text-gray-600">Service Address</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 border-t border-gray-200 space-y-3">
          {appointment.status === 'scheduled' && (
            <button
              onClick={() => onStartJob && onStartJob(appointment.id)}
              className="w-full py-3 bg-orange-500 text-white text-lg font-bold rounded-xl hover:bg-orange-600 transition-colors shadow-sm flex items-center justify-center space-x-2 touch-manipulation"
            >
              <Wrench className="h-5 w-5" />
              <span>🔧 Start This Job</span>
            </button>
          )}

          {appointment.status === 'in-progress' && (
            <button
              onClick={() => onCompleteJob && onCompleteJob(appointment.id)}
              className="w-full py-3 bg-green-600 text-white text-lg font-bold rounded-xl hover:bg-green-700 transition-colors shadow-sm flex items-center justify-center space-x-2 touch-manipulation"
            >
              <span>✅ Mark as Complete</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-200 text-gray-800 text-lg font-medium rounded-xl hover:bg-gray-300 transition-colors touch-manipulation"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
