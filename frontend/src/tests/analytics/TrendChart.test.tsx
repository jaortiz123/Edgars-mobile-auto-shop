import React from 'react';
import { render, screen } from '@test-utils';
import TrendChart from '../../components/analytics/TrendChart';
import { describe, it, expect } from 'vitest';

// Polyfill ResizeObserver for Recharts ResponsiveContainer in jsdom
class RO {
  observe() { /* noop */ }
  unobserve() { /* noop */ }
  disconnect() { /* noop */ }
}
// @ts-expect-error attach to global
global.ResizeObserver = RO as unknown as ResizeObserver;

describe('TrendChart', () => {
  it('renders with data', () => {
    const data = [
      { bucketStart: '2025-08-10', count: 5 },
      { bucketStart: '2025-08-11', count: 7 },
      { bucketStart: '2025-08-12', count: 3 },
    ];
    render(<TrendChart data={data} />);
    expect(screen.getByTestId('trend-chart')).toBeInTheDocument();
  });

  it('handles empty data', () => {
    render(<TrendChart data={[]} />);
    expect(screen.getByText(/No trend data/i)).toBeInTheDocument();
  });
});
