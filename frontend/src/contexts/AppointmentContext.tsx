import React, { createContext, useContext, useEffect, useMemo, useCallback, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import type { BoardCard, BoardColumn, DashboardStats } from '../types/models';
import * as api from '../lib/api';
import { handleApiError } from '../lib/api';

interface AppointmentState {
  columns: BoardColumn[];
  cards: BoardCard[];
  stats: DashboardStats | null;
  loading: boolean;
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
  const toast = useToast();
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [cards, setCards] = useState<BoardCard[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setViewState] = useState<'calendar' | 'board'>(() =>
    (localStorage.getItem('adm.view') as 'calendar' | 'board') || 'calendar'
  );
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

  const refreshBoard = useCallback(async () => {
    console.log('🚀 AppointmentContext: Starting refreshBoard');
    setLoading(true);
    try {
      console.log('📡 AppointmentContext: Calling api.getBoard({})');
      console.log('🔍 AppointmentContext: api.getBoard type:', typeof api.getBoard);
      console.log('🔍 AppointmentContext: api object:', Object.keys(api));
      
      // Direct function call with comprehensive error handling
      let data: { columns: BoardColumn[]; cards: BoardCard[] } | undefined;
      try {
        console.log('🎯 AppointmentContext: About to call api.getBoard...');
        data = await api.getBoard({});
        console.log('🎯 AppointmentContext: api.getBoard call completed, result:', data);
      } catch (apiError) {
        console.error('🚨 AppointmentContext: api.getBoard threw error:', {
          error: apiError,
          message: (apiError as Error)?.message,
          stack: (apiError as Error)?.stack,
          name: (apiError as Error)?.name,
          typeof: typeof apiError
        });
        throw apiError; // Re-throw to be caught by outer catch
      }
      console.log('✅ AppointmentContext: Received board data:', { 
        columnsCount: data?.columns?.length, 
        cardsCount: data?.cards?.length,
        data: JSON.stringify(data, null, 2)
      });
      setColumns(data.columns);
      setCards(data.cards);
      console.log('🔄 AppointmentContext: Set columns and cards');
    } catch (e) {
      console.error('❌ AppointmentContext: Error in refreshBoard:', e);
      toast.push({ kind: 'error', text: handleApiError(e, 'Failed to load board') });
    } finally {
      setLoading(false);
      console.log('✅ AppointmentContext: refreshBoard completed');
    }
  }, [toast]);

  const refreshStats = useCallback(async () => {
    try {
      setStats(await api.getStats({}));
    } catch (e) {
      toast.push({ kind: 'error', text: handleApiError(e, 'Failed to load stats') });
    }
  }, [toast]);

  const optimisticMove: AppointmentState['optimisticMove'] = useCallback(async (id, next) => {
     const previousCards = cards;
     const idx = previousCards.findIndex((c) => c.id === id);
     if (idx === -1) return;

     const newCards = [...previousCards];
     newCards[idx] = { ...newCards[idx], status: next.status, position: next.position };

     setCards(newCards);

     try {
      await api.moveAppointment(id, { status: next.status, position: next.position });
      void refreshStats();
      toast.success('Appointment moved successfully', { key: `move-${id}` });
     } catch (e: unknown) {
      console.error(e);
      // rollback
      setCards(previousCards);
      const statusCode = (e as { response?: { status?: number } }).response?.status;
      const detail = (e as { response?: { data?: { errors?: Array<{ detail?: string }> } } }).response?.data?.errors?.[0]?.detail || '';
      if (statusCode === 429) {
        toast.error('Too many moves. Please wait a moment.', { key: `move-rate-${id}` });
      } else if (statusCode === 400 && detail.toLowerCase().includes('not allowed')) {
        toast.error('That status change is not allowed.', { key: `move-invalid-${id}` });
      } else {
        toast.error('Could not move appointment. Try again.', { key: `move-fail-${id}` });
      }
     }
   }, [cards, refreshStats, toast]);

  useEffect(() => {
    void refreshBoard();
    void refreshStats();
    const t = setInterval(() => void refreshStats(), 60000);
    return () => clearInterval(t);
  }, [refreshBoard, refreshStats]);

  const value = useMemo(
    () => ({ 
      columns, cards, stats, loading, view, setView, 
      refreshBoard, refreshStats, optimisticMove, refreshTrigger, triggerRefresh, isRefreshing, setRefreshing
    }),
    [columns, cards, stats, loading, view, setView, refreshBoard, refreshStats, optimisticMove, refreshTrigger, triggerRefresh, isRefreshing, setRefreshing]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppointments() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppointments must be used within AppointmentProvider');
  return v;
}

// Alias for compatibility with Dashboard imports
export { useAppointments as useAppointmentContext };
