import React, { useMemo, useState } from 'react';
import { useAppointments } from '@/contexts/AppointmentContext';
import StatusColumn from './StatusColumn';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import type { AppointmentStatus } from '@/types/models';

export default function StatusBoard({ onOpen }: { onOpen: (id: string) => void }) {
  const { columns, cards, optimisticMove, triggerRefresh } = useAppointments();
  const [reschedulingIds, setReschedulingIds] = useState<Set<string>>(new Set());

  // Today's Focus hero component (Week 2)
  const TodaysFocusHero = () => {
    const now = new Date();
    const todaysCards = cards.filter(c => {
      try {
        return c.start && new Date(c.start).toDateString() === now.toDateString();
      } catch (e) {
        return false;
      }
    });

    const nextAppointment = todaysCards
      .filter(c => c.status === 'SCHEDULED' && typeof c.timeUntilStart === 'number' && c.timeUntilStart > 0)
      .sort((a, b) => (a.timeUntilStart || 0) - (b.timeUntilStart || 0))[0];

    const overdueAppointments = todaysCards.filter(c => c.isOverdue);

    const completedToday = todaysCards.filter(c => c.status === 'COMPLETED');
    const inProgressCount = todaysCards.filter(c => c.status === 'IN_PROGRESS').length;
    const scheduledCount = todaysCards.filter(c => c.status === 'SCHEDULED').length;
    const totalJobs = todaysCards.length || cards.length;

    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="col-span-2">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Right Now Focus</h2>
            {overdueAppointments.length > 0 ? (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-3">
                <div className="flex items-center">
                  <span className="text-red-500 mr-2">🚨</span>
                  <div>
                    <p className="font-bold text-red-800">{overdueAppointments.length} appointment{overdueAppointments.length > 1 ? 's' : ''} running late</p>
                    <p className="text-sm text-red-600">{overdueAppointments[0].servicesSummary} is {overdueAppointments[0].minutesLate}m overdue</p>
                  </div>
                </div>
              </div>
            ) : nextAppointment ? (
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <div className="flex items-center">
                  <span className="text-green-500 mr-2">✅</span>
                  <div>
                    <p className="font-bold text-green-800">Next up: {nextAppointment.servicesSummary}</p>
                    <p className="text-sm text-green-600">{nextAppointment.customerName} • Starting in {nextAppointment.timeUntilStart}m</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                <div className="flex items-center">
                  <span className="text-gray-500 mr-2">😌</span>
                  <div>
                    <p className="font-bold text-gray-800">You're caught up!</p>
                    <p className="text-sm text-gray-600">No immediate appointments pending</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Today's Progress</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Completed</span>
                <span className="font-bold text-green-600">{completedToday.length} jobs</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">In Progress</span>
                <span className="font-bold text-blue-600">{inProgressCount} jobs</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Scheduled</span>
                <span className="font-bold text-gray-600">{scheduledCount} jobs</span>
              </div>
              <div className="pt-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Daily Progress</span>
                  <span>{Math.round((completedToday.length / Math.max(totalJobs, 1)) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min((completedToday.length / Math.max(totalJobs, 1)) * 100, 100)}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Debug logging to see what data StatusBoard is receiving
  console.log('🎪 StatusBoard render:', {
    columnsLength: columns?.length,
    cardsLength: cards?.length,
    columns: columns,
    cards: cards
  });

  const byStatus = useMemo(() => {
    // Build a map of status => cards. Start with known columns but
    // also ensure we include any statuses present on cards even if the
    // API did not return a column for them (prevents cards from
    // disappearing when, e.g., a COMPLETED column is missing).
    // Limit visible cards on the board to a small, work-focused set
    // to avoid overwhelming the UI during demos or heavy test data.
    // Prefer today's appointments; fall back to the earliest ones.
    const map = new Map<string, typeof cards>();
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    let visible = cards.filter((c) => {
      try {
        const s = c.start ? new Date(c.start) : null;
        return s && s >= startOfDay && s <= endOfDay;
      } catch (e) {
        return false;
      }
    });

    if (!visible || visible.length === 0) {
      // no "today" items, show the earliest ones instead
      visible = [...cards].sort((a, b) => (a.position || 0) - (b.position || 0));
    }

    // Cap board to first 5 visible appointments to keep the board scannable
    const MAX_VISIBLE = 5;
    visible = visible.slice(0, MAX_VISIBLE);

    for (const col of columns) map.set(col.key, []);
    for (const c of visible) {
      const statusKey = String(c.status || 'UNKNOWN');
      if (!map.has(statusKey)) {
        // Create a placeholder column bucket for unknown/missing statuses
        map.set(statusKey, []);
      }
      const arr = map.get(statusKey)!;
      arr.push(c);
    }
    for (const [, arr] of map) arr.sort((a, b) => a.position - b.position);
    return map;
  }, [columns, cards]);

  const handleQuickReschedule = async (id: string) => {
    if (reschedulingIds.has(id)) return; // Prevent double-clicking

    setReschedulingIds(prev => new Set(prev).add(id));

    try {
      // Get appointment details for service type
      const appointment = cards.find(card => card.id === id);
      const serviceType = appointment?.servicesSummary || 'default';
      
      // Use rescheduling service with direct path
      const reschedulingModule = await import('../../services/reschedulingService.js');
      const result = await reschedulingModule.quickRescheduleToNext(id, serviceType, {
        daysAhead: 7,
        reason: 'Quick reschedule from status board'
      });
      
      if (result?.success) {
        triggerRefresh();
      } else {
        console.error('Rescheduling failed:', result?.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error in quick reschedule:', error);
      // Show user feedback for failed rescheduling
      // Note: In a real app, you'd show a toast notification
    } finally {
      setReschedulingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="overflow-x-auto pb-4" role="region" aria-label="Status Board">
        <div className="px-6 py-4">
          <TodaysFocusHero />
        </div>
        <div className="flex gap-4 min-w-max">
          {columns.map((col) => (
            <StatusColumn
              key={col.key}
              column={col}
              cards={byStatus.get(col.key) ?? []}
              onOpen={onOpen}
              onMove={(id: string) => {
                void optimisticMove(id, { status: col.key as AppointmentStatus, position: 1 });
              }}
              onQuickReschedule={(id: string) => {
                if (!reschedulingIds.has(id)) {
                  void handleQuickReschedule(id);
                }
              }}
              isRescheduling={(id: string) => reschedulingIds.has(id)}
            />
          ))}
        </div>
      </div>
    </DndProvider>
  );
}
