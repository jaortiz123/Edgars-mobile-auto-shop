// NOTE: Ensure 'zustand' is added as a dependency (npm i zustand) before building.
import { create } from 'zustand';
import type { StateCreator } from 'zustand';
// Devtools are enabled only in development to avoid production bundle bloat.
// Devtools intentionally disabled for type stability in this refactor step; can be reintroduced with proper generic typing later.
import type { BoardCard, BoardColumn } from '@/types/models';
import { useEffect } from 'react';
import { useBoard } from '@/hooks/useBoardData';

/*
 Phase 4 Increment 1: Central Board Store
 - Canonical board data (columns + cards)
 - Client-side filters
 - Loading + error state
 - Selectors for filtered cards
 - Initialization hook that bridges existing useBoard() (React Query) into Zustand state
 - No UI integration yet
*/

export interface BoardFilters {
  searchText: string;
  technicianId: string | null; // local UI filter (distinct from server filter)
  statuses: string[] | null;
  date: string | null; // placeholder for future day filter
}

export interface BoardState {
  columns: BoardColumn[];
  cardsById: Record<string, BoardCard>;
  cardIds: string[];
  lastFetchedAt: number | null;
  loading: boolean;
  error: string | null;
  filters: BoardFilters;
  // actions
  replaceBoard: (cols: BoardColumn[], cards: BoardCard[]) => void;
  setLoading: (v: boolean) => void;
  setError: (msg: string | null) => void;
  setFilters: (partial: Partial<BoardFilters>) => void;
  clear: () => void;
  // mutation actions (Increment 3)
  moveAppointment: (id: string, target: { status: string; position: number }) => Promise<void>;
  assignTechnician: (id: string, technicianId: string | null) => Promise<void>;
}

const initialFilters: BoardFilters = {
  searchText: '',
  technicianId: null,
  statuses: null,
  date: null,
};

const withDevtools = (fn: StateCreator<BoardState>) => fn; // no-op (safe placeholder)

export const useBoardStore = create<BoardState>(
  withDevtools((set: (partial: Partial<BoardState> | ((state: BoardState) => Partial<BoardState>)) => void) => ({
    columns: [],
    cardsById: {},
    cardIds: [],
    lastFetchedAt: null,
    loading: false,
    error: null,
    filters: initialFilters,
    replaceBoard: (cols: BoardColumn[], cards: BoardCard[]) =>
      set(() => {
        const cardsById: Record<string, BoardCard> = {};
        const cardIds: string[] = [];
        for (const c of cards) {
          cardsById[c.id] = c;
          cardIds.push(c.id);
        }
        return { columns: cols, cardsById, cardIds, lastFetchedAt: Date.now() };
      }),
  setLoading: (v: boolean) => set({ loading: v }),
  setError: (msg: string | null) => set({ error: msg }),
  setFilters: (partial: Partial<BoardFilters>) => set((s) => ({ filters: { ...s.filters, ...partial } })),
    clear: () => set({ columns: [], cardsById: {}, cardIds: [], lastFetchedAt: null, loading: false, error: null, filters: initialFilters }),
  moveAppointment: async (id: string, target: { status: string; position: number }) => {
      let prev: BoardCard | undefined;
      set((s) => {
        const existing = s.cardsById[id];
        if (existing) {
          prev = existing;
          return {
      cardsById: { ...s.cardsById, [id]: { ...existing, status: target.status as unknown as BoardCard['status'], position: target.position } },
          } as Partial<BoardState>;
        }
        return {};
      });
      try {
        const api = await import('@/lib/api');
    await api.moveAppointment(id, { status: target.status as unknown as BoardCard['status'], position: target.position });
      } catch (err) {
        // rollback
        if (prev) {
          set((s) => ({ cardsById: { ...s.cardsById, [id]: prev! } }));
        }
        // surface error (toast expected by consumer)
        set({ error: (err as Error).message || 'Move failed' });
        throw err;
      }
    },
  assignTechnician: async (id: string, technicianId: string | null) => {
      let prev: BoardCard | undefined;
      set((s) => {
        const existing = s.cardsById[id];
        if (existing) {
          prev = existing;
          // infer field name: backend expects tech_id patch; local model may expose techAssigned or technicianId (legacy)
      const updated: BoardCard & { technicianId?: string | null } = { ...existing };
          if ('techAssigned' in updated) updated.techAssigned = technicianId;
      (updated as { technicianId?: string | null }).technicianId = technicianId; // compatibility field used in filters
          return { cardsById: { ...s.cardsById, [id]: updated } } as Partial<BoardState>;
        }
        return {};
      });
      try {
        const api = await import('@/lib/api');
        await api.patchAppointment(id, { tech_id: technicianId });
      } catch (err) {
        if (prev) set((s) => ({ cardsById: { ...s.cardsById, [id]: prev! } }));
        set({ error: (err as Error).message || 'Technician update failed' });
        throw err;
      }
    },
  }))
);

