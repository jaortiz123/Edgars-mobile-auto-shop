import React, { useState } from 'react';
import { X, Calendar, User, Car, Wrench, MapPin, Phone, Mail } from 'lucide-react';
import { Button } from '../ui/Button';

export interface AppointmentFormData {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  serviceType: string;
  appointmentDate: string;
  appointmentTime: string;
  estimatedDuration: string;
  serviceAddress: string;
  notes: string;
  appointmentType?: 'regular' | 'emergency';
}

interface AppointmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AppointmentFormData) => void;
  isSubmitting?: boolean;
  initialAppointmentType?: 'regular' | 'emergency';
}

const serviceTypes = [
  'Oil Change',
  'Brake Service',
  'Tire Rotation',
  'Engine Diagnostics',
  'Transmission Service',
  'Battery Replacement',
  'Air Filter Replacement',
  'Spark Plug Replacement',
  'Radiator Service',
  'General Inspection',
  'Emergency Repair',
  'Other'
];

const timeSlots = [
  '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
  '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM',
  '4:00 PM', '5:00 PM', '6:00 PM'
];

const durations = [
  '30 minutes',
  '1 hour',
  '1.5 hours',
  '2 hours',
  '3 hours',
  '4+ hours'
];

export const AppointmentFormModal: React.FC<AppointmentFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  initialAppointmentType = 'regular'
}) => {
  const [formData, setFormData] = useState<AppointmentFormData>({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    serviceType: '',
    appointmentDate: '',
    appointmentTime: '',
    estimatedDuration: '',
    serviceAddress: '',
    notes: '',
    appointmentType: initialAppointmentType,
  });

  const [errors, setErrors] = useState<Partial<AppointmentFormData>>({});

  const handleInputChange = (field: keyof AppointmentFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<AppointmentFormData> = {};

    if (!formData.customerName.trim()) newErrors.customerName = 'Customer name is required';
    if (!formData.customerPhone.trim()) newErrors.customerPhone = 'Phone number is required';
    if (!formData.vehicleMake.trim()) newErrors.vehicleMake = 'Vehicle make is required';
    if (!formData.vehicleModel.trim()) newErrors.vehicleModel = 'Vehicle model is required';
    if (!formData.vehicleYear.trim()) newErrors.vehicleYear = 'Vehicle year is required';
    if (!formData.serviceType) newErrors.serviceType = 'Service type is required';
    if (formData.appointmentType !== 'emergency') {
      if (!formData.appointmentDate) newErrors.appointmentDate = 'Appointment date is required';
      if (!formData.appointmentTime) newErrors.appointmentTime = 'Appointment time is required';
    }
    if (!formData.estimatedDuration) newErrors.estimatedDuration = 'Estimated duration is required';
    if (!formData.serviceAddress.trim()) newErrors.serviceAddress = 'Service address is required';

    // Validate phone number format
    if (formData.customerPhone && !/^\+?[\d\s\-()]+$/.test(formData.customerPhone)) {
      newErrors.customerPhone = 'Please enter a valid phone number';
    }

    // Validate email format if provided
    if (formData.customerEmail && !/\S+@\S+\.\S+/.test(formData.customerEmail)) {
      newErrors.customerEmail = 'Please enter a valid email address';
    }

    // Validate vehicle year
    const currentYear = new Date().getFullYear();
    const year = parseInt(formData.vehicleYear);
    if (formData.vehicleYear && (isNaN(year) || year < 1900 || year > currentYear + 1)) {
      newErrors.vehicleYear = 'Please enter a valid year';
    }

    // Validate appointment date (must be today or future)
    if (formData.appointmentDate) {
      const selectedDate = new Date(formData.appointmentDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        newErrors.appointmentDate = 'Appointment date must be today or in the future';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔥 Form submitted!', formData);
    
    const isValid = validateForm();
    console.log('✅ Form validation result:', isValid);
    console.log('❌ Validation errors:', errors);
    
    if (isValid) {
      console.log('📤 Calling onSubmit with:', formData);
      const dataToSubmit = { ...formData };
      if (dataToSubmit.appointmentType === 'emergency') {
        const now = new Date();
        dataToSubmit.appointmentDate = now.toISOString().split('T')[0];
        // Format time properly in 12-hour format
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12; // Convert to 12-hour format
        const formattedMinutes = minutes.toString().padStart(2, '0');
        dataToSubmit.appointmentTime = `${displayHours}:${formattedMinutes} ${ampm}`;
      }
      onSubmit(dataToSubmit);
    } else {
      console.log('🚫 Form validation failed, not submitting');
    }
  };

  const resetForm = () => {
    setFormData({
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      vehicleMake: '',
      vehicleModel: '',
      vehicleYear: '',
      serviceType: '',
      appointmentDate: '',
      appointmentTime: '',
      estimatedDuration: '',
      serviceAddress: '',
      notes: ''
    });
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  const getTomorrowDate = () => {
    if (formData.appointmentType === 'emergency') {
      return new Date().toISOString().split('T')[0];
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-xl font-bold text-gray-900">📅 {formData.appointmentType === 'emergency' ? 'Schedule Walk-in Service' : 'Schedule New Appointment'}</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close modal"
          >
            <X className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Customer Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Customer Information
              </h3>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Customer Name *
              </label>
              <>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => handleInputChange('customerName', e.target.value)}
                  className={`w-full px-2 py-1 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.customerName ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.customerName && <p className="text-red-500 text-xs mt-1">{errors.customerName}</p>}
              </>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Phone Number *
              </label>
              <>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="tel"
                    value={formData.customerPhone}
                    onChange={(e) => handleInputChange('customerPhone', e.target.value)}
                    className={`w-full pl-10 pr-2 py-1 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.customerPhone ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="(555) 123-4567"
                  />
                </div>
                {errors.customerPhone && <p className="text-red-500 text-xs mt-1">{errors.customerPhone}</p>}
              </>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => handleInputChange('customerEmail', e.target.value)}
                    className={`w-full pl-10 pr-2 py-1 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.customerEmail ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="john@example.com"
                  />
                </div>
                {errors.customerEmail && <p className="text-red-500 text-xs mt-1">{errors.customerEmail}</p>}
              </>
            </div>
          </div>

          {/* Vehicle Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-3">
              <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Car className="h-5 w-5 text-green-600" />
                Vehicle Information
              </h3>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Make *
              </label>
              <>
                <input
                  type="text"
                  value={formData.vehicleMake}
                  onChange={(e) => handleInputChange('vehicleMake', e.target.value)}
                  className={`w-full px-2 py-1 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.vehicleMake ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Toyota"
                />
                {errors.vehicleMake && <p className="text-red-500 text-xs mt-1">{errors.vehicleMake}</p>}
              </>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Model *
              </label>
              <>
                <input
                  type="text"
                  value={formData.vehicleModel}
                  onChange={(e) => handleInputChange('vehicleModel', e.target.value)}
                  className={`w-full px-2 py-1 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.vehicleModel ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Camry"
                />
                {errors.vehicleModel && <p className="text-red-500 text-xs mt-1">{errors.vehicleModel}</p>}
              </>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Year *
              </label>
              <>
                <input
                  type="number"
                  min="1900"
                  max={new Date().getFullYear() + 1}
                  value={formData.vehicleYear}
                  onChange={(e) => handleInputChange('vehicleYear', e.target.value)}
                  className={`w-full px-2 py-1 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.vehicleYear ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="2020"
                />
                {errors.vehicleYear && <p className="text-red-500 text-xs mt-1">{errors.vehicleYear}</p>}
              </>
            </div>
          </div>

          {/* Service Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Wrench className="h-5 w-5 text-orange-600" />
                Service Information
              </h3>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Service Type *
              </label>
              <>
                <select
                  value={formData.serviceType}
                  onChange={(e) => handleInputChange('serviceType', e.target.value)}
                  className={`w-full px-2 py-1 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.serviceType ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select a service</option>
                  {serviceTypes.map(service => (
                    <option key={service} value={service}>{service}</option>
                  ))}
                </select>
                {errors.serviceType && <p className="text-red-500 text-xs mt-1">{errors.serviceType}</p>}
              </>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Estimated Duration *
              </label>
              <>
                <select
                  value={formData.estimatedDuration}
                  onChange={(e) => handleInputChange('estimatedDuration', e.target.value)}
                  className={`w-full px-2 py-1 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.estimatedDuration ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select duration</option>
                  {durations.map(duration => (
                    <option key={duration} value={duration}>{duration}</option>
                  ))}
                </select>
                {errors.estimatedDuration && <p className="text-red-500 text-xs mt-1">{errors.estimatedDuration}</p>}
              </>
            </div>
          </div>

          {/* Appointment Scheduling */}
          {formData.appointmentType !== 'emergency' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-purple-600" />
                  Schedule Information
                </h3>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                Appointment Date *
              </label>
                <>
                <input
                  type="date"
                  min={getTomorrowDate()}
                  value={formData.appointmentDate}
                  onChange={(e) => handleInputChange('appointmentDate', e.target.value)}
                  className={`w-full px-2 py-1 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.appointmentDate ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.appointmentDate && <p className="text-red-500 text-xs mt-1">{errors.appointmentDate}</p>}
              </>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                Appointment Time *
              </label>
                <>
                <select
                  value={formData.appointmentTime}
                  onChange={(e) => handleInputChange('appointmentTime', e.target.value)}
                  className={`w-full px-2 py-1 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.appointmentTime ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select time</option>
                  {timeSlots.map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
                {errors.appointmentTime && <p className="text-red-500 text-xs mt-1">{errors.appointmentTime}</p>}
              </>
              </div>
            </div>
          )}

          {/* Service Address */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              <MapPin className="inline h-4 w-4 mr-1" />
              Service Address *
            </label>
            <>
            <textarea
              value={formData.serviceAddress}
              onChange={(e) => handleInputChange('serviceAddress', e.target.value)}
              rows={2}
              className={`w-full px-2 py-1 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none ${
                errors.serviceAddress ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="123 Main St, Anytown, ST 12345"
            />
            {errors.serviceAddress && <p className="text-red-500 text-xs mt-1">{errors.serviceAddress}</p>}
            </>
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Any special instructions or notes about the service..."
            />
            </>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                '📅 Schedule Appointment'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AppointmentFormModal;
