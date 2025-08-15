import React, { useMemo, useState } from 'react';
import { useAppointments } from '@/contexts/AppointmentContext';
import StatusColumn from './StatusColumn';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import type { AppointmentStatus } from '@/types/models';
import { format } from 'date-fns';
import CardCustomizationModal from './CardCustomizationModal';
import { BoardFilterProvider, useBoardFilters } from '@/contexts/BoardFilterContext';
import { BoardFilterPopover } from './BoardFilterPopover';

function InnerStatusBoard({ onOpen, minimalHero }: { onOpen: (id: string) => void; minimalHero?: boolean }) {
  const { columns, cards, optimisticMove, triggerRefresh, loading, boardError, isFetchingBoard } = useAppointments();
  const showInitialSkeleton = loading && cards.length === 0;
  const [showCustomize, setShowCustomize] = useState(false);
  const { applyFilters, filtersActive } = useBoardFilters();

  const getTimeGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const byStatus = useMemo(() => {
    // Show ALL cards grouped by status; no date-based filtering or slicing.
    const map = new Map<string, typeof cards>();
    for (const col of columns) map.set(col.key, []);
    for (const c of cards) {
      const statusKey = String(c.status || 'UNKNOWN');
      if (!map.has(statusKey)) map.set(statusKey, []);
      map.get(statusKey)!.push(c);
    }
    for (const [, arr] of map) arr.sort((a, b) => (a.position || 0) - (b.position || 0));
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
      <div className="nb-surface nb-border mb-6 p-6 flex flex-col gap-6">
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div>
            <h1 className="nb-dashboard-title"><span className="nb-dashboard-title-icon" aria-hidden>🔧</span>Edgar's Shop Dashboard</h1>
            <p className="text-lg font-medium mt-2 opacity-80">{getTimeGreeting()}, Edgar • {format(new Date(), 'EEEE, MMMM do')}</p>
          </div>
          <div className="flex items-stretch gap-6">
            <div className="nb-surface nb-border px-4 py-3 flex flex-col justify-center min-w-[120px]">
              <p className="text-sm font-medium opacity-70">Jobs Today</p>
              <p className="text-3xl font-bold">{completedToday.length}/{totalJobs}</p>
              <p className="text-xs opacity-60">completed</p>
            </div>
            <div className="flex items-center">
              <button
                className="nb-btn-primary px-5 py-2 font-semibold rounded-md hover:translate-y-[-2px] active:translate-y-[0] transition-transform"
                onClick={() => triggerRefresh()}
              >
                Refresh
              </button>
            </div>
            <div className="flex items-center">
              <button
                className="nb-btn-primary px-5 py-2 font-semibold rounded-md hover:translate-y-[-2px] active:translate-y-[0] transition-transform"
                onClick={() => setShowCustomize(true)}
              >
                Customize
              </button>
            </div>
          </div>
        </div>
  <div>
          {overdueAppointments.length > 0 ? (
            <div className="nb-surface nb-border p-4 urgent-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center border nb-border">⚠️</div>
                <div className="flex-1">
                  <p className="font-bold text-lg">{overdueAppointments.length} appointment{overdueAppointments.length > 1 ? 's' : ''} need attention</p>
                  <p className="text-sm opacity-70">{overdueAppointments[0].servicesSummary} is {overdueAppointments[0].minutesLate}m overdue</p>
                </div>
                <button className="nb-btn-primary px-4 py-2 font-medium rounded-md">Take Action</button>
              </div>
            </div>
          ) : nextAppointment ? (
            <div className="nb-surface nb-border p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center border nb-border">🔧</div>
                <div className="flex-1">
                  <p className="font-bold text-lg">Next up: {nextAppointment.servicesSummary}</p>
                  <p className="text-sm opacity-70">{nextAppointment.customerName} • Starting in {nextAppointment.timeUntilStart}m</p>
                </div>
                <button className="nb-btn-primary px-4 py-2 font-medium rounded-md">Prep</button>
              </div>
            </div>
          ) : (
            <div className="nb-surface nb-border p-4">You're caught up!</div>
          )}
  </div>
      </div>
    );
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="overflow-x-auto pb-4 nb-board-bg relative" role="region" aria-label="Status Board">
  {minimalHero && (
          <div className="absolute top-2 right-4 z-20 flex items-center gap-2">
            <BoardFilterPopover />
            <button
              title="Customize cards"
              aria-label="Customize cards"
              onClick={() => setShowCustomize(true)}
              className="nb-chip flex items-center justify-center"
              data-variant="primary"
            >⚙️</button>
          </div>
        )}
  <CardCustomizationModal open={showCustomize} onClose={() => setShowCustomize(false)} />
        {boardError && (
          <div className="mx-4 mt-4 mb-2 border border-danger-300 bg-danger-50 text-danger-800 px-4 py-3 rounded-md flex items-start gap-3">
            <span>⚠️</span>
            <div className="flex-1">
              <p className="font-semibold">Failed to load board</p>
              <p className="text-sm opacity-80">{boardError.message}</p>
              <button
                onClick={() => triggerRefresh()}
                className="mt-2 nb-chip" data-variant="primary"
              >Retry</button>
            </div>
          </div>
        )}
        {minimalHero ? (
          <div className="h-0" aria-hidden />
        ) : <TodaysFocusHero />}
        <div className="nb-board-grid mt-4">
          {showInitialSkeleton ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3 p-4 nb-surface nb-border rounded-md animate-pulse">
                <div className="h-6 w-32 bg-neutral-200 rounded" />
                <div className="space-y-2">
                  <div className="h-24 w-full bg-neutral-200 rounded" />
                  <div className="h-24 w-full bg-neutral-200 rounded" />
                </div>
              </div>
            ))
          ) : (
            columns.map((col) => {
              const all = byStatus.get(col.key) ?? [];
              const filtered = filtersActive ? applyFilters(all) : all;
              return (
                <StatusColumn
                  key={col.key}
                  column={col}
                  cards={filtered}
                  totalCount={all.length}
                  filteredCount={filtered.length}
                  onOpen={onOpen}
                  onMove={(id: string) => {
                    void optimisticMove(id, { status: col.key as AppointmentStatus, position: 1 });
                  }}
                />
              );
            })
          )}
        </div>
        {isFetchingBoard && !showInitialSkeleton && !boardError && (
          <div className="mt-4 mx-4 text-xs opacity-70">Refreshing…</div>
        )}
      </div>
    </DndProvider>
  );
}

export default function StatusBoard(props: { onOpen: (id: string) => void; minimalHero?: boolean }) {
  return (
    <BoardFilterProvider>
      <InnerStatusBoard {...props} />
    </BoardFilterProvider>
  );
}
