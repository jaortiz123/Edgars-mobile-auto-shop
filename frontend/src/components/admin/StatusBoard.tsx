import React, { useMemo, useState, useEffect } from 'react';
import StatusColumn from './StatusColumn';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { format } from 'date-fns';
import CardCustomizationModal from './CardCustomizationModal';
import { BoardFilterProvider, useBoardFilters } from '@/contexts/BoardFilterContext';
import { BoardFilterPopover } from './BoardFilterPopover';
import { useBoardStore } from '@/state/useBoardStore';
import { useToast } from '@/components/ui/Toast';
import type { BoardCard, BoardColumn } from '@/types/models';
import type { BoardState } from '@/state/useBoardStore';
import { useBoard } from '@/hooks/useBoardData';
import { MultiSelectProvider } from '@/contexts/multiSelectProvider';
import { BulkActionToolbar } from './BulkActionToolbar';

function InnerStatusBoard({ onOpen, minimalHero, __debugDisableModal, __debugDisableDnd, __debugDisableFilter, __debugSimpleCols, __debugSimpleCards, __debugDisableToast }: { onOpen: (id: string) => void; minimalHero?: boolean; __debugDisableModal?: boolean; __debugDisableDnd?: boolean; __debugDisableFilter?: boolean; __debugSimpleCols?: boolean; __debugSimpleCards?: boolean; __debugDisableToast?: boolean }) {
  // Store is initialized at the AdminLayout level now (singleton for admin session)
  // IMPORTANT: Avoid constructing new arrays/objects inside Zustand selectors; that causes
  // a new reference every render and thus an infinite re-render loop under StrictMode.
  const columns = useBoardStore((s: BoardState) => s.columns);
  const loading = useBoardStore((s: BoardState) => s.loading);
  const storeErrorStr = useBoardStore((s: BoardState) => s.error);
  const cardIds = useBoardStore((s: BoardState) => s.cardIds);
  const cardsById = useBoardStore((s: BoardState) => s.cardsById);
  const allCards = useMemo(() => cardIds.map((id: string) => cardsById[id]).filter(Boolean), [cardIds, cardsById]);
  // Compute filtered cards once; applyFilters identity only changes when filters change.
  // This keeps downstream grouping efficient and stable.
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
  const filteredCards = useMemo(() => (filtersActive ? applyFilters(allCards) : allCards), [filtersActive, applyFilters, allCards]);
  const cards = filteredCards; // alias retained for existing usages (hero, etc.)
  const boardError = React.useMemo(() => (storeErrorStr ? new Error(storeErrorStr) : null), [storeErrorStr]);
  // Access underlying React Query board fetch so we can manually refresh on custom events
  const { boardQuery } = useBoard();
  const triggerRefresh = React.useCallback(() => { try { void boardQuery.refetch(); } catch { /* ignore */ } }, [boardQuery]);
  const moveAppointment = useBoardStore((s: BoardState) => s.moveAppointment);
  const storeError = storeErrorStr;
  const setError = useBoardStore((s: BoardState) => s.setError);
  const toast = useToast();
  // Side-effects must not run during render; isolate in effect to avoid render loops
  useEffect(() => {
    if (__debugDisableToast) return;
    if (storeError) {
      toast.error(storeError);
      setError(null); // clear after surfacing
    }
  }, [storeError, toast, setError, __debugDisableToast]);
  // Debug instrumentation (dev only) to trace board population issues in E2E
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log('🎪 StatusBoard debug', {
      columnsLen: columns.length,
      cardsLen: allCards.length,
      loading,
      storeError,
      boardError: boardError?.message
    });
    // Expose a testing hook to trigger moves without relying on drag events (E2E stability)
    try {
      interface BoardWindow extends Window {
        __boardMove?: (id: string, status: string) => Promise<void>;
        __boardMoveAttempt?: (id: string, status: string) => Promise<{ ok: boolean; error?: string; status?: string }>;
        __boardMoveLastError?: string | null;
        __boardStatusMap?: () => Record<string,string>;
  __openAppt?: (id: string) => void;
      }
      const w = window as BoardWindow;
      w.__boardMove = async (id: string, status: string) => {
        try { await moveAppointment(id, { status, position: 1 }); } catch { /* swallow legacy */ }
      };
      w.__boardMoveAttempt = async (id: string, status: string) => {
        try {
          await moveAppointment(id, { status, position: 1 });
          w.__boardMoveLastError = null;
          return { ok: true, status };
        } catch (e: unknown) {
          let msg: string;
          if (typeof e === 'string') msg = e;
          else if (e && typeof e === 'object' && 'message' in e) msg = String((e as { message?: unknown }).message || 'error');
          else msg = 'unknown error';
          w.__boardMoveLastError = msg;
          return { ok: false, error: msg };
        }
      };
      w.__boardStatusMap = () => {
        const map: Record<string,string> = {};
        for (const c of allCards) { if (c?.id) map[c.id] = String(c.status||''); }
        return map;
      };
  // E2E helper to open drawer directly bypassing UI click complexity
  w.__openAppt = (id: string) => { try { onOpen(id); } catch { /* ignore */ } };
    } catch { /* no-op */ }
  }, [columns.length, allCards.length, allCards, loading, storeError, boardError, moveAppointment, onOpen]);

  // Listen for global board:refresh or appointments:created events to refetch board data
  useEffect(() => {
    const handler = () => triggerRefresh();
    window.addEventListener('board:refresh', handler);
    window.addEventListener('appointments:created', handler);
    return () => {
      window.removeEventListener('board:refresh', handler);
      window.removeEventListener('appointments:created', handler);
    };
  }, [triggerRefresh]);
  const isFetchingBoard = false; // placeholder until wired to query status
  const showInitialSkeleton = loading && cards.length === 0;
  const [showCustomize, setShowCustomize] = useState(false);
  // (Filtering logic moved earlier to compute filteredCards once.)

  const getTimeGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const byStatusAll = useMemo(() => {
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

  const byStatusFiltered = useMemo(() => {
    if (!filtersActive) return byStatusAll;
    const map = new Map<string, BoardCard[]>();
    for (const col of columns) map.set(col.key, []);
    for (const c of filteredCards) {
      const statusKey = String(c.status || 'UNKNOWN');
      if (!map.has(statusKey)) map.set(statusKey, []);
      map.get(statusKey)!.push(c);
    }
    for (const [, arr] of map) arr.sort((a: BoardCard, b: BoardCard) => (a.position || 0) - (b.position || 0));
    return map;
  }, [filtersActive, filteredCards, byStatusAll, columns]);

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
      <MultiSelectProvider>
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
        <div className="nb-board-grid mt-4" data-debug-simple-cols={__debugSimpleCols || __debugSimpleCards || __debugDisableDnd ? '1' : undefined}>
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
              const simplified = __debugSimpleCols || __debugSimpleCards || __debugDisableDnd;
              return columns.map((col: BoardColumn) => {
                const allList = byStatusFiltered.get(col.key) ?? [];
                const filteredAll = filtersActive && applyFilters ? applyFilters(allList) : allList;
                const cardList = filteredAll.map((c: BoardCard, idx: number) => {
                  if (!firstAssigned && idx === 0) {
                    firstAssigned = true;
                    return { ...c, __isFirstGlobal: true } as typeof c & { __isFirstGlobal: true };
                  }
                  return c;
                });
                if (simplified) {
                  return (
                    <div key={col.key} className="nb-column" data-status-key={col.key} data-simplified="1">
                      <div className="nb-column-header"><h3 className="font-bold flex items-center justify-center gap-2 w-full text-center">{col.title} <span className="nb-chip" data-variant="primary">{cardList.length}</span></h3></div>
                      <div className="nb-column-scroll" data-testid="status-column-scroll">
                        {cardList.map((c: BoardCard) => (
                          <div key={c.id} data-appointment-id={c.id} data-testid={`apt-card-${c.id}`} className="nb-card p-2 border mb-2 rounded bg-white shadow-sm">
                            <div className="text-xs font-semibold">{c.headline || c.servicesSummary || c.id}</div>
                            {__debugSimpleCards ? null : <div className="text-[10px] opacity-70">{c.customerName}</div>}
                          </div>
                        ))}
                        {cardList.length === 0 && <div className="text-xs opacity-60 nb-card nb-card-empty" data-status="empty">No items</div>}
                      </div>
                    </div>
                  );
                }
                return (
                  <StatusColumn
                    key={col.key}
                    column={col}
                    cards={cardList}
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
      <BulkActionToolbar
        allCards={allCards}
        onDeleteSelected={(cardIds) => {
          // TODO: Implement bulk delete functionality
          console.log('Delete selected cards:', cardIds);
          if (!__debugDisableToast && toast) {
            toast.success(`Deleted ${cardIds.length} appointment${cardIds.length === 1 ? '' : 's'}`);
          }
        }}
      />
      </MultiSelectProvider>
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
  const SIMPLE_COLS = !!dbgParams?.has('sb_simplecols');
  const SIMPLE_CARDS = !!dbgParams?.has('sb_simplecards');
  const MINIMAL = !!dbgParams?.has('sb_min');
  const DISABLE_TOAST = !!dbgParams?.has('sb_notost');

  // Wrap InnerStatusBoard to conditionally skip modal / dnd / filters.
  // We intercept props here rather than duplicating logic inside.
  if (MINIMAL) {
    // Extreme short-circuit to binary search loop source: only touch board store minimally.
    // Keep provider shell identical to rule out provider-level effects.
    return (
      <BoardFilterProvider debugShim={true}>
        <div className="nb-board-grid" data-minimal-board>
          <div className="nb-column" data-status-key="stub"><div className="nb-column-header"><h3>Stub</h3></div><div className="nb-column-scroll"><div className="nb-card p-2">Minimal</div></div></div>
        </div>
      </BoardFilterProvider>
    );
  }

  const Inner = (
    <InnerStatusBoard
      {...props}
      __debugDisableModal={DISABLE_MODAL}
      __debugDisableDnd={DISABLE_DND}
      __debugDisableFilter={DISABLE_FILTER}
      __debugSimpleCols={SIMPLE_COLS}
      __debugSimpleCards={SIMPLE_CARDS}
      __debugDisableToast={DISABLE_TOAST}
    />
  );

  // E2E helper: expose a deterministic open function when running in DEV
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__openAppt = (id: string) => {
      try { props.onOpen(id); } catch (e) { console.warn('window.__openAppt failed', e); }
    };
  }

  return <BoardFilterProvider debugShim={DISABLE_FILTER}>{Inner}</BoardFilterProvider>;
}
