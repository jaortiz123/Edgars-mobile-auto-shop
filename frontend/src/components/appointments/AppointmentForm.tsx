import React, { useState, useMemo, useEffect } from 'react';
import * as api from '@/lib/api';
import CustomerSearchInput, { CustomerSearchResult } from '@/components/appointments/CustomerSearchInput';
import { useTechnicians } from '@/hooks/useTechnicians';
import ServiceCatalogModal, { ServiceOperation } from '@/components/appointments/ServiceCatalogModal';

export interface AppointmentFormValues {
  title: string;
  start: string; // ISO local input value (yyyy-MM-ddTHH:mm)
  end: string;   // ISO local input value (optional)
  status: string;
  customerId?: string | null;
  vehicleId?: string | null;
  techId?: string | null;
}

export interface AppointmentFormProps {
  mode: 'create' | 'edit';
  initial?: Partial<AppointmentFormValues>;
  /** Appointment id (required in edit mode for PATCH). */
  appointmentId?: string | null;
  /** Initial services (service catalog lite objects) for edit mode. */
  initialServices?: ServiceOperation[];
  onSubmit?: (values: AppointmentFormValues) => void; // optional external hook (called after successful local processing)
  onCancel?: () => void;
  disabled?: boolean;
  onCreated?: (id: string) => void; // fired when creation succeeds
  /**
   * Optional preset customer used primarily for integration tests or flows where the customer
   * context is already known (e.g. creating an appointment from a customer profile page).
   * When provided, the search input is hidden and the form is initialized with this customer.
   */
  presetCustomer?: CustomerSearchResult | null;
}

const STATUS_OPTIONS = ['SCHEDULED','IN_PROGRESS','READY','COMPLETED','NO_SHOW','CANCELED'];

function toInputLocal(dt?: string | null): string {
  if (!dt) return '';
  try {
    const d = new Date(dt);
    if (isNaN(d.getTime())) return '';
    const pad = (n:number)=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ''; }
}

