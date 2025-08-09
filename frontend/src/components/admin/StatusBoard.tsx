import React, { useMemo } from 'react';
import { useAppointments } from '@/contexts/AppointmentContext';
import StatusColumn from './StatusColumn';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import type { AppointmentStatus } from '@/types/models';
import { format } from 'date-fns';

export default function StatusBoard({ onOpen }: { onOpen: (id: string) => void }) {
  const { columns, cards, optimisticMove, triggerRefresh } = useAppointments();

  const getTimeGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const byStatus = useMemo(() => {
    const map = new Map<string, typeof cards>();
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    let visible = cards.filter((c) => {
      try {
        const s = c.start ? new Date(c.start) : null;
        return s && s >= startOfDay && s <= endOfDay;
      } catch {
        return false;
      }
    });

    if (!visible || visible.length === 0) {
      visible = [...cards].sort((a, b) => (a.position || 0) - (b.position || 0));
    }

    const MAX_VISIBLE = 5;
    visible = visible.slice(0, MAX_VISIBLE);

    for (const col of columns) map.set(col.key, []);
    for (const c of visible) {
      const statusKey = String(c.status || 'UNKNOWN');
      if (!map.has(statusKey)) map.set(statusKey, []);
      const arr = map.get(statusKey)!;
      arr.push(c);
    }
    for (const [, arr] of map) arr.sort((a, b) => a.position - b.position);
    return map;
  }, [columns, cards]);

  const TodaysFocusHero = () => {
    const now = new Date();
    const todaysCards = cards.filter(c => {
      try { return c.start && new Date(c.start).toDateString() === now.toDateString(); } catch { return false; }
    });

    const nextAppointment = todaysCards
      .filter(c => c.status === 'SCHEDULED' && typeof c.timeUntilStart === 'number' && c.timeUntilStart > 0)
      .sort((a, b) => (a.timeUntilStart || 0) - (b.timeUntilStart || 0))[0];

    const overdueAppointments = todaysCards.filter(c => c.isOverdue);
    const completedToday = todaysCards.filter(c => c.status === 'COMPLETED');
    const totalJobs = todaysCards.length || cards.length;

    return (
      <div className="bg-gradient-to-r from-neutral-50 to-steel-50 border-b border-neutral-200 px-6 py-6 rounded-lg mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-neutral-900 tracking-tight">Edgar's Shop Dashboard</h1>
            <p className="text-lg font-medium text-neutral-600 mt-2">{getTimeGreeting()}, Edgar • {format(new Date(), 'EEEE, MMMM do')}</p>
          </div>

          <div className="flex items-center space-x-6">
            <div className="bg-white/50 backdrop-blur-sm rounded-lg px-4 py-3 border border-neutral-200">
              <p className="text-sm font-medium text-neutral-500">Jobs Today</p>
              <p className="text-3xl font-bold text-primary-600">{completedToday.length}/{totalJobs}</p>
              <p className="text-xs text-neutral-500">completed</p>
            </div>

            <div className="flex space-x-3">
              <button className="px-4 py-2 bg-white border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 hover:border-neutral-400 transition-all duration-200 shadow-sm" onClick={() => triggerRefresh()}>
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Focus content below */}
        <div className="mt-6">
          {overdueAppointments.length > 0 ? (
            <div className="bg-danger-50 border border-danger-200 rounded-lg p-4 mb-3 urgent-pulse">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-danger-100 flex items-center justify-center mr-3"><span className="text-danger-600 font-bold">⚠️</span></div>
                <div className="flex-1">
                  <p className="font-bold text-danger-800 text-lg">{overdueAppointments.length} appointment{overdueAppointments.length > 1 ? 's' : ''} need attention</p>
                  <p className="text-sm text-danger-600">{overdueAppointments[0].servicesSummary} is {overdueAppointments[0].minutesLate}m overdue</p>
                </div>
                <button className="btn-primary bg-danger-600 hover:bg-danger-700 ml-4">Take Action</button>
              </div>
            </div>
          ) : nextAppointment ? (
            <div className="bg-white/60 backdrop-blur-md rounded-lg p-4 border border-white/20 shadow-sm">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center mr-3"><span className="text-primary-600 font-bold">🔧</span></div>
                <div className="flex-1">
                  <p className="font-bold text-neutral-900 text-lg">Next up: {nextAppointment.servicesSummary}</p>
                  <p className="text-sm text-neutral-600">{nextAppointment.customerName} • Starting in {nextAppointment.timeUntilStart}m</p>
                </div>
                <button className="btn-primary ml-4">Prep</button>
              </div>
            </div>
          ) : (
            <div className="bg-white/60 backdrop-blur-md rounded-lg p-4 border border-white/20 shadow-sm">You're caught up!</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="overflow-x-auto pb-4" role="region" aria-label="Status Board">
        <TodaysFocusHero />
        <div className="flex gap-4 min-w-max mt-4">
          {columns.map((col) => (
            <StatusColumn
              key={col.key}
              column={col}
              cards={byStatus.get(col.key) ?? []}
              onOpen={onOpen}
              onMove={(id: string) => {
                void optimisticMove(id, { status: col.key as AppointmentStatus, position: 1 });
              }}
            />
          ))}
        </div>
      </div>
    </DndProvider>
  );
}
