import React, { createContext, useContext, useState, useMemo, useCallback, ReactNode } from 'react';
import type { AppointmentStatus, BoardCard } from '@/types/models';
import type { BlockerCode } from '@/types/serviceCatalog';

export interface BoardFilters {
  search: string;
  statuses: AppointmentStatus[] | null; // null = all
  techs: string[]; // selected techAssigned values
  blockers: BlockerCode[]; // selected blocker codes
}

interface BoardFilterContextValue {
  filters: BoardFilters;
  setFilters: (f: Partial<BoardFilters>) => void;
  clearFilters: () => void;
  applyFilters: (cards: BoardCard[]) => BoardCard[];
  filtersActive: boolean;
  activeCount: number;
}

const BoardFilterContext = createContext<BoardFilterContextValue | undefined>(undefined);

const DEFAULT: BoardFilters = { search: '', statuses: null, techs: [], blockers: [] };

export function BoardFilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFiltersState] = useState<BoardFilters>(DEFAULT);

  const setFilters = (f: Partial<BoardFilters>) => setFiltersState(prev => ({ ...prev, ...f }));
  const clearFilters = () => setFiltersState(DEFAULT);

  const applyFilters = useCallback((cards: BoardCard[]) => {
    const { search, statuses, techs, blockers } = filters;
    const term = search.trim().toLowerCase();
    const termParts = term ? term.split(/\s+/) : [];
    return cards.filter(c => {
      if (statuses && !statuses.includes(c.status)) return false;
      if (techs.length && (!c.techAssigned || !techs.includes(c.techAssigned))) return false;
      if (blockers.length && (!c.blockerCode || !blockers.includes(c.blockerCode as BlockerCode))) return false;
      if (termParts.length) {
        const hay = [c.headline || '', c.servicesSummary || '', c.customerName || '', c.vehicleMake || '', c.vehicleModel || '']
          .join(' ').toLowerCase();
        for (const p of termParts) if (!hay.includes(p)) return false;
      }
      return true;
    });
  }, [filters]);

  const filtersActive = useMemo(() => {
    return !!(filters.search.trim() || (filters.statuses && filters.statuses.length) || filters.techs.length || filters.blockers.length);
  }, [filters]);

  const activeCount = useMemo(() => {
    let count = 0;
    if (filters.search.trim()) count += 1; // treat search as one
    if (filters.statuses && filters.statuses.length) count += filters.statuses.length;
    if (filters.techs.length) count += filters.techs.length;
    if (filters.blockers.length) count += filters.blockers.length;
    return count;
  }, [filters]);

  const value = useMemo<BoardFilterContextValue>(() => ({ filters, setFilters, clearFilters, applyFilters, filtersActive, activeCount }), [filters, applyFilters, filtersActive, activeCount]);

  return <BoardFilterContext.Provider value={value}>{children}</BoardFilterContext.Provider>;
}

export function useBoardFilters() {
  const ctx = useContext(BoardFilterContext);
  if (!ctx) throw new Error('useBoardFilters must be used within BoardFilterProvider');
  return ctx;
}
