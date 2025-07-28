import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { BoardCard, BoardColumn, DashboardStats } from '../types/models';
import * as api from '../lib/api';

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
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [cards, setCards] = useState<BoardCard[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setViewState] = useState<'calendar' | 'board'>(() =>
    (localStorage.getItem('adm.view') as 'calendar' | 'board') || 'calendar'
  );
  
  // Additional state for Dashboard compatibility
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const setView = (v: 'calendar' | 'board') => {
    setViewState(v);
    localStorage.setItem('adm.view', v);
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const setRefreshing = (refreshing: boolean) => {
    setIsRefreshing(refreshing);
  };

  const refreshBoard = async () => {
    setLoading(true);
    try {
      const data = await api.getBoard({});
      setColumns(data.columns);
      setCards(data.cards);
    } finally {
      setLoading(false);
    }
  };

  const refreshStats = async () => {
    const s = await api.getStats({});
    setStats(s);
  };

  const optimisticMove: AppointmentState['optimisticMove'] = async (id, next) => {
    const previousCards = cards;
    const idx = previousCards.findIndex((c) => c.id === id);
    if (idx === -1) return;

    const newCards = [...previousCards];
    newCards[idx] = { ...newCards[idx], status: next.status, position: next.position };

    setCards(newCards);

    try {
      await api.moveAppointment(id, { status: next.status, position: next.position });
      void refreshStats();
    } catch (e) {
      console.error(e);
      setCards(previousCards);
    }
  };

  useEffect(() => {
    void refreshBoard();
    void refreshStats();
    const t = setInterval(() => void refreshStats(), 60000);
    return () => clearInterval(t);
  }, []);

  const value = useMemo(
    () => ({ 
      columns, 
      cards, 
      stats, 
      loading, 
      view, 
      setView, 
      refreshBoard, 
      refreshStats, 
      optimisticMove,
      refreshTrigger,
      triggerRefresh,
      isRefreshing,
      setRefreshing
    }),
    [columns, cards, stats, loading, view, optimisticMove, refreshTrigger, isRefreshing]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppointments() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppointments must be used within AppointmentProvider');
  return v;
}
export const useAppointmentContext = useAppointments;
