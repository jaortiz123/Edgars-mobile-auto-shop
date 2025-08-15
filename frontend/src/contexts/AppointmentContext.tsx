import React, { createContext, useContext, useEffect, useCallback, useState } from 'react';
import type { BoardCard, BoardColumn, DashboardStats } from '../types/models';
import { useBoard } from '@/hooks/useBoardData';

interface AppointmentState {
  columns: BoardColumn[];
  cards: BoardCard[];
  stats: DashboardStats | null;
  loading: boolean;
  boardError?: Error | null;
  statsError?: Error | null;
  isFetchingBoard?: boolean;
  isFetchingStats?: boolean;
  view: 'calendar' | 'board';
  setView: (v: 'calendar' | 'board') => void;
  refreshBoard: () => Promise<void>;
  refreshStats: () => Promise<void>;
  optimisticMove: (
    id: string,
    next: { status: BoardCard['status']; position: number }
  ) => Promise<void>;
  // Additional properties expected by Dashboard
  refreshTrigger: number;
  triggerRefresh: () => void;
  isRefreshing: boolean;
  setRefreshing: (refreshing: boolean) => void;
}

const Ctx = createContext<AppointmentState | undefined>(undefined);

export function AppointmentProvider({ children }: { children: React.ReactNode }) {
  const { boardQuery, statsQuery, refresh, boardError, statsError, isFetchingBoard, isFetchingStats } = useBoard();
  const loading = boardQuery.isLoading;
  const [view, setViewState] = useState<'calendar' | 'board'>(() => {
    try {
      const v = localStorage.getItem('adm.view');
      return (v as 'calendar' | 'board') || 'calendar';
    } catch (e) {
      console.warn('Failed to read adm.view from localStorage during init:', e);
      return 'calendar';
    }
  });
  // Persist view preference
  const setView = useCallback((v: 'calendar' | 'board') => {
    setViewState(v);
    localStorage.setItem('adm.view', v);
  }, []);

  // Additional state for Dashboard compatibility
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, _setIsRefreshing] = useState(false);
  const setRefreshing = useCallback((refreshing: boolean) => {
    _setIsRefreshing(refreshing);
  }, []);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // (moved below to avoid referencing callbacks before declaration)

  const refreshBoard = useCallback(async () => { refresh(); }, [refresh]);
  const refreshStats = useCallback(async () => { refresh(); }, [refresh]);

  const optimisticMove: AppointmentState['optimisticMove'] = useCallback(async () => {
    console.warn('AppointmentContext.optimisticMove is deprecated after store migration. Use store actions instead.');
  }, []);

  useEffect(() => { /* initial fetch handled by React Query automatically */ }, []);

  // Respond to explicit refresh triggers from UI (e.g., after quick actions)
  useEffect(() => {
    if (refreshTrigger > 0) {
      void refreshBoard();
      void refreshStats();
    }
  }, [refreshTrigger, refreshBoard, refreshStats]);


  return <Ctx.Provider value={{
    columns: boardQuery.data?.columns || [],
    cards: boardQuery.data?.cards || [],
    stats: statsQuery.data || null,
    loading,
  boardError,
  statsError,
  isFetchingBoard,
  isFetchingStats,
    view,
    setView,
    refreshBoard,
    refreshStats,
    optimisticMove,
    refreshTrigger,
    triggerRefresh,
    isRefreshing,
    setRefreshing
  }}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppointments() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppointments must be used within AppointmentProvider');
  return v;
}

// Alias for compatibility with Dashboard imports
// eslint-disable-next-line react-refresh/only-export-components
export { useAppointments as useAppointmentContext };
