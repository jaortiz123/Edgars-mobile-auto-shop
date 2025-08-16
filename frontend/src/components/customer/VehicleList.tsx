import React from 'react';
import type { CustomerProfileResponse } from '@/lib/customerProfileApi';
import { formatCurrency } from '@/utils/format';

interface Props {
  vehicles: CustomerProfileResponse['vehicles'];
  // Optionally pass a map of vehicleId -> overdue flag if backend expands later
  overdueMap?: Record<string, boolean>;
  onViewHistory?: (vehicleId: string) => void;
}

function vehicleLabel(v: CustomerProfileResponse['vehicles'][number]): string {
  const year = v.year ? `${v.year}` : '';
  const make = v.make || '';
  const model = v.model || '';
  const parts = [year, make, model].filter(Boolean);
  return parts.length ? parts.join(' ') : (v.plate || 'Unknown Vehicle');
}

export function VehicleList({ vehicles, overdueMap = {}, onViewHistory }: Props) {
  if (!vehicles.length) {
    return <div className="text-sm text-gray-500" data-testid="vehicle-list-empty">No vehicles on record.</div>;
  }
  return (
    <div className="space-y-3" data-testid="vehicle-list">
      {vehicles.map(v => {
        const overdue = overdueMap[v.id] === true; // (future: API might supply per-vehicle overdue metric)
        return (
          <div key={v.id} className="border rounded p-4 bg-white shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" data-testid="vehicle-item">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold" data-testid="vehicle-label">{vehicleLabel(v)}</span>
                {v.plate && <span className="text-xs px-2 py-0.5 rounded bg-gray-100 border" data-testid="vehicle-plate">{v.plate}</span>}
                {overdue && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-500 text-white" data-testid="vehicle-badge-overdue">Overdue</span>
                )}
              </div>
              <div className="mt-1 text-sm text-gray-600 flex flex-wrap gap-4" data-testid="vehicle-stats">
                <span data-testid="vehicle-visits">Visits: {v.visits ?? 0}</span>
                <span data-testid="vehicle-totalSpent">Spent: {formatCurrency(typeof v.totalSpent === 'number' ? v.totalSpent : Number(v.totalSpent) || 0)}</span>
              </div>
            </div>
            <div>
              <button
                type="button"
                className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50"
                data-testid="vehicle-view-history-btn"
                onClick={() => onViewHistory?.(v.id)}
              >
                View Vehicle History
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default VehicleList;
