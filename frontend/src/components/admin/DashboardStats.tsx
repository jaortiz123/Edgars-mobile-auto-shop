import React, { useMemo } from 'react';
// Store-based stats (temporary shim until real stats endpoint integrated)
import { useBoardStore } from '@/state/useBoardStore';
import { Skeleton } from '@/components/ui/Skeleton';

export default function DashboardStats() {
  // Stats not yet migrated to board store; derive minimal placeholder from cards
  // IMPORTANT: Avoid returning a brand-new array from the selector each render (causes infinite re-render loops with Zustand + React strict mode tests)
  const cardIds = useBoardStore(s => s.cardIds);
  const cardsById = useBoardStore(s => s.cardsById);
  const cards = useMemo(() => cardIds.map(id => cardsById[id]).filter(Boolean), [cardIds, cardsById]);
  const stats = cards.length ? {
    jobsToday: cards.length,
    carsOnPremises: cards.filter(c => c.status !== 'COMPLETED').length,
    scheduled: cards.filter(c => c.status === 'SCHEDULED').length,
    inProgress: cards.filter(c => c.status === 'IN_PROGRESS').length,
    ready: cards.filter(c => c.status === 'READY').length,
    completed: cards.filter(c => c.status === 'COMPLETED').length,
    noShow: 0,
    unpaidTotal: 0,
    totals: { today_completed: 0, today_booked: cards.length, avg_cycle_formatted: '—' }
  } : null;
  const refreshStats = () => { /* no-op until real stats migrated */ };
  if (!stats) return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
      {Array.from({length:10}).map((_,i)=>(<Skeleton key={i} className="h-16"/>))}
    </div>
  );

  // Calculate progress percentage for Jobs today vs booked
  const progressPercentage = stats.totals?.today_booked && stats.totals.today_booked > 0
    ? Math.round((stats.totals.today_completed / stats.totals.today_booked) * 100)
    : 0;

  const items = [
  { label: 'Jobs Today', value: stats.jobsToday, testid: 'kpi-today' },
    { label: 'On Premises', value: stats.carsOnPremises, testid: 'kpi-onprem' },
    { label: 'Scheduled', value: stats.scheduled, testid: 'kpi-scheduled' },
    { label: 'In Progress', value: stats.inProgress, testid: 'kpi-inprogress' },
    { label: 'Ready', value: stats.ready, testid: 'kpi-ready' },
    { label: 'Completed', value: stats.completed, testid: 'kpi-completed' },
    { label: 'No-Show', value: stats.noShow, testid: 'kpi-noshow' },
    { label: 'Unpaid $', value: `$${stats.unpaidTotal.toFixed(2)}`, testid: 'kpi-unpaid' },
    // NEW v2 METRICS
    {
      label: 'Avg Cycle Time',
      value: stats.totals?.avg_cycle_formatted || 'N/A',
      testid: 'kpi-avg-cycle'
    },
    {
      label: 'Jobs Today vs Booked',
      value: `${stats.totals?.today_completed || 0}/${stats.totals?.today_booked || 0}`,
      progress: progressPercentage,
      testid: 'kpi-jobs-progress'
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <button className="text-sm underline" onClick={()=>void refreshStats()}>Refresh</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3" data-testid="dashboard-grid">
        {items.map((it) => (
          <div key={it.label} className="rounded-xl border p-4" data-testid={it.testid}>
            <div className="text-sm text-gray-500">{it.label}</div>
            <div className="mt-1 text-2xl font-semibold">{it.value}</div>
            {/* Progress bar for Jobs today vs booked */}
            {it.progress !== undefined && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    data-testid="progress-bar"
                    data-width={Math.min(it.progress, 100)}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">{it.progress}% complete</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
