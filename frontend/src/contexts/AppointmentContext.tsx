import React, { createContext, useContext, useEffect, useMemo, useCallback, useState } from 'react';
import { useToast } from '../components/ui/Toast';
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

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const refreshBoard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getBoard({});
      setColumns(data.columns);
      setCards(data.cards);
    } catch (e) {
      toast.push({ kind: 'error', text: handleApiError(e, 'Failed to load board') });
    } finally {
      setLoading(false);
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
      toast.push({ kind: 'success', text: 'Appointment moved successfully' });
    } catch (e) {
      console.error(e);
      setCards(previousCards);
      toast.push({ kind: 'error', text: handleApiError(e, 'Failed to move appointment') });
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
    [columns, cards, stats, loading, view, setView, refreshBoard, refreshStats, optimisticMove, refreshTrigger, isRefreshing, setRefreshing]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppointments() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppointments must be used within AppointmentProvider');
  return v;
}
