import React from 'react';
import { useBoardFilters } from '@/contexts/BoardFilterContext';
import type { AppointmentStatus } from '@/types/models';
import type { BlockerCode } from '@/types/serviceCatalog';
import { Search, Filter, Users } from 'lucide-react';
import { useTechnicians } from '@/hooks/useTechnicians';
// server tech filter syncing handled in context now

// Status & blocker option sets
const STATUS_OPTIONS: AppointmentStatus[] = ['SCHEDULED','IN_PROGRESS','READY','COMPLETED','NO_SHOW','CANCELED'];
const BLOCKER_OPTIONS: BlockerCode[] = ['WAITING_PARTS','NEEDS_AUTH','WAITING_CUSTOMER','DIAGNOSING','QC_CHECK','COMEBACK'];

function Chip({ active, onClick, children, tone }: { active: boolean; onClick: () => void; children: React.ReactNode; tone: 'amber' | 'red' | 'slate'; }) {
  const base = 'px-2 py-1 rounded-md border text-[11px] leading-none font-semibold tracking-wide transition-colors shadow-sm';
  if (active) {
    const palette = tone === 'amber'
      ? 'bg-amber-500/90 border-amber-400 text-white hover:bg-amber-500'
      : tone === 'red'
        ? 'bg-red-500/90 border-red-400 text-white hover:bg-red-500'
        : 'bg-slate-600 border-slate-400 text-white hover:bg-slate-500';
    return <button onClick={onClick} className={`${base} ${palette}`}>{children}</button>;
  }
  return <button onClick={onClick} className={`${base} bg-neutral-800/70 border-neutral-600 text-neutral-200 hover:bg-neutral-700`}>{children}</button>;
}

export const BoardFilterBar: React.FC = () => {
  const { filters, setFilters, clearFilters, filtersActive } = useBoardFilters();
  const { data: technicians = [], isLoading: techLoading } = useTechnicians();

  const toggleStatus = (s: AppointmentStatus) => {
    setFilters({ statuses: (filters.statuses || []).includes(s) ? (filters.statuses || []).filter(x => x !== s) : [ ...(filters.statuses || []), s ] });
  };
  const toggleBlocker = (b: BlockerCode) => {
    setFilters({ blockers: filters.blockers.includes(b) ? filters.blockers.filter(x => x !== b) : [ ...filters.blockers, b ] });
  };
  // Single-select tech server filter; second click clears.
  const currentTechId = filters.techs[0];
  const toggleTech = (id: string) => {
    const next = currentTechId === id ? [] : [id];
    setFilters({ techs: next });
  };

  return (
    <div className="nb-surface nb-border rounded-lg p-4 md:p-5 bg-neutral-900/85 backdrop-blur-sm flex flex-col gap-4 text-sm">
      {/* Top row: search + reset */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative w-full md:w-96">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden />
          <input
            aria-label="Search appointments"
            placeholder="Search customer, vehicle, headline"
            value={filters.search}
            onChange={e => setFilters({ search: e.target.value })}
            className="w-full pl-9 pr-3 py-2 rounded-md bg-neutral-800/90 border border-neutral-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 placeholder-neutral-500 text-neutral-100"
          />
        </div>
        <div className="flex items-center gap-2">
          {filtersActive && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 rounded-md text-[11px] font-semibold bg-neutral-700 hover:bg-neutral-600 border border-neutral-500 text-neutral-100 tracking-wide"
            >Reset</button>
          )}
        </div>
      </div>

      {/* Filter groups */}
      <div className="flex flex-col md:flex-row gap-6 md:gap-10">
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-1 mb-2">
            <Filter size={14} className="text-neutral-400" />
            <p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400">Status</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map(s => {
              const active = (filters.statuses || []).includes(s);
              return (
                <Chip key={s} active={active} onClick={() => toggleStatus(s)} tone="amber">
                  {s.replace('_',' ')}
                </Chip>
              );
            })}
          </div>
        </div>
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-1 mb-2">
            <Filter size={14} className="text-neutral-400" />
            <p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400">Blockers</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BLOCKER_OPTIONS.map(b => {
              const active = filters.blockers.includes(b);
              return (
                <Chip key={b} active={active} onClick={() => toggleBlocker(b)} tone="red">
                  {b.replace('_',' ')}
                </Chip>
              );
            })}
          </div>
        </div>
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-1 mb-2">
            <Users size={14} className="text-neutral-400" />
            <p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400">Technicians</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {techLoading && <span className="text-[11px] opacity-70">Loading…</span>}
            {!techLoading && technicians.map(t => {
              const active = currentTechId === t.id;
              return (
                <Chip key={t.id} active={active} onClick={() => toggleTech(t.id)} tone="slate">
                  {t.initials || t.name}
                </Chip>
              );
            })}
            {!techLoading && technicians.length === 0 && (
              <span className="text-[11px] opacity-50">No technicians</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
