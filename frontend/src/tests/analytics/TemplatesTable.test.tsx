import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TemplatesTable from '../../components/analytics/TemplatesTable';
import type { TemplateAnalyticsTemplate } from '../../types/analytics';

function buildTemplate(partial: Partial<TemplateAnalyticsTemplate>): TemplateAnalyticsTemplate {
  return {
    templateId: partial.templateId || Math.random().toString(36).slice(2),
    name: partial.name || 'Template',
    channel: partial.channel || 'sms',
    totalCount: partial.totalCount ?? 0,
    uniqueUsers: partial.uniqueUsers ?? 0,
    uniqueCustomers: partial.uniqueCustomers ?? 0,
    lastUsedAt: partial.lastUsedAt || new Date().toISOString(),
    firstUsedAt: partial.firstUsedAt || new Date().toISOString(),
    trendSlice: partial.trendSlice || [{ bucketStart: '2025-08-10', count: 2 }, { bucketStart: '2025-08-11', count: 4 }],
    pctOfTotal: partial.pctOfTotal ?? 0,
    channels: partial.channels || {},
  };
}

describe('TemplatesTable', () => {
  it('renders rows and sorts by Total Sent then Unique Users', async () => {
    const templates = [
      buildTemplate({ templateId: 'a', name: 'A', totalCount: 10, uniqueUsers: 3 }),
      buildTemplate({ templateId: 'b', name: 'B', totalCount: 30, uniqueUsers: 1 }),
      buildTemplate({ templateId: 'c', name: 'C', totalCount: 20, uniqueUsers: 5 }),
    ];
    render(<TemplatesTable templates={templates} />);

    // Initial sort: totalCount desc => B (30), C (20), A (10)
    const bodyRows = () => screen.getAllByRole('row').filter(r => within(r).queryAllByRole('cell').length > 0);
    const nameOrder = () => bodyRows().map(r => within(r).getAllByRole('cell')[0].textContent);
    expect(nameOrder()).toEqual(['B', 'C', 'A']);

    const uniqueUsersHeader = screen.getByRole('columnheader', { name: /Unique Users/i });
    await userEvent.click(uniqueUsersHeader);
    expect(nameOrder()).toEqual(['C', 'A', 'B']);

    await userEvent.click(uniqueUsersHeader);
    expect(nameOrder()).toEqual(['B', 'A', 'C']);
  });
});
