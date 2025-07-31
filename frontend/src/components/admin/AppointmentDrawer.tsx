import React, { useEffect, useRef, useState } from 'react';
import { Tabs } from '@/components/ui/Tabs';
import * as api from '@/lib/api';
import type { DrawerPayload, AppointmentService } from '@/types/models';
import MessageThread from './MessageThread';
import CustomerHistory from './CustomerHistory';

export default function AppointmentDrawer({ open, onClose, id }: { open: boolean; onClose: () => void; id: string | null }) {
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState<DrawerPayload | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open && id && api.getDrawer) {
      setData(null);
      void api.getDrawer(id).then(setData).catch(console.error);
    }
  }, [open, id]);

  // Focus management
  useEffect(() => {
    if (open) {
      // Store the previously focused element
      previousActiveElement.current = document.activeElement as HTMLElement;
      // Focus the close button when drawer opens
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 100);
    } else {
      // Return focus to the previously focused element when drawer closes
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }
  }, [open]);

  // Focus trap functionality
  useEffect(() => {
    if (!open) return;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      const drawer = ref.current;
      if (!drawer) return;

      const focusableElements = drawer.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && open) onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div ref={ref} data-testid="drawer-open" className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 id="drawer-title" className="text-lg font-semibold">Appointment</h2>
          <button 
            ref={closeButtonRef}
            aria-label="Close drawer" 
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            ✕
          </button>
        </div>
        <Tabs
          value={tab}
          onValueChange={setTab}
          tabs={[
            { value: 'overview', label: 'Overview' }, 
            { value: 'services', label: 'Services' },
            { value: 'messages', label: 'Messages' },
            { value: 'history', label: 'History' }
          ]}
        />
        <div className="p-4 overflow-auto flex-1">
          {tab === 'overview' && <Overview data={data} />}
          {tab === 'services' && <Services data={data} />}
          {tab === 'messages' && id && <MessageThread appointmentId={id} drawerOpen={open} />}
          {tab === 'history' && data?.customer?.id && (
            <CustomerHistory 
              customerId={data.customer.id} 
              onAppointmentClick={(appointmentId) => {
                // Reuse existing openDrawer functionality by opening in new drawer
                if (id !== appointmentId) {
                  // Close current drawer and open new one
                  onClose();
                  // Small delay to allow for smooth transition
                  setTimeout(() => {
                    // This will trigger the parent to open the new appointment
                    // The exact implementation depends on how openDrawer is exposed
                    // For now, we'll just navigate to the new appointment in the same drawer
                    void api.getDrawer(appointmentId).then((newData) => {
                      setData(newData);
                      setTab('overview'); // Switch to overview of the clicked appointment
                    }).catch(console.error);
                  }, 100);
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Overview({ data }: { data: DrawerPayload | null }) {
  if (!data) return <div>Loading…</div>;
  const a = data.appointment;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Info label="Status" value={a.status} />
        <Info label="Total" value={a.total_amount != null ? `$${a.total_amount.toFixed(2)}` : '—'} />
        <Info label="Paid" value={a.paid_amount != null ? `$${a.paid_amount.toFixed(2)}` : '—'} />
        <Info label="Check-in" value={a.check_in_at ?? '—'} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Info label="Customer" value={data.customer?.name ?? '—'} />
        <Info label="Vehicle" value={`${data.vehicle?.year ?? ''} ${data.vehicle?.make ?? ''} ${data.vehicle?.model ?? ''}`.trim() || '—'} />
      </div>
    </div>
  );
}

function Services({ data }: { data: DrawerPayload | null }) {
  const [services, setServices] = useState<AppointmentService[]>([]);
  const [isAddingService, setIsAddingService] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [newService, setNewService] = useState({
    name: '',
    notes: '',
    estimated_hours: '',
    estimated_price: '',
    category: ''
  });

  useEffect(() => {
    if (data?.services) {
      setServices(data.services);
      calculateTotal(data.services);
    }
  }, [data]);

  const calculateTotal = (serviceList: AppointmentService[]) => {
    const totalAmount = serviceList.reduce((sum, service) => {
      return sum + (service.estimated_price || 0);
    }, 0);
    setTotal(totalAmount);
  };

  const handleAddService = async () => {
    if (!data?.appointment?.id) return;
    
    // Validate required fields and numeric inputs
    if (!newService.name.trim()) {
      return;
    }
    
    // Check if hours is provided and valid
    const hours = newService.estimated_hours.trim();
    if (hours && (isNaN(parseFloat(hours)) || parseFloat(hours) < 0)) {
      return;
    }
    
    // Check if price is provided and valid
    const price = newService.estimated_price.trim();
    if (price && (isNaN(parseFloat(price)) || parseFloat(price) < 0)) {
      return;
    }
    
    try {
      const response = await api.createAppointmentService(data.appointment.id, {
        name: newService.name,
        notes: newService.notes,
        estimated_hours: hours ? parseFloat(hours) : undefined,
        estimated_price: price ? parseFloat(price) : undefined,
        category: newService.category
      });
      
      const updatedServices = [...services, response.service];
      setServices(updatedServices);
      calculateTotal(updatedServices);
      setNewService({ name: '', notes: '', estimated_hours: '', estimated_price: '', category: '' });
      setIsAddingService(false);
    } catch (error) {
      console.error('Error adding service:', error);
      if (api.handleApiError) {
        api.handleApiError(error);
      }
    }
  };

  const handleEditService = async (serviceId: string, updatedData: Partial<AppointmentService>) => {
    if (!data?.appointment?.id) return;
    
    try {
      const response = await api.updateAppointmentService(data.appointment.id, serviceId, updatedData);
      const updatedServices = services.map(service => 
        service.id === serviceId ? response.service : service
      );
      setServices(updatedServices);
      calculateTotal(updatedServices);
      setEditingServiceId(null);
    } catch (error) {
      console.error('Error updating service:', error);
      if (api.handleApiError) {
        api.handleApiError(error);
      }
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!data?.appointment?.id) return;
    
    if (!window.confirm('Are you sure you want to delete this service?')) {
      return;
    }
    
    try {
      await api.deleteAppointmentService(data.appointment.id, serviceId);
      const updatedServices = services.filter(service => service.id !== serviceId);
      setServices(updatedServices);
      calculateTotal(updatedServices);
    } catch (error) {
      console.error('Error deleting service:', error);
      if (api.handleApiError) {
        api.handleApiError(error);
      }
    }
  };

  if (!data) return <div>Loading…</div>;
  
  if (!services?.length && !isAddingService) {
    return (
      <div data-testid="services-empty-state" className="text-center py-8">
        <div className="text-gray-500 mb-4">
          <div>No services added yet.</div>
          <div className="text-sm">Add your first service</div>
        </div>
        <button
          data-testid="add-service-button"
          onClick={() => setIsAddingService(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Add Service
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Services Total */}
      <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
        <span data-testid="services-total" className="font-bold">Total: ${total.toFixed(2)}</span>
      </div>

      {/* Add Service Button */}
      {!isAddingService && (
        <button
          data-testid="add-service-button"
          onClick={() => setIsAddingService(true)}
          className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Add Service
        </button>
      )}

      {/* Add Service Form */}
      {isAddingService && (
        <div data-testid="add-service-form" className="border rounded p-4 bg-gray-50">
          <h4 className="font-medium mb-3">Add New Service</h4>
          <div className="space-y-3">
            <div>
              <label htmlFor="service-name" className="block text-sm font-medium text-gray-700 mb-1">
                Service Name *
              </label>
              <input
                id="service-name"
                type="text"
                placeholder="Service name"
                value={newService.name}
                onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label htmlFor="service-notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <input
                id="service-notes"
                type="text"
                placeholder="Notes"
                value={newService.notes}
                onChange={(e) => setNewService({ ...newService, notes: e.target.value })}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label htmlFor="service-hours" className="block text-sm font-medium text-gray-700 mb-1">
                Hours
              </label>
              <input
                id="service-hours"
                type="text"
                placeholder="Hours"
                value={newService.estimated_hours}
                onChange={(e) => setNewService({ ...newService, estimated_hours: e.target.value })}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label htmlFor="service-price" className="block text-sm font-medium text-gray-700 mb-1">
                Price ($)
              </label>
              <input
                id="service-price"
                type="text"
                placeholder="Price"
                value={newService.estimated_price}
                onChange={(e) => setNewService({ ...newService, estimated_price: e.target.value })}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label htmlFor="service-category" className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <input
                id="service-category"
                type="text"
                placeholder="Category"
                value={newService.category}
                onChange={(e) => setNewService({ ...newService, category: e.target.value })}
                className="w-full p-2 border rounded"
              />
            </div>
            <div className="flex gap-2">
              <button
                data-testid="add-service-submit-button"
                onClick={handleAddService}
                disabled={
                  !newService.name.trim() || 
                  (!!newService.estimated_hours.trim() && (isNaN(parseFloat(newService.estimated_hours)) || parseFloat(newService.estimated_hours) < 0)) || 
                  (!!newService.estimated_price.trim() && (isNaN(parseFloat(newService.estimated_price)) || parseFloat(newService.estimated_price) < 0))
                }
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
              <button
                data-testid="add-service-cancel-button"
                onClick={() => {
                  setIsAddingService(false);
                  setNewService({ name: '', notes: '', estimated_hours: '', estimated_price: '', category: '' });
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Services List */}
      <div data-testid="services-list" className="space-y-2">
        {services.map((service) => (
          <ServiceItem
            key={service.id}
            service={service}
            isEditing={editingServiceId === service.id}
            onEdit={(updatedData) => handleEditService(service.id, updatedData)}
            onDelete={() => handleDeleteService(service.id)}
            onStartEdit={() => setEditingServiceId(service.id)}
            onCancelEdit={() => setEditingServiceId(null)}
          />
        ))}
      </div>
    </div>
  );
}

function ServiceItem({ service, isEditing, onEdit, onDelete, onStartEdit, onCancelEdit }: {
  service: AppointmentService;
  isEditing: boolean;
  onEdit: (data: Partial<AppointmentService>) => void;
  onDelete: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
}) {
  const [editData, setEditData] = useState({
    name: service.name || '',
    notes: service.notes || '',
    estimated_hours: service.estimated_hours?.toString() || '',
    estimated_price: service.estimated_price?.toString() || '',
    category: service.category || ''
  });

  const handleSave = () => {
    onEdit({
      name: editData.name,
      notes: editData.notes,
      estimated_hours: parseFloat(editData.estimated_hours) || undefined,
      estimated_price: parseFloat(editData.estimated_price) || undefined,
      category: editData.category
    });
  };

  if (isEditing) {
    return (
      <div data-testid={`service-item-${service.id}`} className="border rounded p-3 bg-yellow-50">
        <div className="space-y-2">
          <input
            type="text"
            value={editData.name}
            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
            className="w-full p-1 border rounded"
            placeholder="Service name"
            aria-label="Service name"
          />
          <input
            type="text"
            value={editData.notes}
            onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
            className="w-full p-1 border rounded"
            placeholder="Notes"
            aria-label="Notes"
          />
          <input
            type="number"
            value={editData.estimated_hours}
            onChange={(e) => setEditData({ ...editData, estimated_hours: e.target.value })}
            className="w-full p-1 border rounded"
            placeholder="Hours"
            aria-label="Hours"
          />
          <input
            type="number"
            value={editData.estimated_price}
            onChange={(e) => setEditData({ ...editData, estimated_price: e.target.value })}
            className="w-full p-1 border rounded"
            placeholder="Price"
            aria-label="Price"
          />
          <input
            type="text"
            value={editData.category}
            onChange={(e) => setEditData({ ...editData, category: e.target.value })}
            className="w-full p-1 border rounded"
            placeholder="Category"
            aria-label="Category"
          />
          <div className="flex gap-2">
            <button
              data-testid={`save-edit-service-${service.id}`}
              onClick={handleSave}
              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Save
            </button>
            <button
              onClick={onCancelEdit}
              className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid={`service-item-${service.id}`} className="border rounded p-3">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div data-testid={`service-name-${service.id}`} className="font-medium">{service.name}</div>
          <div data-testid={`service-notes-${service.id}`} className="text-sm text-gray-600">{service.notes}</div>
          <div className="text-sm mt-1">
            {service.estimated_hours && <span data-testid={`service-hours-${service.id}`}>{service.estimated_hours}h</span>}
            {service.estimated_hours && service.estimated_price && ' • '}
            {service.estimated_price && <span data-testid={`service-price-${service.id}`}>${service.estimated_price.toFixed(2)}</span>}
          </div>
          {service.category && (
            <div data-testid={`service-category-${service.id}`} className="text-xs text-gray-500 mt-1">{service.category}</div>
          )}
        </div>
        <div className="flex gap-2 ml-4">
          <button
            data-testid={`edit-service-${service.id}`}
            onClick={onStartEdit}
            title="Edit service"
            className="px-2 py-1 text-blue-500 hover:text-blue-700"
          >
            Edit
          </button>
          <button
            data-testid={`delete-service-${service.id}`}
            onClick={onDelete}
            title="Delete service"
            className="px-2 py-1 text-red-500 hover:text-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
