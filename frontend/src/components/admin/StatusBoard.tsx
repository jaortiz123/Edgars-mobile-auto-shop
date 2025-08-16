import React, { useMemo, useState, useEffect } from 'react';
import StatusColumn from './StatusColumn';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { format } from 'date-fns';
import CardCustomizationModal from './CardCustomizationModal';
import { BoardFilterProvider, useBoardFilters } from '@/contexts/BoardFilterContext';
import { BoardFilterPopover } from './BoardFilterPopover';
import { useBoardFilteredCards, useBoardStore } from '@/state/useBoardStore';
import { useToast } from '@/components/ui/Toast';
import type { BoardCard, BoardColumn } from '@/types/models';
import type { BoardState } from '@/state/useBoardStore';

function InnerStatusBoard({ onOpen, minimalHero, __debugDisableModal, __debugDisableDnd, __debugDisableFilter }: { onOpen: (id: string) => void; minimalHero?: boolean; __debugDisableModal?: boolean; __debugDisableDnd?: boolean; __debugDisableFilter?: boolean }) {
  // Store is initialized at the AdminLayout level now (singleton for admin session)
  const columns = useBoardStore((s: BoardState) => s.columns);
  const loading = useBoardStore((s: BoardState) => s.loading);
  const boardError = useBoardStore((s: BoardState) => (s.error ? new Error(s.error) : null));
  const cards = useBoardFilteredCards();
  const allCards = useBoardStore((s: BoardState) => s.cardIds.map((id: string) => s.cardsById[id]).filter(Boolean));
  const triggerRefresh = () => {/* future: call refresh action or invalidate query via legacy path */};
  const moveAppointment = useBoardStore((s: BoardState) => s.moveAppointment);
  const storeError = useBoardStore((s: BoardState) => s.error);
  const setError = useBoardStore((s: BoardState) => s.setError);
  const toast = useToast();
  // Side-effects must not run during render; isolate in effect to avoid render loops
  useEffect(() => {
    if (storeError) {
      toast.error(storeError);
      setError(null); // clear after surfacing
    }
  }, [storeError, toast, setError]);
  // Debug instrumentation (dev only) to trace board population issues in E2E
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('🎪 StatusBoard debug', {
        columnsLen: columns.length,
        cardsLen: allCards.length,
        loading,
        storeError,
        boardError: boardError?.message
      });
    }
  }, [columns.length, allCards.length, loading, storeError, boardError]);
  const isFetchingBoard = false; // placeholder until wired to query status
  const showInitialSkeleton = loading && cards.length === 0;
  const [showCustomize, setShowCustomize] = useState(false);
  // Always call hook (Rules of Hooks), but ignore its values when debug-disabling filters.
  let filterCtx = useBoardFilters();
  if (__debugDisableFilter) {
    filterCtx = {
      filters: { search: '', statuses: null, techs: [], blockers: [] },
      setFilters: () => {},
      clearFilters: () => {},
      applyFilters: (cards: BoardCard[]) => cards,
      filtersActive: false,
      activeCount: 0,
    } as typeof filterCtx;
  }
  const { applyFilters, filtersActive } = filterCtx;

  const getTimeGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const byStatus = useMemo(() => {
    // Show ALL cards grouped by status; no date-based filtering or slicing.
  const map = new Map<string, BoardCard[]>();
  for (const col of columns) map.set(col.key, []);
  for (const c of allCards) {
      const statusKey = String(c.status || 'UNKNOWN');
      if (!map.has(statusKey)) map.set(statusKey, []);
      map.get(statusKey)!.push(c);
    }
  for (const [, arr] of map) arr.sort((a: BoardCard, b: BoardCard) => (a.position || 0) - (b.position || 0));
    return map;
  }, [columns, allCards]);

  const TodaysFocusHero = () => {
    const now = new Date();
  const todaysCards = (cards as BoardCard[]).filter((c: BoardCard) => {
      try { return c.start && new Date(c.start).toDateString() === now.toDateString(); } catch { return false; }
    });

    const nextAppointment = todaysCards
  .filter((c: BoardCard) => c.status === 'SCHEDULED' && typeof c.timeUntilStart === 'number' && c.timeUntilStart > 0)
  .sort((a: BoardCard, b: BoardCard) => (a.timeUntilStart || 0) - (b.timeUntilStart || 0))[0];

  const overdueAppointments = todaysCards.filter((c: BoardCard & { isOverdue?: boolean }) => c.isOverdue);
  const completedToday = todaysCards.filter((c: BoardCard) => c.status === 'COMPLETED');
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

  const Wrapper: React.FC<{children: React.ReactNode}> = ({ children }) => {
    if (__debugDisableDnd) return <>{children}</>;
    return <DndProvider backend={HTML5Backend}>{children}</DndProvider>;
  };
  return (
    <Wrapper>
  {/* Early guard: if columns & cards populated but grid failed to mount previously, ensure a render path still outputs grid wrapper */}
  <div
        className="overflow-x-auto pb-4 nb-board-bg relative"
        role="region"
        aria-label="Status Board"
  data-board-ready={!showInitialSkeleton && allCards.length > 0 ? '1' : undefined}
  data-first-apt-id={!showInitialSkeleton && allCards.length > 0 ? allCards[0]?.id : undefined}
      >
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
  {!__debugDisableModal && <CardCustomizationModal open={showCustomize} onClose={() => setShowCustomize(false)} />}
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
            (() => {
              let firstAssigned = false;
              return columns.map((col: BoardColumn) => {
                const allList = byStatus.get(col.key) ?? [];
                const filteredAll = filtersActive && applyFilters ? applyFilters(allList) : allList;
                // Already store-level filtered list used for counts; use filteredAll for per-column filtering
                return (
                  <StatusColumn
                    key={col.key}
                    column={col}
                    cards={filteredAll.map((c: BoardCard, idx: number) => {
                      if (!firstAssigned && idx === 0) {
                        firstAssigned = true;
                        return { ...c, __isFirstGlobal: true } as typeof c & { __isFirstGlobal: true };
                      }
                      return c;
                    })}
                    totalCount={allList.length}
                    filteredCount={filteredAll.length}
                    onOpen={onOpen}
                    onMove={(id: string) => { void moveAppointment(id, { status: col.key, position: 1 }); }}
                  />
                );
              });
            })()
          )}
        </div>
        {isFetchingBoard && !showInitialSkeleton && !boardError && (
          <div className="mt-4 mx-4 text-xs opacity-70">Refreshing…</div>
        )}
      </div>
  </Wrapper>
  );
}

