import React from 'react';
import { useBoardFilters } from '@/contexts/BoardFilterContext';
import type { AppointmentStatus } from '@/types/models';
import type { BlockerCode } from '@/types/serviceCatalog';

// Simple inline filter bar. Iteratively enhance later (multiselect dropdowns etc.)

// Available board statuses (extend if backend adds more)
const STATUS_OPTIONS: AppointmentStatus[] = ['SCHEDULED','IN_PROGRESS','READY','COMPLETED','NO_SHOW','CANCELED'];

// Blocker codes derived from serviceCatalog BlockerCode union
const BLOCKER_OPTIONS: BlockerCode[] = ['WAITING_PARTS','NEEDS_AUTH','WAITING_CUSTOMER','DIAGNOSING','QC_CHECK','COMEBACK'];

export const BoardFilterBar: React.FC = () => {
  const { filters, setFilters, clearFilters, filtersActive } = useBoardFilters();

  const toggleStatus = (s: AppointmentStatus) => {
    setFilters({ statuses: (filters.statuses || []).includes(s) ? (filters.statuses || []).filter(x => x !== s) : [ ...(filters.statuses || []), s ] });
  };
  const toggleBlocker = (b: BlockerCode) => {
    setFilters({ blockers: filters.blockers.includes(b) ? filters.blockers.filter(x => x !== b) : [ ...filters.blockers, b ] });
  };

  return (
    <div className="mb-2 p-2 rounded bg-neutral-800/60 border border-neutral-700 flex flex-col gap-2 text-sm">
      <div className="flex gap-2 items-center">
        <input
          placeholder="Search customer, vehicle, headline"
          value={filters.search}
          onChange={e => setFilters({ search: e.target.value })}
          className="flex-1 px-2 py-1 rounded bg-neutral-900 border border-neutral-600 focus:outline-none focus:ring-1 focus:ring-amber-400"
        />
        {filtersActive && (
          <button onClick={clearFilters} className="px-2 py-1 text-xs rounded bg-neutral-700 hover:bg-neutral-600 border border-neutral-500">Clear</button>
        )}
      </div>
      <div className="flex flex-wrap gap-1 items-center">
        {STATUS_OPTIONS.map(s => {
          const active = (filters.statuses || []).includes(s);
          return (
            <button key={s} onClick={() => toggleStatus(s)}
              className={`px-2 py-0.5 rounded border text-xs ${active ? 'bg-amber-500 text-black border-amber-400' : 'bg-neutral-700 border-neutral-600 hover:bg-neutral-600'}`}>{s.replace('_',' ')}</button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1 items-center">
        {BLOCKER_OPTIONS.map(b => {
          const active = filters.blockers.includes(b);
          return (
            <button key={b} onClick={() => toggleBlocker(b)}
              className={`px-2 py-0.5 rounded border text-xs ${active ? 'bg-red-500 text-black border-red-400' : 'bg-neutral-700 border-neutral-600 hover:bg-neutral-600'}`}>{b.replace('_',' ')}</button>
          );
        })}
      </div>
    </div>
  );
};
