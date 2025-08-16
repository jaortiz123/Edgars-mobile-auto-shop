import React from 'react';
import { formatCurrency } from '@/utils/format';

export interface CustomerVehicleInfo {
  vehicleId: string;
  plate?: string;
  vehicle?: string; // make/model string
  visitsCount?: number; // Optional for recent customers where we don't have per-vehicle visit counts
  lastVisit?: string | null;
}

export interface CustomerCardProps {
  customerId: string;
  name: string;
  phone?: string;
  email?: string;
  vehicles: CustomerVehicleInfo[];
  totalSpent?: number; // aggregate
  badges?: string[]; // Additional external badges (e.g. Recent)
  isVip?: boolean;
  isOverdueForService?: boolean;
  onViewHistory?: (customerId: string) => void;
  onBookAppointment?: (customerId: string) => void;
}

export function CustomerCard({ customerId, name, phone, email, vehicles, totalSpent, badges = [], isVip, isOverdueForService, onViewHistory, onBookAppointment }: CustomerCardProps) {
  const derivedBadges: string[] = [];
  if (isVip) derivedBadges.push('VIP');
  if (isOverdueForService) derivedBadges.push('Overdue');
  const allBadges = [...derivedBadges, ...badges];
  const primaryContact = phone || email || 'No contact info';
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm flex flex-col gap-3" data-testid={`customer-card-${customerId}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-lg font-semibold flex items-center gap-2" data-testid="customer-name">
            {name}
            {allBadges.map(b => (
              <span key={b} className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${b === 'VIP' ? 'bg-yellow-50 text-yellow-700 border-yellow-300' : b === 'Overdue' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`} data-testid="customer-badge">{b}</span>
            ))}
          </div>
          <div className="text-sm text-gray-600" data-testid="customer-contact">{primaryContact}</div>
          {typeof totalSpent === 'number' && (
            <div className="text-xs text-gray-500 mt-1" data-testid="customer-total-spent">Total Spent: {formatCurrency(totalSpent)}</div>
          )}
        </div>
      </div>
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Vehicles</div>
        {vehicles.length === 0 && <div className="text-xs text-gray-500" data-testid="customer-no-vehicles">No vehicles</div>}
        <ul className="space-y-1">
          {vehicles.map(v => (
            <li key={v.vehicleId} className="text-xs text-gray-700 flex items-center justify-between" data-testid="customer-vehicle">
              <span className="font-mono">
                {v.plate || '—'}{v.vehicle ? ` • ${v.vehicle}` : ''}
              </span>
              {typeof v.visitsCount === 'number' && (
                <span className="text-gray-500">{v.visitsCount} visit{v.visitsCount === 1 ? '' : 's'}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-auto flex gap-4 items-center">
        <button
          type="button"
          onClick={() => onViewHistory?.(customerId)}
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
          data-testid="customer-view-history"
        >
          View Full History →
        </button>
        <button
          type="button"
          onClick={() => onBookAppointment?.(customerId)}
          className="inline-flex items-center gap-1 text-sm font-medium text-green-600 hover:text-green-700"
          data-testid="customer-book-appt"
        >
          + Book Appointment
        </button>
      </div>
    </div>
  );
}

export default CustomerCard;
