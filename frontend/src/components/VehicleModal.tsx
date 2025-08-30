import { useState, useEffect } from 'react';
import { X, Car, AlertCircle } from 'lucide-react';

interface VehicleFormData {
  make: string;
  model: string;
  year: number;
  vin: string;
  license_plate: string;
  notes: string;
}

interface VehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: VehicleFormData) => void;
  isLoading?: boolean;
  error?: string | null;
  vehicle?: {
    id: string;
    make?: string;
    model?: string;
    year?: number;
    vin?: string;
    license_plate?: string;
    notes?: string;
  };
  title?: string;
  submitText?: string;
}

export function VehicleModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  error = null,
  vehicle,
  title,
  submitText = 'Save Vehicle',
}: VehicleModalProps) {
  const [formData, setFormData] = useState<VehicleFormData>({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    vin: '',
    license_plate: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof VehicleFormData, string>>>({});

  // Reset form when modal opens/closes or vehicle changes
  useEffect(() => {
    if (isOpen) {
      if (vehicle) {
        // Edit mode - populate with existing vehicle data
        setFormData({
          make: vehicle.make || '',
          model: vehicle.model || '',
          year: vehicle.year || new Date().getFullYear(),
          vin: vehicle.vin || '',
          license_plate: vehicle.license_plate || '',
          notes: vehicle.notes || '',
        });
      } else {
        // Add mode - reset to defaults
        setFormData({
          make: '',
          model: '',
          year: new Date().getFullYear(),
          vin: '',
          license_plate: '',
          notes: '',
        });
      }
      setErrors({});
    }
  }, [isOpen, vehicle]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof VehicleFormData, string>> = {};

    if (!formData.make.trim()) {
      newErrors.make = 'Make is required';
    }

    if (!formData.model.trim()) {
      newErrors.model = 'Model is required';
    }

    if (!formData.year || formData.year < 1900 || formData.year > new Date().getFullYear() + 1) {
      newErrors.year = 'Please enter a valid year';
    }

    if (formData.vin && formData.vin.length !== 17) {
      newErrors.vin = 'VIN must be exactly 17 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    onSubmit(formData);
  };

  const handleInputChange = (field: keyof VehicleFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  if (!isOpen) return null;

  const isEditMode = !!vehicle;
  const modalTitle = title || (isEditMode ? 'Edit Vehicle' : 'Add New Vehicle');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        {/* Modal */}
        <div className="relative inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <Car className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">{modalTitle}</h3>
            </div>
            <button
              type="button"
              className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={onClose}
              disabled={isLoading}
              title="Close modal"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-4">
              {/* Error Display */}
              {error && (
                <div className="mb-4 rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">
                        Something went wrong
                      </h3>
                      <div className="mt-2 text-sm text-red-700">
                        {error || 'Failed to save vehicle. Please try again.'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Make */}
                <div>
                  <label htmlFor="make" className="block text-sm font-medium text-gray-700">
                    Make *
                  </label>
                  <input
                    type="text"
                    id="make"
                    value={formData.make}
                    onChange={(e) => handleInputChange('make', e.target.value)}
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                      errors.make ? 'border-red-300' : ''
                    }`}
                    placeholder="Toyota"
                    disabled={isLoading}
                  />
                  {errors.make && <p className="mt-1 text-sm text-red-600">{errors.make}</p>}
                </div>

                {/* Model */}
                <div>
                  <label htmlFor="model" className="block text-sm font-medium text-gray-700">
                    Model *
                  </label>
                  <input
                    type="text"
                    id="model"
                    value={formData.model}
                    onChange={(e) => handleInputChange('model', e.target.value)}
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                      errors.model ? 'border-red-300' : ''
                    }`}
                    placeholder="Camry"
                    disabled={isLoading}
                  />
                  {errors.model && <p className="mt-1 text-sm text-red-600">{errors.model}</p>}
                </div>

                {/* Year */}
                <div>
                  <label htmlFor="year" className="block text-sm font-medium text-gray-700">
                    Year *
                  </label>
                  <input
                    type="number"
                    id="year"
                    value={formData.year}
                    onChange={(e) => handleInputChange('year', parseInt(e.target.value) || new Date().getFullYear())}
                    min="1900"
                    max={new Date().getFullYear() + 1}
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                      errors.year ? 'border-red-300' : ''
                    }`}
                    disabled={isLoading}
                  />
                  {errors.year && <p className="mt-1 text-sm text-red-600">{errors.year}</p>}
                </div>

                {/* License Plate */}
                <div>
                  <label htmlFor="license_plate" className="block text-sm font-medium text-gray-700">
                    License Plate
                  </label>
                  <input
                    type="text"
                    id="license_plate"
                    value={formData.license_plate}
                    onChange={(e) => handleInputChange('license_plate', e.target.value.toUpperCase())}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="ABC-123"
                    disabled={isLoading}
                  />
                </div>

                {/* VIN */}
                <div className="sm:col-span-2">
                  <label htmlFor="vin" className="block text-sm font-medium text-gray-700">
                    VIN (Vehicle Identification Number)
                  </label>
                  <input
                    type="text"
                    id="vin"
                    value={formData.vin}
                    onChange={(e) => handleInputChange('vin', e.target.value.toUpperCase())}
                    maxLength={17}
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                      errors.vin ? 'border-red-300' : ''
                    }`}
                    placeholder="17-character VIN"
                    disabled={isLoading}
                  />
                  {errors.vin && <p className="mt-1 text-sm text-red-600">{errors.vin}</p>}
                  {formData.vin && formData.vin.length > 0 && formData.vin.length < 17 && (
                    <p className="mt-1 text-sm text-gray-500">
                      {formData.vin.length}/17 characters
                    </p>
                  )}
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                    Notes
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Additional notes about this vehicle..."
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-3 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : submitText}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
