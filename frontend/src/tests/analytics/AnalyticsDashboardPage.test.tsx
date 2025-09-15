import React from 'react';
import { vi } from 'vitest';
import { render, screen, waitFor } from '@test-utils';
import userEvent from '@testing-library/user-event';
import type { TemplateAnalyticsResponse } from '../../types/analytics';

// Prepare mock before importing component under test so its import of api uses the mock
type FetchParams = { range?: string; channel?: string };
const fetchTemplateAnalyticsMock = vi.fn<(p?: FetchParams) => Promise<TemplateAnalyticsResponse>>();
vi.mock('../../lib/api', () => ({
  fetchTemplateAnalytics: (p?: FetchParams) => fetchTemplateAnalyticsMock(p)
}));

import { AnalyticsDashboardPage } from '../../pages/admin/AnalyticsDashboardPage';

const baseResponse: TemplateAnalyticsResponse = {
  range: { from: '2025-08-01', to: '2025-08-16', granularity: 'day' },
  filters: { channel: 'all', limit: 50 },
  totals: { events: 60, uniqueTemplates: 3, uniqueUsers: 4, uniqueCustomers: 0, byChannel: { sms: { events: 40, pct: 0.666 }, email: { events: 20, pct: 0.333 } } },
  trend: [
    { bucketStart: '2025-08-14', count: 10 },
    { bucketStart: '2025-08-15', count: 20 },
    { bucketStart: '2025-08-16', count: 30 }
  ],
  channelTrend: [
    { bucketStart: '2025-08-14', sms: 6, email: 4 },
    { bucketStart: '2025-08-15', sms: 12, email: 8 },
    { bucketStart: '2025-08-16', sms: 22, email: 8 }
  ],
  templates: [
    {
      templateId: 't1', name: 'Reminder', channel: 'sms', totalCount: 30, uniqueUsers: 2, uniqueCustomers: 0, lastUsedAt: '2025-08-16T00:00:00Z', firstUsedAt: '2025-08-14T00:00:00Z', trendSlice: [ { bucketStart: '2025-08-15', count: 10 }, { bucketStart: '2025-08-16', count: 20 } ], pctOfTotal: 0.5, channels: {}
    },
    {
      templateId: 't2', name: 'Follow Up', channel: 'email', totalCount: 20, uniqueUsers: 1, uniqueCustomers: 0, lastUsedAt: '2025-08-16T00:00:00Z', firstUsedAt: '2025-08-14T00:00:00Z', trendSlice: [ { bucketStart: '2025-08-15', count: 5 }, { bucketStart: '2025-08-16', count: 15 } ], pctOfTotal: 0.333, channels: {}
    },
    {
      templateId: 't3', name: 'Welcome', channel: 'sms', totalCount: 10, uniqueUsers: 1, uniqueCustomers: 0, lastUsedAt: '2025-08-15T00:00:00Z', firstUsedAt: '2025-08-14T00:00:00Z', trendSlice: [ { bucketStart: '2025-08-15', count: 10 } ], pctOfTotal: 0.166, channels: {}
    }
  ],
  usageSummary: { topTemplates: [], topUsers: [] },
  meta: { generatedAt: new Date().toISOString(), cache: { hit: false }, version: 1 }
};

// Polyfill ResizeObserver for Recharts ResponsiveContainer in jsdom
class RO {
  observe() { /* noop */ }
  unobserve() { /* noop */ }
  disconnect() { /* noop */ }
}
// @ts-expect-error attach to global
global.ResizeObserver = RO as unknown as ResizeObserver;

describe('AnalyticsDashboardPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders summary, chart and table after load', async () => {
    vi.useRealTimers();
  fetchTemplateAnalyticsMock.mockResolvedValueOnce(baseResponse);
  render(<AnalyticsDashboardPage />);
  expect(screen.getByTestId('analytics-loading')).toBeInTheDocument();
  await waitFor(() => expect(fetchTemplateAnalyticsMock).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByTestId('analytics-loading')).toBeNull());
    expect(screen.getByTestId('totals-summary')).toBeInTheDocument();
    expect(screen.getByTestId('trend-chart')).toBeInTheDocument();
    expect(screen.getByTestId('templates-table')).toBeInTheDocument();
  });

  it('refetches when filters change', async () => {
    vi.useRealTimers();
  fetchTemplateAnalyticsMock.mockResolvedValue(baseResponse);
  render(<AnalyticsDashboardPage />);
  await waitFor(() => expect(fetchTemplateAnalyticsMock).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByTestId('analytics-loading')).toBeNull());

    const rangeSelect = screen.getByLabelText(/Range/i) as HTMLSelectElement;
    await userEvent.selectOptions(rangeSelect, '7d');
  // Instead of asserting call count delta (flaky under StrictMode), assert a call was made with updated range
    await waitFor(() => {
      const sawUpdatedRange = fetchTemplateAnalyticsMock.mock.calls.some(c => c[0]?.range === '7d');
      expect(sawUpdatedRange).toBe(true);
    });
  // Additionally verify the most recent call reflects the selected range
  const lastRangeArg = [...fetchTemplateAnalyticsMock.mock.calls].reverse().find(c => c[0])?.[0];
  expect(lastRangeArg).toMatchObject({ range: '7d' });
  });
});
