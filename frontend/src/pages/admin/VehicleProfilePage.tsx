import { useParams, useLocation } from 'react-router-dom';
import { useRef, useEffect, useMemo, useState } from 'react';
import { useVehicleProfileInfinite } from '@/hooks/useVehicleProfile';
import { dtLocal, money } from '@/utils/format';
import TimelineRow from '@/components/profile/TimelineRow';
import { useRoving } from '@/hooks/useRoving';
import VehicleEditModal, { BasicVehicleForModal } from '@/components/edit/VehicleEditModal';

function useInitialFocus<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => { const el = ref.current; if (el) setTimeout(() => el.focus(), 0); }, []);
  return ref;
}

export default function VehicleProfilePage() {
  const { id } = useParams<{ id: string }>(); // vehicle id
  const location = useLocation();
  // Allow an override of page_size via query param strictly for dev/testing (keeps prod default 25)
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const pageSizeOverride = Number(searchParams.get('page_size') || '0');
  const pageSize = Number.isFinite(pageSizeOverride) && pageSizeOverride > 0 ? pageSizeOverride : 25;
  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage, error } = useVehicleProfileInfinite(id || '', { includeInvoices: true, pageSize });
  const first = data?.pages?.[0];
  const header = first?.header;
  const stats = first?.stats;
  const timeline = useMemo(() => data?.pages?.flatMap(p => p.timeline) || [], [data]);

  const titleRef = useInitialFocus<HTMLHeadingElement>();

  // Roving over timeline list
  const ids = timeline.map(r => r.id);
  const roving = useRoving(ids);
  const listRef = useRef<HTMLUListElement | null>(null);
  const hasInteractedRef = useRef(false);
  const rovingEnabledRef = useRef(false);
  useEffect(() => { const t = setTimeout(() => { rovingEnabledRef.current = true; }, 10); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const list = listRef.current; if (!list) return;
    if (!rovingEnabledRef.current || !hasInteractedRef.current) return;
    const btns = Array.from(list.querySelectorAll('button[tabindex]')) as HTMLButtonElement[];
    const target = btns.find(b => b.getAttribute('tabindex') === '0');
    if (target && document.activeElement !== target) target.focus();
  }, [roving.activeIdx, timeline.length]);
  const handleRovingKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { hasInteractedRef.current = true; }
    roving.onKeyDown(e);
    if (e.key === 'Enter' || e.key === ' ') {
      const list = listRef.current;
      const activeBtn = list?.querySelector('button[tabindex="0"]') as HTMLButtonElement | null;
      if (activeBtn) {
        activeBtn.click();
        e.preventDefault();
      }
    }
  };

  // Modal state & basic vehicle slice BEFORE early returns
  const [showEditVehicle, setShowEditVehicle] = useState(false);
  const vehicleForModal: BasicVehicleForModal | null = useMemo(() => {
    if (!header) return null;
    return { id: header.vehicle_id, make: header.make, model: header.model, year: header.year, vin: header.vin, license_plate: header.plate };
  }, [header]);

  if (!id) return <div className="p-4">Missing vehicle id.</div>;
  if (error) return <div className="p-4 text-red-600">{String(error)}</div>;

  const empty = !isLoading && timeline.length === 0;

  return (
    <div className="space-y-6 p-4">
      <h1 ref={titleRef} tabIndex={-1} className="text-xl font-semibold outline-none focus:ring-2 focus:ring-ring rounded">Vehicle Profile</h1>

      {/* Header placeholder */}
  <section className="border rounded-xl p-4">
        {header ? (
          <div className="space-y-1">
            <div className="font-semibold text-lg">{header.year ?? '—'} {header.make ?? ''} {header.model ?? ''} {header.trim ?? ''}</div>
            <div className="text-xs text-muted-foreground">VIN: {header.vin || '—'} • Plate: {header.plate || '—'}</div>
          </div>
        ) : (
          <div className="animate-pulse h-12" />
        )}
      </section>

      {/* Stats */}
      {isLoading && !stats ? (
        <section className="grid grid-cols-1 sm:grid-cols-4 gap-4" aria-busy="true">
          <TileSkeleton /><TileSkeleton /><TileSkeleton /><TileSkeleton />
        </section>
      ) : (
        <section className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatCard label="Lifetime Spend" value={money(stats?.lifetime_spend)} />
          <StatCard label="Total Visits" value={stats?.total_visits ?? 0} />
          <StatCard label="Last Service" value={dtLocal(stats?.last_service_at)} />
          <StatCard label="Avg Ticket" value={money(stats?.avg_ticket)} />
        </section>
      )}

      {/* Timeline */}
      <section>
        <h3 className="text-sm font-semibold mb-2">Service History</h3>
        <div aria-live="polite" className="sr-only">
          {`Timeline updated. ${timeline.length} item${timeline.length===1?'':'s'}.`}
        </div>
        {empty && (
          <div className="p-6 text-sm text-muted-foreground border rounded-xl">
            No service history yet.
            <button className="ml-2 underline" onClick={() => window.location.assign(`/admin/appointments/new?vehicle_id=${id}`)}>Book appointment</button>
          </div>
        )}
        {!empty && (
          <ul ref={listRef} className="divide-y rounded-xl border" onKeyDown={handleRovingKeyDown}>
            {timeline.map((row, idx) => (
              <TimelineRow
                key={row.id}
                id={row.id}
                date={row.occurred_at}
                status={row.status}
                services={row.services}
                invoice={row.invoice}
                active={roving.isActive(idx)}
                tabIndex={roving.getTabIndex(idx)}
                onActivate={() => roving.setActiveIdx(idx)}
                onArrowNav={handleRovingKeyDown}
              />
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

      {/* Actions */}
      <section className="flex gap-2">
        <button className="px-3 py-2 rounded border" onClick={() => { window.location.assign(`/admin/appointments/new?vehicle_id=${id}`); }}>Book Appointment</button>
        <button className="px-3 py-2 rounded border" onClick={() => setShowEditVehicle(true)}>Edit Vehicle</button>
      </section>
      <VehicleEditModal open={showEditVehicle} onClose={() => setShowEditVehicle(false)} vehicle={vehicleForModal} />
    </div>
  );
}

function TileSkeleton() { return <div className="p-3 rounded-xl border animate-pulse h-16" />; }
function RowSkeleton() { return <div className="p-3 animate-pulse h-14" />; }
function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="p-3 rounded-xl border">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
