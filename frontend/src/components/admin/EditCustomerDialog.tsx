import * as React from 'react';
import { searchCustomers } from '@/lib/customerProfileApi';
import type { CustomerSearchResult } from '@/lib/customerProfileApi';
import { useFocusTrap, useRovingTabindex } from '@/hooks/useFocusTrap';

export type EditCustomerPayload = {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  tags?: string[];
  notes?: string | null;
  sms_consent?: boolean;
};

export type Vehicle = {
  id: string;
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
  license_plate?: string;
  notes?: string;
  is_primary?: boolean;
  is_active?: boolean;
};

export type AddVehiclePayload = {
  make: string;
  model: string;
  year: number;
  vin?: string;
  license_plate?: string;
  notes?: string;
};

type TabType = 'customer' | 'vehicles';

export function EditCustomerDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  loading,
  vehicles = [],
  onAddVehicle,
  onUpdateVehicle,
  onTransferVehicle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: {
    id: string;
    full_name: string;
    email?: string | null;
    phone?: string | null;
    tags?: string[];
    notes?: string | null;
    sms_consent?: boolean;
  };
  onSave: (p: EditCustomerPayload) => Promise<void> | void;
  loading?: boolean;
  vehicles?: Vehicle[];
  onAddVehicle?: (v: AddVehiclePayload) => Promise<void> | void;
  onUpdateVehicle?: (vehicleId: string, updates: { is_primary?: boolean; is_active?: boolean }) => Promise<void> | void;
  onTransferVehicle?: (vehicleId: string, targetCustomerId: string) => Promise<void> | void;
}) {
  const [activeTab, setActiveTab] = React.useState<TabType>('customer');
  const [showAddVehicle, setShowAddVehicle] = React.useState(false);
  const [showTransferVehicle, setShowTransferVehicle] = React.useState<string | null>(null);

  const [form, setForm] = React.useState<EditCustomerPayload>({
    full_name: initial.full_name,
    email: initial.email ?? '',
    phone: initial.phone ?? '',
    tags: initial.tags ?? [],
    notes: initial.notes ?? '',
    sms_consent: initial.sms_consent ?? false,
  });

  const [vehicleForm, setVehicleForm] = React.useState<AddVehiclePayload>({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    vin: '',
    license_plate: '',
    notes: '',
  });

  const focusTrapRef = useFocusTrap(open);

  React.useEffect(() => {
    setForm({
      full_name: initial.full_name,
      email: initial.email ?? '',
      phone: initial.phone ?? '',
      tags: initial.tags ?? [],
      notes: initial.notes ?? '',
      sms_consent: initial.sms_consent ?? false,
    });
  }, [initial]);

  // Focus management is now handled by the focus trap hook

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!open) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
      } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (form.full_name.trim() && !loading) {
          onSave(form);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, form, loading, onOpenChange, onSave]);

  const handleSave = () => {
    if (form.full_name.trim() && !loading) {
      onSave(form);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/40 z-50"
      onClick={() => onOpenChange(false)}
      role="presentation"
    >
      <div
        ref={focusTrapRef as React.RefObject<HTMLDivElement>}
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-customer-title"
        aria-describedby="edit-customer-description"
      >
        <div className="mb-6">
          <h2 id="edit-customer-title" className="text-xl font-semibold text-gray-900 mb-2">
            Edit Customer — {initial.full_name}
          </h2>
          <p id="edit-customer-description" className="text-sm text-gray-600 mb-4">
            Modify customer information and manage their vehicles. Use arrow keys to navigate between tabs.
          </p>

          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200" role="tablist" aria-label="Customer and vehicle information">
            <button
              role="tab"
              aria-selected={activeTab === 'customer' ? 'true' : 'false'}
              aria-controls="customer-panel"
              id="customer-tab"
              className={`px-4 py-2 font-medium text-sm border-b-2 ${
                activeTab === 'customer'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('customer')}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  setActiveTab('vehicles');
                  document.getElementById('vehicles-tab')?.focus();
                } else if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  // Already on first tab, stay focused
                }
              }}
            >
              Customer Info
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'vehicles' ? 'true' : 'false'}
              aria-controls="vehicles-panel"
              id="vehicles-tab"
              className={`px-4 py-2 font-medium text-sm border-b-2 ml-6 ${
                activeTab === 'vehicles'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('vehicles')}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  setActiveTab('customer');
                  document.getElementById('customer-tab')?.focus();
                } else if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  // Already on last tab, stay focused
                }
              }}
            >
              Vehicles ({vehicles.length})
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'customer' && (
          <div role="tabpanel" id="customer-panel" aria-labelledby="customer-tab">
            <CustomerInfoTab
              form={form}
              setForm={setForm}
              loading={loading}
            />
          </div>
        )}

        {activeTab === 'vehicles' && (
          <div role="tabpanel" id="vehicles-panel" aria-labelledby="vehicles-tab">
            <VehiclesTab
              vehicles={vehicles}
              showAddVehicle={showAddVehicle}
              setShowAddVehicle={setShowAddVehicle}
              vehicleForm={vehicleForm}
              setVehicleForm={setVehicleForm}
              onAddVehicle={onAddVehicle}
              onUpdateVehicle={onUpdateVehicle}
              onTransferVehicle={onTransferVehicle}
              showTransferVehicle={showTransferVehicle}
              setShowTransferVehicle={setShowTransferVehicle}
              loading={loading}
            />
          </div>
        )}

        {/* Action Buttons - Only show for customer tab */}
        {activeTab === 'customer' && (
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleSave}
              disabled={loading || !form.full_name.trim()}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}

        {/* Close Button for Vehicles Tab */}
        {activeTab === 'vehicles' && (
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={() => onOpenChange(false)}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Customer Info Tab Component
function CustomerInfoTab({
  form,
  setForm,
  loading
}: {
  form: EditCustomerPayload;
  setForm: React.Dispatch<React.SetStateAction<EditCustomerPayload>>;
  loading?: boolean;
}) {
  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="text-sm font-medium text-gray-700">Full name *</span>
        <input
          type="text"
          className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          required
        />
      </label>

      <label className="block text-sm">
        <span className="text-sm font-medium text-gray-700">Email</span>
        <input
          type="email"
          className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={form.email ?? ''}
          onChange={(e) => setForm({ ...form, email: e.target.value || null })}
          placeholder="customer@example.com"
        />
      </label>

      <label className="block text-sm">
        <span className="text-sm font-medium text-gray-700">Phone</span>
        <input
          type="tel"
          className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={form.phone ?? ''}
          onChange={(e) => setForm({ ...form, phone: e.target.value || null })}
          placeholder="+1 (555) 123-4567"
        />
      </label>

      <label className="block text-sm">
        <span className="text-sm font-medium text-gray-700">Tags</span>
        <input
          type="text"
          className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={(form.tags ?? []).join(', ')}
          onChange={(e) => setForm({
            ...form,
            tags: e.target.value.split(',').map(t => t.trim()).filter(t => t.length > 0)
          })}
          placeholder="vip, loyal, fleet (comma separated)"
        />
      </label>

      <label className="block text-sm">
        <span className="text-sm font-medium text-gray-700">Notes</span>
        <textarea
          className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          rows={3}
          maxLength={1000}
          value={form.notes ?? ''}
          onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
          placeholder="Internal notes about this customer..."
        />
        <div className="text-xs text-gray-500 mt-1">
          {(form.notes?.length ?? 0)}/1000 characters
        </div>
      </label>

      <label className="flex items-center text-sm">
        <input
          type="checkbox"
          className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          checked={form.sms_consent ?? false}
          onChange={(e) => setForm({ ...form, sms_consent: e.target.checked })}
        />
        <span className="text-sm font-medium text-gray-700">SMS Consent</span>
        <span className="text-xs text-gray-500 ml-2">Customer agrees to receive SMS notifications</span>
      </label>
    </div>
  );
}

// Vehicles Tab Component
function VehiclesTab({
  vehicles,
  showAddVehicle,
  setShowAddVehicle,
  vehicleForm,
  setVehicleForm,
  onAddVehicle,
  onUpdateVehicle,
  onTransferVehicle,
  showTransferVehicle,
  setShowTransferVehicle,
  loading
}: {
  vehicles: Vehicle[];
  showAddVehicle: boolean;
  setShowAddVehicle: React.Dispatch<React.SetStateAction<boolean>>;
  vehicleForm: AddVehiclePayload;
  setVehicleForm: React.Dispatch<React.SetStateAction<AddVehiclePayload>>;
  onAddVehicle?: (v: AddVehiclePayload) => Promise<void> | void;
  onUpdateVehicle?: (vehicleId: string, updates: { is_primary?: boolean; is_active?: boolean }) => Promise<void> | void;
  onTransferVehicle?: (vehicleId: string, targetCustomerId: string) => Promise<void> | void;
  showTransferVehicle: string | null;
  setShowTransferVehicle: React.Dispatch<React.SetStateAction<string | null>>;
  loading?: boolean;
}) {
  // Set up roving tabindex for vehicle list navigation
  const vehicleItems = vehicles.map(vehicle => ({ id: vehicle.id }));
  const vehicleListRef = useRovingTabindex(vehicleItems, vehicles.length > 0);
  const handleAddVehicle = async () => {
    if (!onAddVehicle) return;

    if (vehicleForm.make.trim() && vehicleForm.model.trim()) {
      await onAddVehicle(vehicleForm);
      // Reset form after successful add
      setVehicleForm({
        make: '',
        model: '',
        year: new Date().getFullYear(),
        vin: '',
        license_plate: '',
        notes: '',
      });
      setShowAddVehicle(false);
    }
  };

  const handleSetPrimary = async (vehicleId: string) => {
    if (!onUpdateVehicle) return;
    await onUpdateVehicle(vehicleId, { is_primary: true });
  };

  const handleToggleActive = async (vehicleId: string, currentActive: boolean) => {
    if (!onUpdateVehicle) return;
    await onUpdateVehicle(vehicleId, { is_active: !currentActive });
  };

  const handleTransferVehicle = async (targetCustomerId: string) => {
    if (!onTransferVehicle || !showTransferVehicle) return;
    await onTransferVehicle(showTransferVehicle, targetCustomerId);
    setShowTransferVehicle(null);
  };

  // Transfer Modal - show when showTransferVehicle has a vehicle ID
  if (showTransferVehicle) {
    return <TransferVehicleModal
      vehicleId={showTransferVehicle}
      vehicles={vehicles}
      onTransfer={handleTransferVehicle}
      onClose={() => setShowTransferVehicle(null)}
      loading={loading}
    />;
  }

  if (showAddVehicle) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Add New Vehicle</h3>
          <button
            onClick={() => setShowAddVehicle(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-sm font-medium text-gray-700">Make *</span>
            <input
              type="text"
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={vehicleForm.make}
              onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })}
              placeholder="Toyota"
              required
            />
          </label>

          <label className="block text-sm">
            <span className="text-sm font-medium text-gray-700">Model *</span>
            <input
              type="text"
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={vehicleForm.model}
              onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
              placeholder="Camry"
              required
            />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <label className="block text-sm">
            <span className="text-sm font-medium text-gray-700">Year *</span>
            <input
              type="number"
              min="1900"
              max={new Date().getFullYear() + 1}
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={vehicleForm.year}
              onChange={(e) => setVehicleForm({ ...vehicleForm, year: parseInt(e.target.value) || new Date().getFullYear() })}
              required
            />
          </label>

          <label className="block text-sm">
            <span className="text-sm font-medium text-gray-700">License Plate</span>
            <input
              type="text"
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={vehicleForm.license_plate}
              onChange={(e) => setVehicleForm({ ...vehicleForm, license_plate: e.target.value })}
              placeholder="ABC123"
            />
          </label>

          <label className="block text-sm">
            <span className="text-sm font-medium text-gray-700">VIN</span>
            <input
              type="text"
              maxLength={17}
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={vehicleForm.vin}
              onChange={(e) => setVehicleForm({ ...vehicleForm, vin: e.target.value.toUpperCase() })}
              placeholder="17-character VIN"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="text-sm font-medium text-gray-700">Notes</span>
          <textarea
            className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            rows={2}
            value={vehicleForm.notes}
            onChange={(e) => setVehicleForm({ ...vehicleForm, notes: e.target.value })}
            placeholder="Additional notes about this vehicle..."
          />
        </label>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            onClick={() => setShowAddVehicle(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleAddVehicle}
            disabled={loading || !vehicleForm.make.trim() || !vehicleForm.model.trim()}
          >
            {loading ? 'Adding...' : 'Add Vehicle'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Customer Vehicles</h3>
        <button
          onClick={() => setShowAddVehicle(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          + Add Vehicle
        </button>
      </div>

      {vehicles.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-lg mb-2">No vehicles registered</div>
          <div className="text-sm">Click "Add Vehicle" to get started</div>
        </div>
      ) : (
        <div
          className="space-y-3"
          ref={vehicleListRef as React.RefObject<HTMLDivElement>}
          role="list"
          aria-label="Customer vehicles"
        >
          {vehicles.map((vehicle, index) => (
            <div
              key={vehicle.id}
              role="listitem"
              className={`border rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                vehicle.is_active === false
                  ? 'border-gray-300 bg-gray-100'
                  : vehicle.is_primary
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 bg-gray-50'
              }`}
              data-testid="vehicle-card"
              data-roving-id={vehicle.id}
              tabIndex={index === 0 ? 0 : -1}
              aria-label={`${vehicle.license_plate ? `${vehicle.license_plate} – ` : ''}${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.is_primary ? ' (Primary vehicle)' : ''}${vehicle.is_active === false ? ' (Inactive)' : ''}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className={`font-medium ${vehicle.is_active === false ? 'text-gray-500' : 'text-gray-900'}`}>
                      {vehicle.license_plate ? `${vehicle.license_plate} – ${vehicle.year} ${vehicle.make} ${vehicle.model}` : `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                    </h4>
                    {vehicle.is_primary && (
                      <span className="px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded-full">
                        PRIMARY
                      </span>
                    )}
                    {vehicle.is_active === false && (
                      <span className="px-2 py-1 text-xs font-medium bg-gray-500 text-white rounded-full">
                        INACTIVE
                      </span>
                    )}
                  </div>
                  <div className={`text-sm mt-1 ${vehicle.is_active === false ? 'text-gray-400' : 'text-gray-600'}`}>
                    {vehicle.vin && (
                      <span>VIN: {vehicle.vin}</span>
                    )}
                  </div>
                  {vehicle.notes && (
                    <div className={`text-sm mt-2 ${vehicle.is_active === false ? 'text-gray-400' : 'text-gray-500'}`}>
                      {vehicle.notes}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                                {/* Action Buttons */}
                <div className="flex flex-col gap-2 ml-4" role="group" aria-label={`Actions for ${vehicle.license_plate ? `${vehicle.license_plate} – ` : ''}${vehicle.year} ${vehicle.make} ${vehicle.model}`}>
                  {!vehicle.is_primary && vehicle.is_active !== false && (
                    <button
                      type="button"
                      onClick={() => onUpdateVehicle?.(vehicle.id, { is_primary: true })}
                      className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100"
                      aria-label={`Set ${vehicle.license_plate ? `${vehicle.license_plate} – ` : ''}${vehicle.year} ${vehicle.make} ${vehicle.model} as primary vehicle`}
                    >
                      Set Primary
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onUpdateVehicle?.(vehicle.id, {
                      is_active: vehicle.is_active === false ? true : false
                    })}
                    className={`text-xs px-2 py-1 rounded ${
                      vehicle.is_active === false
                        ? 'bg-green-50 text-green-700 hover:bg-green-100'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                    aria-label={`${vehicle.is_active === false ? 'Reactivate' : 'Mark as inactive'} ${vehicle.license_plate ? `${vehicle.license_plate} – ` : ''}${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                  >
                    {vehicle.is_active === false ? 'Reactivate' : 'Deactivate'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowTransferVehicle(vehicle.id)}
                    className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded hover:bg-orange-100"
                    aria-label={`Transfer ${vehicle.license_plate ? `${vehicle.license_plate} – ` : ''}${vehicle.year} ${vehicle.make} ${vehicle.model} to another customer`}
                  >
                    Transfer
                  </button>
                  {!vehicle.is_primary && vehicle.is_active !== false && (
                    <button
                      onClick={() => handleSetPrimary(vehicle.id)}
                      className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={loading}
                      aria-label={`Set ${vehicle.year} ${vehicle.make} ${vehicle.model} as primary vehicle`}
                    >
                      Set Primary
                    </button>
                  )}

                  <button
                    onClick={() => handleToggleActive(vehicle.id, vehicle.is_active !== false)}
                    className={`px-3 py-1 text-xs font-medium rounded focus:outline-none focus:ring-2 ${
                      vehicle.is_active === false
                        ? 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500'
                        : 'bg-orange-600 text-white hover:bg-orange-700 focus:ring-orange-500'
                    }`}
                    disabled={loading}
                    aria-label={`${vehicle.is_active === false ? 'Reactivate' : 'Mark as inactive'} ${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                  >
                    {vehicle.is_active === false ? 'Reactivate' : 'Mark Inactive'}
                  </button>

                  <button
                    onClick={() => setShowTransferVehicle(vehicle.id)}
                    className="px-3 py-1 text-xs font-medium bg-gray-600 text-white rounded hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    disabled={loading}
                    aria-label={`Transfer ${vehicle.year} ${vehicle.make} ${vehicle.model} to another customer`}
                  >
                    Transfer...
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Transfer Vehicle Modal Component
function TransferVehicleModal({
  vehicleId,
  vehicles,
  onTransfer,
  onClose,
  loading
}: {
  vehicleId: string;
  vehicles: Vehicle[];
  onTransfer: (targetCustomerId: string) => Promise<void>;
  onClose: () => void;
  loading?: boolean;
}) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<CustomerSearchResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = React.useState<CustomerSearchResult | null>(null);
  const [isSearching, setIsSearching] = React.useState(false);

  const vehicle = vehicles.find(v => v.id === vehicleId);

  // Search for customers
  const searchCustomersApi = React.useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchCustomers(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching customers:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchCustomersApi(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchCustomersApi]);

  const handleConfirmTransfer = async () => {
    if (!selectedCustomer) return;

    try {
      await onTransfer(selectedCustomer.id);
    } catch (error) {
      console.error('Error transferring vehicle:', error);
      // Handle error - could show toast notification
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Transfer Vehicle</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      {vehicle && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900">
            {vehicle.license_plate ? `${vehicle.license_plate} – ${vehicle.year} ${vehicle.make} ${vehicle.model}` : `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
          </h4>
          <div className="text-sm text-blue-700 mt-1">
            {vehicle.vin && `VIN: ${vehicle.vin}`}
            {vehicle.license_plate && vehicle.vin && ' • '}
            {vehicle.vin && `VIN: ${vehicle.vin}`}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Search for customer to transfer to:</span>
          <input
            type="text"
            className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter customer name or phone number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </label>

        {/* Search Results */}
        {searchQuery.length >= 2 && (
          <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
            {isSearching ? (
              <div className="p-4 text-center text-gray-500">
                Searching...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No customers found matching "{searchQuery}"
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {searchResults.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => setSelectedCustomer(customer)}
                    className={`w-full text-left p-3 hover:bg-gray-50 focus:outline-none focus:bg-gray-50 ${
                      selectedCustomer?.id === customer.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="font-medium text-gray-900">{customer.full_name}</div>
                    {customer.phone && (
                      <div className="text-sm text-gray-500">{customer.phone}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selected Customer Confirmation */}
        {selectedCustomer && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-medium text-green-900">Selected Customer:</h5>
                <div className="text-sm text-green-700 mt-1">
                  {selectedCustomer.full_name}
                  {selectedCustomer.phone && ` • ${selectedCustomer.phone}`}
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-green-600 hover:text-green-800"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleConfirmTransfer}
          disabled={loading || !selectedCustomer}
        >
          {loading ? 'Transferring...' : 'Confirm Transfer'}
        </button>
      </div>
    </div>
  );
}
