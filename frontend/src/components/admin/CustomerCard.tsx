import React from 'react';

export interface CustomerVehicleInfo {
  vehicleId: string;
  plate?: string;
  vehicle?: string; // make/model string
  visitsCount: number;
  lastVisit?: string | null;
}

export interface CustomerCardProps {
  customerId: string;
  name: string;
  phone?: string;
  email?: string;
  vehicles: CustomerVehicleInfo[];
  onViewHistory?: (customerId: string) => void;
}

export function CustomerCard({ customerId, name, phone, email, vehicles, onViewHistory }: CustomerCardProps) {
  const primaryContact = phone || email || 'No contact info';
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm flex flex-col gap-3" data-testid={`customer-card-${customerId}`}>
      <div>
        <div className="text-lg font-semibold" data-testid="customer-name">{name}</div>
        <div className="text-sm text-gray-600" data-testid="customer-contact">{primaryContact}</div>
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
              <span className="text-gray-500">{v.visitsCount} visit{v.visitsCount === 1 ? '' : 's'}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-auto">
        <button
          type="button"
          onClick={() => onViewHistory?.(customerId)}
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
          data-testid="customer-view-history"
        >
          View Full History →
        </button>
      </div>
    </div>
  );
}

export default CustomerCard;