const AppointmentForm: React.FC<AppointmentFormProps> = ({ mode, initial, appointmentId, initialServices, onSubmit, onCancel, disabled, onCreated, presetCustomer }) => {
  const [values, setValues] = useState<AppointmentFormValues>({
    title: initial?.title || '',
    start: toInputLocal(initial?.start) || '',
    end: toInputLocal(initial?.end) || '',
    status: initial?.status || 'SCHEDULED',
    customerId: (initial && 'customerId' in initial ? (initial as Partial<AppointmentFormValues>).customerId : null) || null,
  vehicleId: (initial && 'vehicleId' in initial ? (initial as Partial<AppointmentFormValues>).vehicleId : null) || null,
  techId: (initial && 'techId' in initial ? (initial as Partial<AppointmentFormValues>).techId : null) || null
  });
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(presetCustomer || null);
  const { data: technicians = [], isLoading: techLoading } = useTechnicians();
  const [services, setServices] = useState<ServiceOperation[]>(initialServices || []);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string,string[]>>({});

  function update<K extends keyof AppointmentFormValues>(key: K, val: AppointmentFormValues[K]) {
    setValues(v => ({ ...v, [key]: val }));
  }

  // When customer changes, reset vehicle selection
  function handleCustomerChange(c: CustomerSearchResult | null) {
    setSelectedCustomer(c);
    setValues(v => ({ ...v, customerId: c?.customerId || null, vehicleId: null }));
  }

  const vehicleOptions = useMemo(() => selectedCustomer?.vehicles || [], [selectedCustomer]);

  // Initialize from preset customer (if provided) on mount
  useEffect(() => {
    if (presetCustomer) {
      setValues(v => ({ ...v, customerId: presetCustomer.customerId }));
    }
  // we only want this to run once for the initial preset
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Populate edit mode from incoming initial values (one-shot when switching to edit)
  useEffect(() => {
    if (mode === 'edit' && initial) {
      setValues(v => ({
        ...v,
        title: initial.title || '',
        start: toInputLocal(initial.start) || '',
        end: toInputLocal(initial.end) || '',
        status: initial.status || 'SCHEDULED',
        customerId: (initial as Partial<AppointmentFormValues>).customerId || null,
        vehicleId: (initial as Partial<AppointmentFormValues>).vehicleId || null,
        techId: (initial as Partial<AppointmentFormValues>).techId || null
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, appointmentId]);

  // Auto-select the single vehicle if exactly one exists for the chosen customer
  useEffect(() => {
    if (selectedCustomer && vehicleOptions.length === 1) {
      setValues(v => ({ ...v, vehicleId: vehicleOptions[0].vehicleId }));
    }
  }, [selectedCustomer, vehicleOptions]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
  setErrors([]);
  setFieldErrors({});
    if (!values.start) {
      setErrors(['Start time is required']);
      return;
    }
    if (!values.customerId) {
      setErrors(['Customer is required']);
      return;
    }
    if (mode === 'create') {
      try {
        setSubmitting(true);
        // Map fields to backend payload
        const startISO = values.start ? new Date(values.start).toISOString() : undefined;
        const endISO = values.end ? new Date(values.end).toISOString() : undefined;
        const payload: Record<string, unknown> = {
          status: values.status || 'SCHEDULED',
          start_ts: startISO,
        };
        if (endISO) payload.end_ts = endISO;
        if (values.title.trim()) payload.notes = values.title.trim();
  if (values.customerId) payload.customer_id = values.customerId;
  if (values.vehicleId) payload.vehicle_id = values.vehicleId;
  if (values.techId) payload.tech_id = values.techId;
  if (services.length) payload.service_operation_ids = services.map(s => s.id);
        const result = await api.createAppointment(payload as unknown as Record<string, unknown>);
        try {
          // fire a lightweight global event so board/listeners can refresh
          window.dispatchEvent(new CustomEvent('appointments:created', { detail: { id: result.id } }));
        } catch { /* ignore */ }
        onSubmit?.(values);
        onCreated?.(result.id);
      } catch (err: unknown) {
        let parsed = false;
        if (err && typeof err === 'object' && 'response' in err) {
          try {
            const respData = (err as any).response?.data; // eslint-disable-line @typescript-eslint/no-explicit-any
            if (respData && typeof respData === 'object' && Array.isArray((respData as { errors?: unknown }).errors)) {
              const rawErrors = (respData as { errors?: unknown }).errors;
              const errs = (rawErrors as Array<{ detail?: string; field?: string }>) || [];
              const fe: Record<string,string[]> = {};
              const general: string[] = [];
              for (const e of errs) {
                if (e.field) {
                  if (!fe[e.field]) fe[e.field] = [];
                  fe[e.field].push(e.detail || 'Invalid value');
                } else if (e.detail) {
                  general.push(e.detail);
                }
              }
              setFieldErrors(fe);
              setErrors(general);
              parsed = true;
            }
          } catch { /* ignore */ }
        }
        if (!parsed) {
          const msg = (err instanceof Error ? err.message : 'Failed to create appointment');
          setErrors([msg]);
        }
      } finally {
        setSubmitting(false);
      }
    } else {
      // EDIT MODE PATCH
      if (!appointmentId) {
        setErrors(['Missing appointment id for edit']);
        return;
      }
      try {
        setSubmitting(true);
        const startISO = values.start ? new Date(values.start).toISOString() : undefined;
        const endISO = values.end ? new Date(values.end).toISOString() : undefined;
        const payload: Record<string, unknown> = {};
        if (values.status) payload.status = values.status;
        if (startISO) payload.start = startISO; // backend expects 'start'
        if (endISO) payload.end = endISO;
        if (values.title.trim()) payload.notes = values.title.trim();
        if (values.techId !== undefined) payload.tech_id = values.techId || null;
        if (values.vehicleId) payload.vehicle_id = values.vehicleId;
        if (services.length) payload.service_operation_ids = services.map(s => s.id);
        await api.patchAppointment(appointmentId, payload as unknown as Record<string, unknown>);
        try { window.dispatchEvent(new CustomEvent('appointments:updated', { detail: { id: appointmentId } })); } catch { /* ignore */ }
        onSubmit?.(values);
        // close handled upstream via onCancel or parent action
      } catch (err: unknown) {
        let parsed = false;
        if (err && typeof err === 'object' && 'response' in err) {
          try {
            const respData = (err as any).response?.data; // eslint-disable-line @typescript-eslint/no-explicit-any
            if (respData && typeof respData === 'object' && Array.isArray((respData as { errors?: unknown }).errors)) {
              const rawErrors = (respData as { errors?: unknown }).errors;
              const errs = (rawErrors as Array<{ detail?: string; field?: string }>) || [];
              const fe: Record<string,string[]> = {};
              const general: string[] = [];
              for (const e of errs) {
                if (e.field) {
                  if (!fe[e.field]) fe[e.field] = [];
                  fe[e.field].push(e.detail || 'Invalid value');
                } else if (e.detail) {
                  general.push(e.detail);
                }
              }
              setFieldErrors(fe);
              setErrors(general);
              parsed = true;
            }
          } catch { /* ignore parse */ }
        }
        if (!parsed) setErrors([err instanceof Error ? err.message : 'Failed to update appointment']);
      } finally {
        setSubmitting(false);
      }
    }
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Appointment form">
      {errors.length > 0 && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700" role="alert">
          <ul className="list-disc ml-4 space-y-0.5">
            {errors.map((e,i)=>(<li key={i}>{e}</li>))}
          </ul>
        </div>
      )}
      <div>
        {presetCustomer ? (
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Customer</label>
            <div className="px-3 py-2 border rounded bg-gray-50 text-sm" data-testid="preset-customer-display">
              <span className="font-medium">{presetCustomer.name}</span>
              <span className="block text-xs text-muted-foreground">
                {presetCustomer.phone || presetCustomer.email || 'Customer selected'}
              </span>
            </div>
          </div>
        ) : (
          mode === 'edit' ? (
            // In edit mode, customer is fixed (backend edit of customer_id not yet supported here)
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Customer</label>
              <div className="px-3 py-2 border rounded bg-gray-50 text-sm">
                <span className="font-medium">{selectedCustomer?.name || '—'}</span>
                <span className="block text-xs text-muted-foreground">{selectedCustomer?.phone || selectedCustomer?.email || ''}</span>
              </div>
            </div>
          ) : (
            <CustomerSearchInput
              value={selectedCustomer}
              onChange={handleCustomerChange}
              disabled={disabled || submitting}
              label="Customer"
            />
          )
        )}
        {fieldErrors.customer_id && <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.customer_id.join(', ')}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="appt-tech">Technician</label>
        <select
          id="appt-tech"
          className="w-full border rounded px-3 py-2"
          value={values.techId || ''}
          onChange={e => setValues(v => ({ ...v, techId: e.target.value || null }))}
          disabled={disabled || submitting || techLoading}
        >
          <option value="">Unassigned</option>
          {technicians.map(t => (
            <option key={t.id} value={t.id}>{t.initials || t.name}</option>
          ))}
        </select>
        {fieldErrors.tech_id && <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.tech_id.join(', ')}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="appt-vehicle">Vehicle</label>
        <select
          id="appt-vehicle"
          className="w-full border rounded px-3 py-2"
          value={values.vehicleId || ''}
          onChange={e => update('vehicleId', e.target.value || null)}
          disabled={disabled || submitting || !selectedCustomer || vehicleOptions.length === 0}
        >
          <option value="">{!selectedCustomer ? 'Select customer first' : (vehicleOptions.length ? 'Select vehicle' : 'No vehicles')}</option>
          {vehicleOptions.map(v => (
            <option key={v.vehicleId} value={v.vehicleId}>
              {v.plate ? `${v.plate} – ${v.vehicle || 'Vehicle'}` : (v.vehicle || 'Vehicle')}
            </option>
          ))}
        </select>
        {fieldErrors.vehicle_id && <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.vehicle_id.join(', ')}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="appt-title">Title</label>
        <input
          id="appt-title"
          type="text"
          value={values.title}
          onChange={e => update('title', e.target.value)}
          className="w-full border rounded px-3 py-2"
          placeholder={mode === 'create' ? 'Oil change for John' : 'Edit title'}
          aria-label="Appointment title"
          disabled={disabled || submitting}
        />
  {fieldErrors.title && <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.title.join(', ')}</p>}
      </div>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="appt-start">Start</label>
          <input
            id="appt-start"
            type="datetime-local"
            required
            value={values.start}
            onChange={e => update('start', e.target.value)}
            className="w-full border rounded px-3 py-2"
            aria-label="Start time"
            placeholder="Start time"
            disabled={disabled || submitting}
          />
          {fieldErrors.start_ts && <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.start_ts.join(', ')}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="appt-end">End (optional)</label>
          <input
            id="appt-end"
            type="datetime-local"
            value={values.end}
            onChange={e => update('end', e.target.value)}
            className="w-full border rounded px-3 py-2"
            aria-label="End time"
            placeholder="End time"
            disabled={disabled || submitting}
          />
          {fieldErrors.end_ts && <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.end_ts.join(', ')}</p>}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="appt-status">Status</label>
        <select
          id="appt-status"
          value={values.status}
          onChange={e => update('status', e.target.value)}
          className="w-full border rounded px-3 py-2"
          aria-label="Status"
          disabled={disabled || submitting}
        >
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
  {fieldErrors.status && <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.status.join(', ')}</p>}
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="block text-sm font-medium text-gray-700">Services</span>
          <button
            type="button"
            className="text-xs px-2 py-1 border rounded"
            onClick={() => setServiceModalOpen(true)}
            disabled={disabled || submitting}
          >Add Service</button>
        </div>
        {services.length === 0 && (
          <p className="text-xs text-muted-foreground">No services added</p>
        )}
        {services.length > 0 && (
          <ul className="divide-y border rounded bg-white">
            {services.map(s => (
              <li key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <div className="flex flex-col flex-1">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground flex gap-2">
                    {s.category && <span>{s.category}</span>}
                    {s.base_labor_rate != null && <span>${s.base_labor_rate.toFixed(2)}</span>}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setServices(list => list.filter(x => x.id !== s.id))}
                  className="ml-3 text-xs px-2 py-1 border rounded hover:bg-red-50"
                  aria-label={`Remove ${s.name}`}
                >Remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex gap-2 pt-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-4 py-2 border rounded" disabled={disabled || submitting}>Cancel</button>
        )}
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60"
          disabled={disabled || submitting || !values.customerId}
          title="Save appointment details (time, customer, vehicle, status)"
        >
          {submitting ? 'Saving Details…' : 'Save Details'}
        </button>
      </div>
  </form>
  <ServiceCatalogModal
      open={serviceModalOpen}
  onAdd={() => {
        // Inline add collects in local selection; we only persist on confirm to mimic batch behavior.
        // No immediate state change here; rely on confirm for deterministic ordering.
      }}
      onClose={() => setServiceModalOpen(false)}
      onConfirm={(sel) => setServices(prev => {
        const map = new Map<string, ServiceOperation>();
        [...prev, ...sel].forEach(s => map.set(s.id, s));
        return Array.from(map.values());
      })}
    />
  </>
  );
};

export default AppointmentForm;
