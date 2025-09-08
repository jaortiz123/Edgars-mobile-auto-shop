import React, { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { fetchTemplateAnalytics, TemplateAnalyticsResponse } from '../../lib/api';
// Lazy load heavy chart components to reduce initial bundle size
const TotalsSummary = lazy(() => import('../../components/analytics/TotalsSummary'));
const TrendChart = lazy(() => import('../../components/analytics/TrendChart'));
const TemplatesTable = lazy(() => import('../../components/analytics/TemplatesTable'));

interface AsyncState<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
}

const initialState: AsyncState<TemplateAnalyticsResponse> = { loading: true, error: null, data: null };

export const AnalyticsDashboardPage: React.FC = () => {
  const [state, setState] = useState<AsyncState<TemplateAnalyticsResponse>>(initialState);
  const [range, setRange] = useState<'7d'|'30d'|'90d'|'180d'>('30d');
  const [channel, setChannel] = useState<'all'|'sms'|'email'>('all');

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setState(s => ({ ...s, loading: true, error: null }));
    try {
      const resp = await fetchTemplateAnalytics({ range, channel });
      console.log('[AnalyticsDashboard] fetched analytics response', { resp, range, channel });
      setState({ loading: false, error: null, data: resp });
    } catch (err) {
      console.error('[AnalyticsDashboard] fetch error', err);
      setState({ loading: false, error: (err as Error).message || 'Failed to load analytics', data: null });
    }
  }, [range, channel]);

  useEffect(() => { load(); }, [load]);

  const onChangeRange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as '7d'|'30d'|'90d'|'180d';
    setRange(val);
  };
  const onChangeChannel = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as 'all'|'sms'|'email';
    setChannel(val);
  };

  if (state.loading) return <div className="p-4 text-sm text-muted-foreground" data-testid="analytics-loading">Loading analytics…</div>;
  if (state.error) return <div className="p-4 text-sm text-red-600" data-testid="analytics-error">Error: {state.error}</div>;
  if (!state.data) return <div className="p-4 text-sm" data-testid="analytics-empty">No data.</div>;

  const { totals, trend, templates } = state.data;
  return (
  <div className="p-6 space-y-6" data-testid="analytics-dashboard-root">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-xl font-semibold">Messaging Analytics</h1>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-secondary flex items-center gap-1">
            <span>Range</span>
            <select value={range} onChange={onChangeRange} className="border rounded px-2 py-1 text-sm bg-white">
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="180d">Last 180 Days</option>
            </select>
          </label>
          <label className="text-sm text-secondary flex items-center gap-1">
            <span>Channel</span>
            <select value={channel} onChange={onChangeChannel} className="border rounded px-2 py-1 text-sm bg-white">
              <option value="all">All</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
            </select>
          </label>
        </div>
      </div>
      <Suspense fallback={<div className="h-24 bg-gray-50 animate-pulse rounded"></div>}>
        <TotalsSummary totals={totals} />
      </Suspense>
      <div>
        <h2 className="text-sm font-semibold mb-2 text-gray-700">Message Volume Trend</h2>
        <Suspense fallback={<div className="h-64 bg-gray-50 animate-pulse rounded"></div>}>
          <TrendChart data={trend} />
        </Suspense>
      </div>
      <Suspense fallback={<div className="h-96 bg-gray-50 animate-pulse rounded"></div>}>
        <TemplatesTable templates={templates} />
      </Suspense>
      <pre className="text-xs bg-gray-50 border rounded p-2 overflow-auto max-h-96" aria-label="debug-json">
        {JSON.stringify(state.data, null, 2)}
      </pre>
    </div>
  );
};

export default AnalyticsDashboardPage;
