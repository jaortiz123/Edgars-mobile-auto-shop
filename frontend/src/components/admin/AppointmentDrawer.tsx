import React, { useEffect, useRef, useState } from 'react';
import { Tabs } from '@/components/ui/Tabs';
import * as api from '@/lib/api';
import type { DrawerPayload } from '@/types/models';

export default function AppointmentDrawer({ open, onClose, id }: { open: boolean; onClose: () => void; id: string | null }) {
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState<DrawerPayload | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && id) {
      setData(null);
      void api.getDrawer(id).then(setData).catch(console.error);
    }
  }, [open, id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && open) onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div ref={ref} className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 id="drawer-title" className="text-lg font-semibold">Appointment</h2>
          <button aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <Tabs
          value={tab}
          onValueChange={setTab}
          tabs={[{ value: 'overview', label: 'Overview' }, { value: 'services', label: 'Services' }]}
        />
        <div className="p-4 overflow-auto flex-1">
          {tab === 'overview' && <Overview data={data} />}
          {tab === 'services' && <Services data={data} />}
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
  if (!data) return <div>Loading…</div>;
  if (!data.services?.length) return <div className="text-sm text-gray-500">No services yet.</div>;
  return (
    <div className="space-y-2">
      {data.services.map((s) => (
        <div key={s.id} className="border rounded p-3">
          <div className="font-medium">{s.name}</div>
          <div className="text-sm text-gray-600">{s.notes}</div>
          <div className="text-sm mt-1">{s.estimated_hours ? `${s.estimated_hours}h` : ''} {s.estimated_price ? ` • $${s.estimated_price.toFixed(2)}` : ''}</div>
        </div>
      ))}
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
