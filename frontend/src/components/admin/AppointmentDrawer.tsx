import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import ServiceOperationSelect, { ServiceOperationSelectValue } from '@/components/admin/ServiceOperationSelect';
import { Tabs } from '@/components/ui/Tabs';
import * as api from '@/lib/api';
import type { DrawerPayload, AppointmentService } from '@/types/models';
import MessageThread from './MessageThread';
import CustomerHistory from './CustomerHistory';
import { useAppointments } from '@/contexts/AppointmentContext';
import { useToast } from '@/components/ui/Toast';
import vehicleCatalogSeed from '@/data/vehicleCatalog';
import buildCatalogFromRaw from '@/data/vehicleCatalogFromRaw';

// Wrap the main component in React.memo to prevent unnecessary re-renders
const AppointmentDrawer = React.memo(({ open, onClose, id, onRescheduled }: { open: boolean; onClose: () => void; id: string | null; onRescheduled?: (id: string, startISO: string) => void }) => {
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState<DrawerPayload | null>(null);
  const [isAddingService, setIsAddingService] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const { refreshBoard } = useAppointments();
  const toast = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const deletedIdRef = useRef<string | null>(null);
  const loadedDataIdRef = useRef<string | null>(null);
  const [showReschedule, setShowReschedule] = useState(false);
  const [reschedAt, setReschedAt] = useState<string>('');
  const [savingReschedule, setSavingReschedule] = useState(false);
  const memoizedSetIsAddingService = useCallback((v: boolean)=>setIsAddingService(v), []);

  const handleDelete = useCallback(async () => {
    if (!id) return;
    if (!window.confirm('Delete this appointment? This cannot be undone.')) return;
    setIsDeleting(true);
    try {
      await api.deleteAppointment(id);
      toast.success('Appointment deleted');
      deletedIdRef.current = id;
      onClose();
      await refreshBoard();
    } catch (e) {
      toast.error(api.handleApiError ? api.handleApiError(e, 'Failed to delete appointment') : 'Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  }, [id, onClose, refreshBoard, toast]);
  useEffect(() => {
    let cancelled = false;

    if (open && id && id !== loadedDataIdRef.current) {
      loadedDataIdRef.current = id;
      setError(null);
      setData(null);

      const timeoutMs = 8000;
      const timeoutId = setTimeout(() => {
        if (cancelled) return;
        console.warn('⏰ Drawer load timed out');
        setError('Failed to load appointment');
        const fallbackData: DrawerPayload = {
          appointment: {
            id: id || 'fallback-id',
            status: 'SCHEDULED',
            start: null as unknown as string,
            end: null as unknown as string,
            total_amount: 0,
            paid_amount: 0,
            check_in_at: null,
            check_out_at: null,
            tech_id: null
          },
          customer: { id: 'cust-fallback', name: '—', phone: '', email: '' },
          vehicle: { id: 'veh-fallback', year: 0, make: '', model: '', vin: '' },
          services: []
        };
        setData(fallbackData);
      }, timeoutMs);

      api.getDrawer(id)
        .then(result => {
          if (cancelled) return;
            clearTimeout(timeoutId);
            setData(result);
        })
        .catch(err => {
          console.error('🔍 DEBUG: Error calling api.getDrawer:', err);
          if (cancelled) return;
          clearTimeout(timeoutId);
          if (!(deletedIdRef.current && deletedIdRef.current === id)) {
            setError('Failed to load appointment');
          }
        });

      return () => {
        cancelled = true;
        clearTimeout(timeoutId);
      };
    }

    if (!open) {
      loadedDataIdRef.current = null;
      setIsAddingService(false);
      deletedIdRef.current = null;
    }

    return () => { cancelled = true; };
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowReschedule(true)}
              disabled={!id}
              className="px-2 py-1 text-blue-600 hover:text-blue-700 disabled:opacity-50"
              title="Reschedule appointment"
            >
              Reschedule
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting || !id}
              className="px-2 py-1 text-red-600 hover:text-red-700 disabled:opacity-50"
              title="Delete appointment"
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </button>
            <button 
              ref={closeButtonRef}
              aria-label="Close drawer" 
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              ✕
            </button>
          </div>
        </div>
        {error && (
          <div className="px-4 py-2 text-sm text-red-700 bg-red-50 border-b border-red-200" role="alert">
            {error}
          </div>
        )}
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
          {tab === 'overview' && <Overview data={data} onEditTime={() => setShowReschedule(true)} />}
          {tab === 'services' && <Services data={data} isAddingService={isAddingService} setIsAddingService={memoizedSetIsAddingService} />}
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
      {/* Reschedule Modal */}
      {showReschedule && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40">
          <div className="bg-white rounded-xl p-4 w-[420px] shadow-xl">
            <h3 className="text-lg font-semibold mb-3">Reschedule appointment</h3>
            <label className="block text-sm text-gray-600 mb-1">New date & time</label>
            <input
              type="datetime-local"
              value={reschedAt}
              onChange={(e) => setReschedAt(e.target.value)}
              className="w-full border rounded px-3 py-2"
              aria-label="New date and time"
              placeholder="Select date and time"
            />
            <div className="mt-4 flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const prev = reschedAt ? new Date(reschedAt) : now;
                  prev.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
                  const pad = (n:number)=>String(n).padStart(2,'0');
                  setReschedAt(`${prev.getFullYear()}-${pad(prev.getMonth()+1)}-${pad(prev.getDate())}T${pad(prev.getHours())}:${pad(prev.getMinutes())}`);
                }}
                className="text-sm text-gray-700 underline"
              >
                Move to today
              </button>
              <div className="flex gap-2">
                <button className="px-3 py-1 rounded border" onClick={() => setShowReschedule(false)}>Cancel</button>
                <button
                  className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-60"
                  disabled={savingReschedule || !id || !reschedAt}
                  onClick={async () => {
                    if (!id || !reschedAt) return;
                    setSavingReschedule(true);
                    try {
                      const iso = new Date(reschedAt).toISOString();
                      await api.rescheduleAppointment(id, iso);
                      // Optimistic update of drawer data
                      setData(prev => prev ? { ...prev, appointment: { ...prev.appointment, start: iso } } : prev);
                      if (onRescheduled) onRescheduled(id, iso);
                      setShowReschedule(false);
                    } catch {
                      toast.error('Failed to reschedule');
                    } finally {
                      setSavingReschedule(false);
                    }
                  }}
                >
                  {savingReschedule ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default AppointmentDrawer;

import { formatInShopTZ } from '@/lib/timezone';
import { useTechnicians } from '@/hooks/useTechnicians';

function Overview({ data, onEditTime }: { data: DrawerPayload | null; onEditTime?: () => void; }) {
  const toast = useToast();
  // Technician list + assignment state (hooks must remain at top level)
  const { data: techs, isLoading: techLoading } = useTechnicians();
  const [savingTech, setSavingTech] = React.useState(false);
  const [veh, setVeh] = React.useState({ license_plate: '', year: 0, make: '', model: '' });
  const [meta, setMeta] = React.useState({ location_address: '', notes: '' });
  // Catalog for dropdowns
  const fullCatalog = useMemo(() => {
    try { return buildCatalogFromRaw(); } catch { return vehicleCatalogSeed; }
  }, []);
  const vehicleYears = useMemo(() => {
    const current = new Date().getFullYear() + 1;
    return Array.from({ length: current - 1980 + 1 }, (_, i) => current - i);
  }, []);
  const makeOptions = useMemo(() => fullCatalog.map(m => m.name).sort((a,b)=>a.localeCompare(b)), [fullCatalog]);
  const selectedMake = useMemo(() => fullCatalog.find(m => m.name.toLowerCase() === (veh.make||'').toLowerCase()), [fullCatalog, veh.make]);
  const parsedYear = useMemo(() => { const y = parseInt((veh.year||'').toString()); return isNaN(y) ? undefined : y; }, [veh.year]);
  const filteredModels = useMemo(() => {
    const result: string[] = [];
    if (selectedMake) {
      for (const mod of selectedMake.models) {
        const start = (mod.startYear ?? 1900);
        const end = (mod.endYear ?? (new Date().getFullYear()+1));
        if (!parsedYear || (parsedYear >= start && parsedYear <= end)) {
          result.push(mod.name);
        }
      }
    }
    if (veh.model && !result.includes(veh.model)) result.push(veh.model);
    return Array.from(new Set(result)).sort((a,b)=>a.localeCompare(b));
  }, [selectedMake, parsedYear, veh.model]);
  const [savingVeh, setSavingVeh] = React.useState(false);
  const [savingMeta, setSavingMeta] = React.useState(false);
  React.useEffect(() => {
    if (!data) return;
    setVeh({
  license_plate: data.vehicle?.license_plate || data.vehicle?.vin || '',
      year: data.vehicle?.year || 0,
      make: data.vehicle?.make || '',
      model: data.vehicle?.model || '',
    });
    setMeta({
      location_address: data.appointment?.location_address || '',
      notes: data.appointment?.notes || '',
    });
  }, [data]);
  if (!data) return <div>Loading…</div>;
  const a = data.appointment;
  const svcNames = (data.services || []).map(s => s.name).filter(Boolean);
  const servicesSummary = svcNames.length ? (svcNames.length > 3 ? `${svcNames.slice(0,3).join(', ')} +${svcNames.length-3} more` : svcNames.join(', ')) : '—';
  const totalFromServices = (data.services || []).reduce((sum, s) => sum + (s.estimated_price || 0), 0);
  const apptId = a.id;
  const canEdit = Boolean(apptId);
  const saveVehicle = async () => {
    if (!apptId) return;
    setSavingVeh(true);
    try {
      // Build payload only with meaningful fields to avoid 400 "No valid fields to update"
      const payload: Record<string, unknown> = {};
      const plate = (veh.license_plate || '').trim().toUpperCase();
      if (plate) payload.license_plate = plate;
      if (veh.year && Number.isFinite(veh.year)) payload.vehicle_year = veh.year;
      const make = (veh.make || '').trim();
      if (make) payload.vehicle_make = make;
      const model = (veh.model || '').trim();
      if (model) payload.vehicle_model = model;

      // Debug: see what we're about to send
      try { console.debug('[AppointmentDrawer] saveVehicle veh=', veh, 'payload=', payload); } catch { /* ignore */ }

      if (Object.keys(payload).length === 0) {
        toast.push({ kind: 'info', text: 'Nothing to save' });
        return;
      }

      await api.patchAppointment(apptId, payload);
      // Refresh drawer data so UI reflects latest vehicle linkage
      try {
        const fresh = await api.getDrawer(apptId);
        setVeh({
          license_plate: fresh.vehicle?.license_plate || fresh.vehicle?.vin || '',
          year: fresh.vehicle?.year || 0,
          make: fresh.vehicle?.make || '',
          model: fresh.vehicle?.model || '',
        });
      } catch { /* ignore refresh failure */ }

      const vehicleLabel = (payload.license_plate as string) || [veh.year || '', veh.make || '', veh.model || ''].filter(Boolean).join(' ');
      toast.success(`Car saved${vehicleLabel ? ` (${vehicleLabel})` : ''}`);
    } catch (e) {
      toast.error(api.handleApiError(e, 'Failed to save car'));
    } finally {
      setSavingVeh(false);
    }
  };
  const saveMeta = async () => {
    if (!apptId) return;
    try {
      setSavingMeta(true);
  await api.patchAppointment(apptId, {
        location_address: meta.location_address,
        notes: meta.notes,
      } as unknown as Record<string, unknown>);
  // Optional: refresh drawer on meta save to stay consistent
  try { await api.getDrawer(apptId); } catch { /* ignore */ }
  toast.success('Details saved');
    } finally {
      setSavingMeta(false);
    }
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Info label="Status" value={a.status} />
        <Info label="Start" value={formatInShopTZ(a.start, 'datetime')} />
        <Info label="Total" value={(a.total_amount != null ? a.total_amount : totalFromServices) ? `$${((a.total_amount ?? totalFromServices) || 0).toFixed(2)}` : '—'} />
        <Info label="Paid" value={a.paid_amount != null ? `$${a.paid_amount.toFixed(2)}` : '—'} />
        <Info label="Check-in" value={a.check_in_at ?? '—'} />
        <Info label="Check-out" value={a.check_out_at ?? '—'} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Info label="Customer" value={data.customer?.name ?? '—'} />
        <Info label="Phone" value={data.customer?.phone || '—'} />
        <Info label="Email" value={data.customer?.email || '—'} />
        <div className="col-span-2">
          <div className="text-sm text-gray-500 mb-1">Technician</div>
          <div className="flex gap-2 items-center">
            <select
              aria-label="Technician"
              className="border rounded px-2 py-1 flex-1"
              value={a.tech_id || ''}
              disabled={techLoading || savingTech}
              onChange={async (e) => {
                if (!a.id) return;
                const val = e.target.value || null;
                setSavingTech(true);
                try {
                  await api.patchAppointment(a.id, { tech_id: val });
                  toast.success(val ? 'Technician assigned' : 'Technician cleared');
                  try {
                    const fresh = await api.getDrawer(a.id);
                    // Light state update: only tech_id
                    data.appointment.tech_id = fresh.appointment.tech_id;
                  } catch {/* ignore */}
                } catch (err) {
                  toast.error((err as Error)?.message || 'Failed to assign technician');
                } finally {
                  setSavingTech(false);
                }
              }}
            >
              <option value="">Unassigned</option>
              {(techs || []).map(t => (
                <option key={t.id} value={t.id}>{t.initials} – {t.name}</option>
              ))}
            </select>
            {savingTech && <span className="text-xs text-gray-500">Saving…</span>}
          </div>
        </div>
        <div className="col-span-2">
          <div className="text-sm text-gray-500">Vehicle</div>
          <div className="mt-1 grid grid-cols-4 gap-2 items-center">
            <input id="license_plate" name="license_plate" aria-label="Plate" title="License plate" className="border rounded px-2 py-1 col-span-1" placeholder="Plate" value={veh.license_plate} onChange={(e)=>setVeh(v=>({ ...v, license_plate: e.target.value.toUpperCase() }))} />
            <select id="vehicle_year" name="vehicle_year" aria-label="Year" title="Vehicle year" className="border rounded px-2 py-1 col-span-1" value={veh.year||''} onChange={(e)=>setVeh(v=>({ ...v, year: Number(e.target.value)||0 }))}>
              <option value="">Year</option>
              {vehicleYears.map(y => (<option key={y} value={y}>{y}</option>))}
            </select>
            <select id="vehicle_make" name="vehicle_make" aria-label="Make" title="Vehicle make" className="border rounded px-2 py-1 col-span-1" value={veh.make} onChange={(e)=>setVeh(v=>({ ...v, make: e.target.value, model: '' }))}>
              <option value="">Make</option>
              {makeOptions.map(m => (<option key={m} value={m}>{m}</option>))}
            </select>
            <div className="col-span-1 flex gap-2">
              <select id="vehicle_model" name="vehicle_model" aria-label="Model" title="Vehicle model" className="border rounded px-2 py-1 flex-1" value={veh.model} onChange={(e)=>setVeh(v=>({ ...v, model: e.target.value }))} disabled={!veh.make}>
                <option value="">{veh.make ? 'Model' : 'Select make first'}</option>
                {filteredModels.map(m => (<option key={m} value={m}>{m}</option>))}
              </select>
              <button disabled={!canEdit || savingVeh} className="px-2 py-1 text-blue-600 disabled:opacity-50" onClick={saveVehicle} type="button">{savingVeh?'Saving…':'Save'}</button>
            </div>
          </div>
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <div className="text-sm text-gray-500">Start</div>
          <div className="flex items-center gap-2">
            <span>{formatInShopTZ(a.start, 'datetime')}</span>
            {onEditTime && (
              <button className="text-blue-600 text-sm underline" onClick={onEditTime}>Edit</button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 items-start">
        <div>
          <div className="text-sm text-gray-500">Address</div>
          <div className="flex gap-2 mt-1">
            <input id="service_address" name="service_address" aria-label="Service address" className="border rounded px-2 py-1 flex-1" placeholder="Address" value={meta.location_address} onChange={(e)=>setMeta(m=>({ ...m, location_address: e.target.value }))} />
            <button disabled={!canEdit || savingMeta} className="px-2 py-1 text-blue-600 disabled:opacity-50" type="button" onClick={saveMeta}>{savingMeta?'Saving…':'Save'}</button>
          </div>
        </div>
        <Info label="Services" value={servicesSummary} />
      </div>
      <div className="mt-2">
        <div className="text-sm text-gray-500">Notes</div>
  <textarea id="notes" name="notes" className="w-full border rounded px-2 py-1" rows={3} value={meta.notes} onChange={(e)=>setMeta(m=>({ ...m, notes: e.target.value }))} aria-label="Notes" placeholder="Add notes" />
        <div className="mt-1 flex justify-end">
          <button disabled={!canEdit || savingMeta} className="px-2 py-1 text-blue-600 disabled:opacity-50" type="button" onClick={saveMeta}>{savingMeta?'Saving…':'Save notes'}</button>
        </div>
      </div>
    </div>
  );
}

// Services component wrapped in React.memo to prevent unnecessary re-renders
const Services = React.memo(function Services({ 
  data, 
  isAddingService, 
  setIsAddingService 
}: { 
  data: DrawerPayload | null; 
  isAddingService: boolean; 
  setIsAddingService: (value: boolean) => void; 
}) {
  const [services, setServices] = useState<AppointmentService[]>([]);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [newService, setNewService] = useState({
    name: '',
    notes: '',
    estimated_hours: '',
    estimated_price: '',
  category: '',
  service_operation_id: '' as string | undefined
  });

  // Track if we've initialized services to prevent resetting form state on subsequent data updates
  const [servicesInitialized, setServicesInitialized] = useState(false);
  // Use ref to store the appointment ID to detect when we're working with a different appointment
  const currentAppointmentIdRef = useRef<string | null>(null);

  // Form persistence functions
  const getFormStorageKey = useCallback((appointmentId: string) => `appointment-form-${appointmentId}`, []);
  
  const saveFormStateToStorage = useCallback((appointmentId: string, formState: typeof newService, isAdding: boolean) => {
    try {
      const storageKey = getFormStorageKey(appointmentId);
      const state = { formState, isAdding, timestamp: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to save form state to localStorage:', error);
    }
  }, [getFormStorageKey]);
  
  const loadFormStateFromStorage = useCallback((appointmentId: string) => {
    try {
      const storageKey = getFormStorageKey(appointmentId);
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const state = JSON.parse(stored);
        // Check if the state is not too old (5 minutes)
        if (Date.now() - state.timestamp < 5 * 60 * 1000) {
          return state;
        } else {
          // Clean up old state
          localStorage.removeItem(storageKey);
        }
      }
    } catch (error) {
      console.warn('Failed to load form state from localStorage:', error);
    }
    return null;
  }, [getFormStorageKey]);
  
  const clearFormStateFromStorage = useCallback((appointmentId: string) => {
    try {
      const storageKey = getFormStorageKey(appointmentId);
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Failed to clear form state from localStorage:', error);
    }
  }, [getFormStorageKey]);

  useEffect(() => {
    if (data?.services && data?.appointment?.id) {
      const appointmentId = data.appointment.id;
      
      // If this is a different appointment, reset everything
      if (currentAppointmentIdRef.current !== appointmentId) {
        console.log('🔍 Services: New appointment detected, resetting state');
        currentAppointmentIdRef.current = appointmentId;
        setServices(data.services);
        calculateTotal(data.services);
        setServicesInitialized(true);
        setEditingServiceId(null);
        
        // Try to restore form state from localStorage
        const savedState = loadFormStateFromStorage(appointmentId);
        if (savedState) {
          console.log('🔍 Services: Restoring form state from localStorage');
          setNewService(savedState.formState);
          setIsAddingService(savedState.isAdding);
        } else {
          setNewService({ name: '', notes: '', estimated_hours: '', estimated_price: '', category: '', service_operation_id: '' });
          setIsAddingService(false);
        }
      } else {
        // Same appointment, only update services data but preserve form state
        console.log('🔍 Services: Same appointment, preserving form state');
        setServices(data.services);
        calculateTotal(data.services);
        
        if (!servicesInitialized) {
          setServicesInitialized(true);
        }
        // DON'T reset isAddingService or form state here - this preserves the form during typing
      }
    }
    // Note: setIsAddingService and servicesInitialized are intentionally omitted from dependencies to prevent infinite loops
    // React state setters are stable and don't need to be in the dependency array
    // servicesInitialized should not be a dependency as it's set within the effect and would cause infinite re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.services, data?.appointment?.id, loadFormStateFromStorage]);

  // Save form state to localStorage whenever it changes
  useEffect(() => {
    if (data?.appointment?.id && (isAddingService || newService.name || newService.notes)) {
      saveFormStateToStorage(data.appointment.id, newService, isAddingService);
    }
  }, [data?.appointment?.id, newService, isAddingService, saveFormStateToStorage]);

  const calculateTotal = (serviceList: AppointmentService[]) => {
    const totalAmount = serviceList.reduce((sum, service) => {
      return sum + (service.estimated_price || 0);
    }, 0);
    setTotal(totalAmount);
  };

  const handleAddService = async () => {
    console.log('🔧 HANDLE_ADD_SERVICE: Function called');
    console.log('🔧 HANDLE_ADD_SERVICE: data?.appointment?.id:', data?.appointment?.id);
    console.log('🔧 HANDLE_ADD_SERVICE: newService:', newService);
    
    if (!data?.appointment?.id) {
      console.log('🔧 HANDLE_ADD_SERVICE: Early return - no appointment ID');
      return;
    }
    
    // Validate required fields and numeric inputs
    if (!newService.name.trim()) {
      console.log('🔧 HANDLE_ADD_SERVICE: Early return - no service name');
      return;
    }
    
    // Check if hours is provided and valid
    const hours = newService.estimated_hours.trim();
    if (hours && (isNaN(parseFloat(hours)) || parseFloat(hours) < 0)) {
      console.log('🔧 HANDLE_ADD_SERVICE: Early return - invalid hours:', hours);
      return;
    }
    
    // Check if price is provided and valid
    const price = newService.estimated_price.trim();
    if (price && (isNaN(parseFloat(price)) || parseFloat(price) < 0)) {
      console.log('🔧 HANDLE_ADD_SERVICE: Early return - invalid price:', price);
      return;
    }
    
    console.log('🔧 HANDLE_ADD_SERVICE: All validations passed, about to call API');
    console.log('🔧 HANDLE_ADD_SERVICE: API call parameters:', {
      appointmentId: data.appointment.id,
      serviceData: {
        name: newService.name,
        notes: newService.notes,
        estimated_hours: hours ? parseFloat(hours) : undefined,
        estimated_price: price ? parseFloat(price) : undefined,
  category: newService.category,
  service_operation_id: newService.service_operation_id || undefined
      }
    });
    
    try {
      console.log('🔧 HANDLE_ADD_SERVICE: About to call api.createAppointmentService');
      const response = await api.createAppointmentService(data.appointment.id, {
        name: newService.name,
        notes: newService.notes,
        estimated_hours: hours ? parseFloat(hours) : undefined,
        estimated_price: price ? parseFloat(price) : undefined,
  category: newService.category,
  service_operation_id: newService.service_operation_id || undefined
      });
      
      console.log('🔧 HANDLE_ADD_SERVICE: API call successful, response:', response);
      
      const updatedServices = [...services, response.service];
      setServices(updatedServices);
      calculateTotal(updatedServices);
  setNewService({ name: '', notes: '', estimated_hours: '', estimated_price: '', category: '', service_operation_id: '' });
      setIsAddingService(false);
      
      // Clear form state from localStorage after successful submission
      clearFormStateFromStorage(data.appointment.id);
      
      console.log('🔧 HANDLE_ADD_SERVICE: Service added successfully, UI updated');
    } catch (error) {
      console.error('🔧 HANDLE_ADD_SERVICE: Error caught:', error);
      console.error('🔧 HANDLE_ADD_SERVICE: Error type:', typeof error);
      if (error instanceof Error) {
        console.error('🔧 HANDLE_ADD_SERVICE: Error constructor:', error.constructor.name);
        console.error('🔧 HANDLE_ADD_SERVICE: Error stack:', error.stack);
        console.error('🔧 HANDLE_ADD_SERVICE: Error message:', error.message);
      }
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddService();
            }}
            className="space-y-3"
          >
            <CatalogServicePicker setNewService={setNewService} />
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
                type="submit"
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
                type="button"
                onClick={() => {
                  setIsAddingService(false);
              setNewService({ name: '', notes: '', estimated_hours: '', estimated_price: '', category: '', service_operation_id: '' });
                  // Clear form state from localStorage when cancelling
                  if (data?.appointment?.id) {
                    clearFormStateFromStorage(data.appointment.id);
                  }
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </form>
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
          />)
        )}
      </div>
    </div>
  );
});

  // Small helper component for catalog-based service selection inside add form
  function CatalogServicePicker({ setNewService }: { setNewService: React.Dispatch<React.SetStateAction<{ name: string; notes: string; estimated_hours: string; estimated_price: string; category: string; service_operation_id: string | undefined }>> }) {
    const [selectedOp, setSelectedOp] = useState<ServiceOperationSelectValue | null>(null);

    // When an operation is picked, prefill fields if blank
    useEffect(() => {
      if (selectedOp) {
    setNewService((prev) => ({
          ...prev,
          name: selectedOp.name,
          category: selectedOp.category || prev.category,
          estimated_hours: prev.estimated_hours || (selectedOp.defaultHours != null ? String(selectedOp.defaultHours) : ''),
          estimated_price: prev.estimated_price || (selectedOp.defaultPrice != null ? String(selectedOp.defaultPrice) : ''),
          service_operation_id: selectedOp.id,
        }));
      }
    }, [selectedOp, setNewService]);

    return (
    <div>
        <ServiceOperationSelect
          value={selectedOp}
          onChange={setSelectedOp}
          required
          allowCustom={false}
        />
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
