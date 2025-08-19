import React, { useState } from 'react';
import type { CustomerProfileResponse } from '@/lib/customerProfileApi';
import { formatCurrency } from '@/utils/format';

interface Props {
  appointments: CustomerProfileResponse['appointments'];
  showDetails?: boolean;
  onToggleDetails?: (next: boolean) => void;
}

function vehicleLabel(appt: CustomerProfileResponse['appointments'][number]): string {
  const v = appt.vehicle || {};
  const year = v.year ? String(v.year) : '';
  const make = v.make || '';
  const model = v.model || '';
  const parts = [year, make, model].filter(Boolean);
  return parts.length ? parts.join(' ') : (v.plate || '—');
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(); } catch { return '—'; }
}

// Single appointment row with optional expandable details
function AppointmentRow({ appt, showDetails }: { appt: CustomerProfileResponse['appointments'][number]; showDetails: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const toggle = () => {
    if (!showDetails) return; // ignore clicks when details not loaded
    setExpanded(e => !e);
  };
  const hasDetails = !!(appt.services || appt.payments || appt.messages);
  return (
    <>
      <tr
        className={`border-b last:border-0 cursor-${showDetails ? 'pointer' : 'default'} hover:bg-${showDetails ? 'gray-50' : 'transparent'}`}
        data-testid="appointment-row"
        onClick={toggle}
      >
        <td className="py-2 px-3 whitespace-nowrap" data-testid={`appt-date-${appt.id}`}>{formatDate(appt.start)}</td>
        <td className="py-2 px-3" data-testid={`appt-vehicle-${appt.id}`}>{vehicleLabel(appt)}</td>
        <td className="py-2 px-3" data-testid={`appt-status-${appt.id}`}>{appt.status}</td>
        <td className="py-2 px-3" data-testid={`appt-total-${appt.id}`}>{formatCurrency(appt.totalAmount || 0)}</td>
        <td className="py-2 px-3" data-testid={`appt-actions-${appt.id}`}>
          <button
            type="button"
            className="text-blue-600 hover:underline text-xs"
            data-testid={`appt-view-${appt.id}`}
            onClick={e => { e.stopPropagation(); toggle(); }}
            disabled={!showDetails}
          >
            {expanded ? 'Hide Details' : 'View Details'}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr data-testid={`appointment-details-row-${appt.id}`}>
          <td colSpan={5} className="bg-gray-50 px-4 py-3 text-xs space-y-4" data-testid={`appointment-details-${appt.id}`}>
            {!hasDetails && (
              <div className="italic text-gray-500" data-testid={`appt-details-missing-${appt.id}`}>No detailed data loaded for this appointment.</div>
            )}
            {appt.services && appt.services.length > 0 && (
              <div data-testid={`appt-services-${appt.id}`}>
                <div className="font-semibold mb-1">Services ({appt.services.length})</div>
                <ul className="list-disc ml-4 space-y-0.5">
                  {appt.services.map((raw: unknown, i: number) => {
                    const s = raw as Record<string, unknown>;
                    const name = (s.name as string) || (s.description as string) || 'Service';
                    const price = s.estimated_price != null ? ` – ${formatCurrency(Number(s.estimated_price))}` : '';
                    return (
                      <li key={(s.id as string) || i} className="truncate" data-testid={`appt-service-${appt.id}-${i}`}>{name}{price}</li>
                    );
                  })}
                </ul>
              </div>
            )}
            {appt.payments && appt.payments.length > 0 && (
              <div data-testid={`appt-payments-${appt.id}`}>
                <div className="font-semibold mb-1">Payments ({appt.payments.length})</div>
                <ul className="list-disc ml-4 space-y-0.5">
                  {appt.payments.map((raw: unknown, i: number) => {
                    const p = raw as Record<string, unknown>;
                    const label = (p.method as string) || 'Payment';
                    const amount = formatCurrency(Number(p.amount || 0));
                    return (
                      <li key={(p.id as string) || i} data-testid={`appt-payment-${appt.id}-${i}`}>{label}: {amount}</li>
                    );
                  })}
                </ul>
              </div>
            )}
            {appt.messages && appt.messages.length > 0 && (
              <div data-testid={`appt-messages-${appt.id}`}>
                <div className="font-semibold mb-1">Messages ({appt.messages.length})</div>
                <ul className="list-disc ml-4 space-y-0.5">
                  {appt.messages.map((raw: unknown, i: number) => {
                    const m = raw as Record<string, unknown>;
                    const channel = m.channel ? `[${m.channel}] ` : '';
                    const body = (m.body as string) || (m.text as string) || 'Message';
                    return (
                      <li key={(m.id as string) || i} data-testid={`appt-message-${appt.id}-${i}`}>{channel}{body}</li>
                    );
                  })}
                </ul>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function AppointmentHistory({ appointments, showDetails = false, onToggleDetails }: Props) {
  if (!appointments.length) {
    return <div className="text-sm text-gray-500" data-testid="appointments-empty">No appointments yet.</div>;
  }
  return (
    <div data-testid="appointments-table-wrapper" className="overflow-x-auto space-y-3">
      <div className="flex items-center gap-3" data-testid="appointments-controls">
        <label className="flex items-center gap-2 text-sm select-none cursor-pointer">
          <input
            type="checkbox"
            checked={showDetails}
            onChange={e => onToggleDetails?.(e.target.checked)}
            data-testid="toggle-show-details"
          />
          <span>Show Full Details</span>
        </label>
      </div>
      <table className="min-w-full text-sm" data-testid="appointments-table">
        <thead>
          <tr className="text-left border-b bg-gray-50" data-testid="appointments-header-row">
            <th className="py-2 px-3" data-testid="col-date">Date</th>
            <th className="py-2 px-3" data-testid="col-vehicle">Vehicle</th>
            <th className="py-2 px-3" data-testid="col-status">Status</th>
            <th className="py-2 px-3" data-testid="col-total">Total</th>
            <th className="py-2 px-3" data-testid="col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map(a => (
            <AppointmentRow key={a.id} appt={a} showDetails={showDetails} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AppointmentHistory;
