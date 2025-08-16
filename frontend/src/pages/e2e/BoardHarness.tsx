import React from 'react';
// Importing full StatusBoard triggers infinite loop; we'll start with a slim version to isolate root cause.
// import StatusBoard from '../../components/admin/StatusBoard';
import { useBoardStore } from '../../state/useBoardStore';
const SlimStatusBoard: React.FC = () => {
  const columns = useBoardStore(s => s.columns);
  const cardsById = useBoardStore(s => s.cardsById);
  const cardIds = useBoardStore(s => s.cardIds);
  const loading = useBoardStore(s => s.loading);
  const error = useBoardStore(s => s.error);
  // Map cards now to avoid generating new arrays in child components
  const cards = cardIds.map(id => cardsById[id]).filter(Boolean);
  if (error) return <div data-slim-error className="text-red-600">Error: {error}</div>;
  if (loading && cards.length === 0) return <div data-slim-loading>Loading board…</div>;
  return (
    <div className="nb-board-grid mt-2" data-slim-board>
      {columns.map(col => {
        const colCards = cards.filter(c => c.status === col.key);
        return (
          <div key={col.key} className="nb-column" data-status-key={col.key}>
            <div className="nb-column-header"><h3 className="font-bold text-center">{col.title} <span className="text-xs">({colCards.length})</span></h3></div>
            <div className="nb-column-scroll">
              {colCards.map(c => (
                <div key={c.id} data-appointment-id={c.id} className="nb-card p-2 border mb-2 rounded bg-white shadow-sm">
                  <div className="text-xs font-semibold">{c.headline || c.servicesSummary || c.id}</div>
                  <div className="text-[10px] opacity-70">{c.customerName}</div>
                </div>
              ))}
              {colCards.length === 0 && <div className="text-[10px] opacity-50">None</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};
// Note: BoardStoreProvider at root already initializes store; avoid duplicate initializer here.
import { CardPreferencesProvider } from '../../contexts/CardPreferencesContext';

class HarnessErrorBoundary extends React.Component<{children: React.ReactNode}, {error: Error | null}> {
  constructor(props: {children: React.ReactNode}) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('BoardHarness error boundary caught', { error, info });
  }
  render() {
    if (this.state.error) {
      return <div data-harness-error className="p-4 bg-red-100 text-red-800 rounded">Harness Error: {this.state.error.message}</div>;
    }
    return this.props.children;
  }
}

const FullBoardLazy: React.FC = () => {
  const [Comp, setComp] = React.useState<React.ComponentType | null>(null);
  React.useEffect(() => {
    let mounted = true;
    import('../../components/admin/StatusBoard').then(m => { if (mounted) setComp(() => (m.default as unknown as React.ComponentType<any>)); });
    return () => { mounted = false; };
  }, []);
  if (!Comp) return <div data-full-loading className="text-xs opacity-60">Loading full board…</div>;
  const C: any = Comp;
  return <C onOpen={() => { /* noop */ }} minimalHero />;
};

/**
 * Minimal harness page to isolate and render the StatusBoard without the surrounding
 * Admin dashboard chrome or additional dashboard-specific logic. Helps debug the
 * infinite render / missing grid issue by eliminating other effects.
 */
const BoardHarness: React.FC = () => {
  return (
    <CardPreferencesProvider>
      <div className="p-2">
  <h1 className="text-sm font-semibold mb-2">Board Harness (Slim)</h1>
        <HarnessErrorBoundary>
          {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('full') === '1' ? (
            // Lazy import inside harness to avoid executing full board tree unless requested
            <FullBoardLazy />
          ) : (
            <SlimStatusBoard />
          )}
        </HarnessErrorBoundary>
      </div>
    </CardPreferencesProvider>
  );
};

export default BoardHarness;
