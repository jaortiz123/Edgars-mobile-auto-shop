import React, { useEffect, useState } from 'react';
import type { CarOnPremises } from '../../types/models';
import * as api from '../../lib/api';

export default function CarsOnPremisesWidget() {
  const [rows, setRows] = useState<CarOnPremises[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const data = await api.getCarsOnPremises();
        setRows(data);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Cars on Premises</h3>
        <span className="text-sm text-gray-500">{rows.length}</span>
      </div>
      <div className="space-y-2 max-h-80 overflow-auto">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between border-b last:border-b-0 pb-2">
            <div>
              <div className="font-medium">{r.make ?? '—'} {r.model ?? ''}</div>
              <div className="text-xs text-gray-500">{r.owner ?? 'Unknown'}</div>
            </div>
            <div className="text-right text-xs text-gray-600">
              <div>{r.status}</div>
              <div>{r.arrivalTime}</div>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="text-sm text-gray-500">No vehicles currently checked in.</div>
        )}
      </div>
    </div>
  );
}