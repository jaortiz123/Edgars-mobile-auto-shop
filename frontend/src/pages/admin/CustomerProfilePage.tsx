import { useParams } from 'react-router-dom';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useCustomerProfileInfinite } from '@/hooks/useCustomerProfileInfinite';
import { money, dtLocal } from '@/utils/format';
import { useRoving } from '@/hooks/useRoving';

function useInitialFocus<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current; if (el) { setTimeout(() => el.focus(), 0); }
  }, []);
  return ref;
}

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [vehicleId, setVehicleId] = useState<string | undefined>();
  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage, error } = useCustomerProfileInfinite(id || '', { vehicleId, includeInvoices: true, pageSize: 25 });

  const first = data?.pages?.[0];
  const stats = first?.stats;
  const vehicles = first?.vehicles || [];
  interface Vehicle { id:string; year?:number; make?:string; model?:string; }
  interface Service { name:string }
  interface Appointment { id:string; vehicle_id:string; scheduled_at:string|null; status:string; services:Service[]; invoice?: { total:number; paid:number; unpaid:number } | null }
  type Page = { appointments: Appointment[] };
  const appointments: Appointment[] = useMemo(
    () => (data?.pages as Page[] | undefined)?.flatMap(p => p.appointments) || [],
    [data]
  );

  const titleRef = useInitialFocus<HTMLHeadingElement>();

  // Skeletons & helpers
  const TileSkeleton = () => <div className="p-3 rounded-xl border animate-pulse h-16" />;
  const RowSkeleton = () => <div className="p-3 animate-pulse h-14" />;

  // Derived appointment list & roving (hooks before any early return)
  const ids = appointments.map((a: Appointment) => a.id);
  const roving = useRoving(ids);
  // Delay enabling roving auto-focus until after mount to let heading receive focus
  const rovingEnabledRef = useRef(false);
  useEffect(() => { const t = setTimeout(() => { rovingEnabledRef.current = true; }, 10); return () => clearTimeout(t); }, []);
  const listRef = useRef<HTMLUListElement | null>(null);
  // Track whether user has begun interacting with the roving list (keyboard)
  const hasInteractedRef = useRef(false);
  useEffect(() => {
    const list = listRef.current; if (!list) return;
    // Do not steal initial heading focus until the user interacts
  if (!rovingEnabledRef.current || !hasInteractedRef.current) return;
    const btns = Array.from(list.querySelectorAll('button[tabindex]')) as HTMLButtonElement[];
    const target = btns.find(b => b.getAttribute('tabindex') === '0');
    if (target && document.activeElement !== target) target.focus();
  }, [roving.activeIdx, appointments.length]);
  const handleRovingKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      hasInteractedRef.current = true;
    }
    roving.onKeyDown(e);
  };

  // Idle-time prefetch next page (no conditional hook call; effect body guards)
  useEffect(() => {
    const win = window as unknown as { __DISABLE_IDLE_PREFETCH?: boolean };
    if (win.__DISABLE_IDLE_PREFETCH) return;
    if (!hasNextPage) return; // safe guard
    const cb = () => fetchNextPage();
    const w = window as unknown as { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id:number)=>void };
    const handle: number = w.requestIdleCallback ? w.requestIdleCallback(cb) : window.setTimeout(cb, 300);
    return () => { if (w.cancelIdleCallback) { w.cancelIdleCallback(handle); } else { clearTimeout(handle); } };
  }, [hasNextPage, fetchNextPage]);

  if (!id) return <div className="p-4">Missing customer id.</div>;
  if (error) return <div className="p-4 text-red-600">{String(error)}</div>;

  const empty = !isLoading && appointments.length === 0;

  return (
    <div className="space-y-6 p-4">
      <h1 ref={titleRef} tabIndex={-1} className="text-xl font-semibold outline-none focus:ring-2 focus:ring-ring rounded">Customer Profile</h1>
      {/* Stats */}
      {isLoading && !first ? (
        <section className="grid grid-cols-1 sm:grid-cols-4 gap-4" aria-busy="true">
          <TileSkeleton /><TileSkeleton /><TileSkeleton /><TileSkeleton />
        </section>
      ) : (
        <section className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatCard label="Lifetime Spend" value={money(stats?.lifetime_spend)} />
          <StatCard label="Unpaid Balance" value={money(stats?.unpaid_balance)} />
            <StatCard label="Total Visits" value={stats?.total_visits ?? 0} />
            <StatCard label="Last Visit" value={dtLocal(stats?.last_visit_at)} />
        </section>
      )}

      {/* Vehicles */}
      <section>
        <h3 className="text-sm font-semibold mb-2">Vehicles</h3>
        <div className="flex flex-wrap gap-2">
          {vehicles.map((v: Vehicle) => (
            <button key={v.id} onClick={() => setVehicleId(v.id)} className={`px-3 py-1 rounded-full border ${vehicleId===v.id? 'bg-primary text-primary-foreground':'bg-background'}`}>
              {v.year ?? '—'} {v.make ?? ''} {v.model ?? ''}
            </button>
          ))}
        </div>
      </section>

      {/* Appointment history */}
      <section>
        <h3 className="text-sm font-semibold mb-2">Appointment History</h3>
        <div aria-live="polite" className="sr-only" data-testid="appt-live">
          {`Appointment list updated. ${appointments.length} item${appointments.length===1?'':'s'}.`}
        </div>
        {empty && (
          <div className="p-6 text-sm text-muted-foreground border rounded-xl">
            No appointments yet.
            <button className="ml-2 underline" onClick={() => location.assign(`/admin/appointments/new?customer_id=${id}`)}>Book appointment</button>
          </div>
        )}
        {!empty && (
          <ul ref={listRef} className="divide-y rounded-xl border" onKeyDown={handleRovingKeyDown}>
            {appointments.map((a: Appointment, idx: number) => (
              <li key={a.id} className="p-0 m-0">
                <button
                  type="button"
                  tabIndex={roving.getTabIndex(idx)}
                  aria-current={roving.isActive(idx) || undefined}
                  data-active={roving.isActive(idx) ? 'true' : undefined}
                  className={`w-full text-left p-3 focus:outline-none focus:ring-2 focus:ring-ring rounded-xl ${roving.isActive(idx) ? 'bg-accent/30' : ''}`}
                  onClick={() => { roving.setActiveIdx(idx); /* placeholder action */ }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.currentTarget.click(); return; }
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { handleRovingKeyDown(e); }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{dtLocal(a.scheduled_at)}</div>
                      <div className="text-xs opacity-70">{a.status}</div>
                      <div className="text-xs mt-1">{a.services.map((s: Service) => s.name).join(', ')}</div>
                    </div>
                    {a.invoice && (
                      <div className="text-right text-sm">
                        <div>Total: {money(a.invoice.total)}</div>
                        <div className="opacity-70">Paid: {money(a.invoice.paid)} • Unpaid: {money(a.invoice.unpaid)}</div>
                      </div>
                    )}
                  </div>
                </button>
              </li>
            ))}
            {isFetchingNextPage && <li><RowSkeleton /></li>}
          </ul>
        )}
        {hasNextPage && !empty && (
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
