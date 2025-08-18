import { useParams } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { useCustomerProfileInfinite } from '@/hooks/useCustomerProfileInfinite';
import { money, dtLocal } from '@/utils/format';

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [vehicleId, setVehicleId] = useState<string | undefined>();
  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage, error } = useCustomerProfileInfinite(id || '', { vehicleId, includeInvoices: true, pageSize: 25 });

  const first = data?.pages?.[0];
  const stats = first?.stats;
  const vehicles = first?.vehicles || [];
  const appointments = useMemo(() => (data?.pages || []).flatMap(p => p.appointments), [data]);

  if (!id) return <div className="p-4">Missing customer id.</div>;
  if (error) return <div className="p-4 text-red-600">{String(error)}</div>;
  if (isLoading && !first) return <div className="p-4">Loading…</div>;

  return (
    <div className="space-y-6 p-4">
      {/* Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="Lifetime Spend" value={money(stats?.lifetime_spend)} />
        <StatCard label="Unpaid Balance" value={money(stats?.unpaid_balance)} />
        <StatCard label="Total Visits" value={stats?.total_visits ?? 0} />
        <StatCard label="Last Visit" value={dtLocal(stats?.last_visit_at)} />
      </section>

      {/* Vehicles */}
      <section>
        <h3 className="text-sm font-semibold mb-2">Vehicles</h3>
        <div className="flex flex-wrap gap-2">
          {vehicles.map(v => (
            <button key={v.id} onClick={() => setVehicleId(v.id)} className={`px-3 py-1 rounded-full border ${vehicleId===v.id? 'bg-primary text-primary-foreground':'bg-background'}`}>
              {v.year ?? '—'} {v.make ?? ''} {v.model ?? ''}
            </button>
          ))}
        </div>
      </section>

      {/* Appointment history */}
      <section>
        <h3 className="text-sm font-semibold mb-2">Appointment History</h3>
        <ul className="divide-y rounded-xl border">
          {appointments.map(a => (
            <li key={a.id} className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{dtLocal(a.scheduled_at)}</div>
                  <div className="text-xs opacity-70">{a.status}</div>
                  <div className="text-xs mt-1">{a.services.map(s => s.name).join(', ')}</div>
                </div>
                {a.invoice && (
                  <div className="text-right text-sm">
                    <div>Total: {money(a.invoice.total)}</div>
                    <div className="opacity-70">Paid: {money(a.invoice.paid)} • Unpaid: {money(a.invoice.unpaid)}</div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
        {hasNextPage && (
          <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="mt-3 px-3 py-2 rounded border">
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        )}
      </section>

      {/* Buttons */}
      <section className="flex gap-2">
        <button className="px-3 py-2 rounded border" onClick={() => {/* open EditCustomer modal */}}>Edit Customer</button>
        <button className="px-3 py-2 rounded border" onClick={() => { location.assign(`/admin/appointments/new?customer_id=${id}`); }}>Book Appointment</button>
        {vehicleId && <button className="px-3 py-2 rounded border" onClick={() => {/* already filtered by vehicleId */}}>View Vehicle History</button>}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="p-3 rounded-xl border">
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
