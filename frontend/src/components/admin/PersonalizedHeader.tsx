import React, { useEffect, useMemo, useState } from 'react';
import { useAppointmentContext } from '@/contexts/AppointmentContext';
import { PersonalityEngine, type DayPerformance } from '@/utils/personalityEngine';
import { format } from 'date-fns';
import type { BoardCard } from '@/types/models';

function getHoursUntilClose(now: Date) {
  const close = new Date(now);
  close.setHours(18, 0, 0, 0); // 6pm close default
  return Math.max(0, Math.round((close.getTime() - now.getTime()) / (1000 * 60 * 60)));
}

function calculateScheduleStatus(cards: BoardCard[]) {
  const upcoming = cards.filter(c => c.status === 'SCHEDULED' && (c.timeUntilStart ?? 0) > 0);
  // crude heuristic: if next job starts in > 30m or there are fewer than 2 remaining, call it ahead
  return upcoming.length <= 1 || (upcoming[0]?.timeUntilStart ?? 0) > 30;
}

export default function PersonalizedHeader() {
  const { cards } = useAppointmentContext();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showPersonality, setShowPersonality] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const performance: DayPerformance = useMemo(() => {
    const completedCount = cards.filter(c => c.status === 'COMPLETED').length;
    const totalCount = cards.length;
    const isAheadOfSchedule = calculateScheduleStatus(cards);
    const challengingDay = cards.filter(c => c.complexity === 'complex').length > 2;
    return {
      completedCount,
      totalCount,
      isAheadOfSchedule,
      averageDaily: 6,
      challengingDay,
    };
  }, [cards]);

  const greeting = useMemo(() => PersonalityEngine.getGreeting(currentTime.getHours(), 'Edgar', performance), [currentTime, performance]);

  const encouragement = useMemo(() => PersonalityEngine.getProgressEncouragement({
    completedToday: performance.completedCount,
    totalToday: performance.totalCount,
    timeRemaining: getHoursUntilClose(currentTime),
    isOnTrack: performance.isAheadOfSchedule,
  }), [currentTime, performance]);

  return (
    <div className="bg-gradient-to-r from-neutral-50 via-white to-steel-50 border-b border-neutral-200 px-6 py-6 rounded-lg mb-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h1 className="text-4xl font-bold text-neutral-900 tracking-tight">Edgar's Shop Dashboard</h1>
            {performance.isAheadOfSchedule && (
              <div className="animate-bounce" aria-hidden>
                <span className="text-2xl">🚀</span>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-lg font-medium text-neutral-700">{greeting}</p>
            {showPersonality && (
              <p className="text-sm text-primary-600 font-medium">{encouragement}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-neutral-500">{format(currentTime, 'EEEE, MMMM do')}</p>
          <p className="text-lg font-semibold text-neutral-700">{format(currentTime, 'h:mm a')}</p>
          <button
            className="mt-2 text-xs text-neutral-500 underline"
            onClick={() => setShowPersonality(v => !v)}
          >
            {showPersonality ? 'Hide tips' : 'Show tips'}
          </button>
        </div>
      </div>
    </div>
  );
}