export default function StatusBoard(props: { onOpen: (id: string) => void; minimalHero?: boolean }) {
  // Debug flags (DEV only) for isolating infinite render loop. Example:
  // /e2e/board?full=1&sb_nomodal=1&sb_nofilter=1&sb_nodnd=1
  const dbgParams = (import.meta.env.DEV && typeof window !== 'undefined') ? new URLSearchParams(window.location.search) : null;
  const DISABLE_MODAL = !!dbgParams?.has('sb_nomodal');
  const DISABLE_FILTER = !!dbgParams?.has('sb_nofilter');
  const DISABLE_DND = !!dbgParams?.has('sb_nodnd');

  // Wrap InnerStatusBoard to conditionally skip modal / dnd / filters.
  // We intercept props here rather than duplicating logic inside.
  const Inner = (
    <InnerStatusBoard
      {...props}
      __debugDisableModal={DISABLE_MODAL}
      __debugDisableDnd={DISABLE_DND}
      __debugDisableFilter={DISABLE_FILTER}
    />
  );

  if (DISABLE_FILTER) {
    // Minimal no-op filter context implementation
    const NoopFilterProvider: React.FC<{children: React.ReactNode}> = ({ children }) => <>{children}</>;
    if (import.meta.env.DEV) console.log('[StatusBoard debug] Filters disabled via sb_nofilter');
    return <NoopFilterProvider>{Inner}</NoopFilterProvider>;
  }
  return <BoardFilterProvider>{Inner}</BoardFilterProvider>;
}
