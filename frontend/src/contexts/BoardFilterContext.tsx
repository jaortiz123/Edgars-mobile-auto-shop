import React, { createContext, useContext, useState, useMemo, useCallback, ReactNode, useEffect } from 'react';
import { setBoardTechFilter, peekBoardServerFilters } from '@/state/boardServerFilters';
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
const STORAGE_KEY = 'adm.board.filters.v1';

export function BoardFilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFiltersState] = useState<BoardFilters>(DEFAULT);

  // Load persisted filters once on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setFiltersState(prev => ({ ...prev, ...parsed }));
          if (parsed.techs && Array.isArray(parsed.techs) && parsed.techs[0]) {
            setBoardTechFilter(parsed.techs[0]);
          }
        }
      } else {
        // If no stored tech but a server tech exists (from early load), sync it
        const peek = peekBoardServerFilters();
        if (peek.techId) setFiltersState(prev => ({ ...prev, techs: [peek.techId!] }));
      }
    } catch { /* ignore */ }
  }, []);

  const setFilters = (f: Partial<BoardFilters>) => setFiltersState(prev => ({ ...prev, ...f }));
  const clearFilters = () => {
    setFiltersState(DEFAULT);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT)); } catch { /* ignore */ }
    setBoardTechFilter(undefined);
  };

  // Persist filters whenever they change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(filters)); } catch { /* ignore */ }
  }, [filters]);

  // Sync server tech filter when techs selection changes
  useEffect(() => { setBoardTechFilter(filters.techs[0]); }, [filters.techs]);

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
