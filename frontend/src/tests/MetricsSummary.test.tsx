import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MetricsSummary from '@/components/customer/MetricsSummary';
import type { CustomerMetrics } from '@/lib/customerProfileApi';

const fullMetrics: CustomerMetrics = {
  totalSpent: 7325.4,
  unpaidBalance: 120.55,
  visitsCount: 18,
  completedCount: 17,
  avgTicket: 406.97,
  lastServiceAt: '2025-07-10T12:00:00.000Z',
  lastVisitAt: '2025-07-15T15:30:00.000Z',
  last12MonthsSpent: 5000,
  last12MonthsVisits: 12,
  vehiclesCount: 2,
  isVip: true,
  isOverdueForService: false,
};

describe('MetricsSummary', () => {
  it('renders all primary metrics with correct formatting', () => {
    render(<MetricsSummary metrics={fullMetrics} />);
    expect(screen.getByTestId('metric-totalSpent')).toHaveTextContent('$7,325.40');
    expect(screen.getByTestId('metric-visitsCount')).toHaveTextContent('18');
    expect(screen.getByTestId('metric-unpaidBalance')).toHaveTextContent('$120.55');
    // lastVisitAt formatted as locale date; we just assert container not empty dash
    const lastVisit = screen.getByTestId('metric-lastVisitAt');
    expect(lastVisit).not.toHaveTextContent('—');
  });

  it('gracefully renders placeholders for null/undefined values', () => {
    const partial: CustomerMetrics = {
      totalSpent: 0,
      unpaidBalance: 0,
      visitsCount: 0,
      completedCount: 0,
      avgTicket: 0,
      lastServiceAt: null,
      lastVisitAt: null,
      last12MonthsSpent: 0,
      last12MonthsVisits: 0,
      vehiclesCount: 0,
      isVip: false,
      isOverdueForService: false,
    };
    render(<MetricsSummary metrics={partial} />);
    expect(screen.getByTestId('metric-lastVisitAt')).toHaveTextContent('—');
  });
});