/* --------- Selectors / Derived Data --------- */
export const selectAllCards = (s: BoardState): BoardCard[] => s.cardIds.map((id: string) => s.cardsById[id]).filter(Boolean);

export const selectFilteredCards = (s: BoardState): BoardCard[] => {
  let list = selectAllCards(s);
  const { searchText, technicianId, statuses, date } = s.filters;
  if (searchText) {
    const q = searchText.toLowerCase();
    list = list.filter((c) =>
      (c.headline || '').toLowerCase().includes(q) ||
      (c.customerName || '').toLowerCase().includes(q) ||
      (c.servicesSummary || '').toLowerCase().includes(q)
    );
  }
  if (technicianId) list = list.filter((c) => String((c as unknown as { technicianId?: string }).technicianId || '') === technicianId); // technicianId optional
  if (statuses && statuses.length) list = list.filter((c) => statuses.includes(c.status));
  // Date filter (expects YYYY-MM-DD). Matches against appointmentDate first, then start timestamp.
  if (date) {
    list = list.filter((c) => {
      const fromAppointment = (c as unknown as { appointmentDate?: string }).appointmentDate;
      const normalizedFromAppointment = fromAppointment ? new Date(fromAppointment).toISOString().slice(0, 10) : null;
      if (normalizedFromAppointment === date) return true;
      const startTs = c.start;
      if (startTs) {
        try {
          const norm = new Date(startTs).toISOString().slice(0, 10);
          if (norm === date) return true;
        } catch { /* ignore parse errors */ }
      }
      return false;
    });
  }
  return list;
};

export function useBoardFilteredCards() {
  return useBoardStore(selectFilteredCards);
}

/* --------- Initialization Hook (bridges existing useBoard) --------- */
// This hook can be mounted in a hidden provider later when we integrate.
export function useBoardStoreInitializer(enabled = true) {
  const replaceBoard = useBoardStore((s: BoardState) => s.replaceBoard);
  const setLoading = useBoardStore((s: BoardState) => s.setLoading);
  const setError = useBoardStore((s: BoardState) => s.setError);

  const { boardQuery } = useBoard();
  const { data, isLoading, error } = boardQuery;

  useEffect(() => {
    if (!enabled) return;
    setLoading(isLoading);
  }, [enabled, isLoading, setLoading]);

  useEffect(() => {
    if (!enabled) return;
    if (error) setError((error as Error).message || 'Board load failed');
    else setError(null);
  }, [enabled, error, setError]);

  useEffect(() => {
    if (!enabled) return;
    if (data?.columns && data?.cards) {
      replaceBoard(data.columns, data.cards);
    }
  }, [enabled, data, replaceBoard]);
}

/* --------- Convenience Hooks --------- */
export function useBoardLoading() { return useBoardStore((s: BoardState) => s.loading); }
export function useBoardError() { return useBoardStore((s: BoardState) => s.error); }
export function useBoardFiltersState() { return useBoardStore((s: BoardState) => s.filters); }
export function useSetBoardFilters() { return useBoardStore((s: BoardState) => s.setFilters); }
