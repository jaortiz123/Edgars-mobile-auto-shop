import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceCatalogModal } from '@/components/appointments/ServiceCatalogModal';
import { server } from '@/test/server/mswServer';
import { http, HttpResponse } from 'msw';

describe('ServiceCatalogModal (keyboard nav + accordion)', () => {
  it('renders categories and requires expanding a group before items appear', async () => {
    // Override the default MSW services to ensure deterministic content
    server.use(
      http.get('/api/admin/service-operations', () => HttpResponse.json([
        { id: 'svc-1', internal_code: 'OIL', name: 'Oil Change', category: 'MAINTENANCE', subcategory: 'Fluids', skill_level: 1, default_hours: 1, base_labor_rate: 80, keywords: [], is_active: true, display_order: 2 },
        { id: 'svc-2', internal_code: 'BRK-INSP', name: 'Brake Inspection', category: 'BRAKES', subcategory: 'Inspection', skill_level: 1, default_hours: 0.5, base_labor_rate: 60, keywords: [], is_active: true, display_order: 1 },
        { id: 'svc-3', internal_code: 'ALIGN', name: 'Alignment Check', category: 'MAINTENANCE', subcategory: 'Chassis', skill_level: 1, default_hours: 0.7, base_labor_rate: 69, keywords: [], is_active: true, display_order: 3 },
        { id: 'svc-4', internal_code: 'COOL', name: 'Coolant Flush', category: 'MAINTENANCE', subcategory: 'Fluids', skill_level: 1, default_hours: 1.2, base_labor_rate: 89, keywords: [], is_active: true, display_order: 4 },
      ]))
    );
  render(<ServiceCatalogModal open onClose={() => {}} onAdd={() => {}} defaultExpandAll={false} />);
    // Wait for categories container to be present
    await screen.findByTestId('service-categories');
    // No rows until a group is expanded
    expect(screen.queryByText('Oil Change')).not.toBeInTheDocument();
    // Expand Fluids only then Oil Change appears
    await userEvent.click(await screen.findByTestId('group-toggle-Fluids'));
    await screen.findByText('Oil Change');
  });

  it('filters when clicking another category (requires expanding group in that category)', async () => {
  render(<ServiceCatalogModal open onClose={() => {}} onAdd={() => {}} defaultExpandAll={false} />);
  await screen.findByTestId('service-categories');
    const brakesBtn = screen.getByRole('button', { name: /BRAKES/i });
    await userEvent.click(brakesBtn);
    // Expand its group to reveal items
    await userEvent.click(await screen.findByTestId('group-toggle-Inspection'));
    await screen.findByText('Brake Inspection');
    expect(screen.queryByText('Oil Change')).not.toBeInTheDocument();
  });

  it('invokes onAdd when clicking a service row', async () => {
  const onAdd = vi.fn();
  render(<ServiceCatalogModal open onClose={() => {}} onAdd={onAdd} defaultExpandAll={false} />);
  await screen.findByTestId('service-categories');
  await userEvent.click(await screen.findByTestId('group-toggle-Fluids'));
  const oil = await screen.findByText('Oil Change');
    await userEvent.click(oil);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0].id).toBe('svc-1');
  });

  it('focuses the search input on mount', async () => {
  render(<ServiceCatalogModal open onClose={() => {}} onAdd={() => {}} defaultExpandAll={false} />);
  const search = await screen.findByTestId('service-search');
    expect(search).toHaveFocus();
  });

  it('ArrowDown from list container focuses first visible service item after expanding groups', async () => {
  render(<ServiceCatalogModal open onClose={() => {}} onAdd={() => {}} defaultExpandAll={false} />);
  await screen.findByTestId('service-categories');
    // Expand groups so that first visible item is Oil Change (Fluids has lower min display order than Chassis)
    await userEvent.click(screen.getByTestId('group-toggle-Fluids'));
    await userEvent.click(screen.getByTestId('group-toggle-Chassis'));
    // Focus list container then press ArrowDown
    const list = screen.getByTestId('service-list');
    list.focus();
    await userEvent.keyboard('{ArrowDown}');
    const firstRow = screen.getByTestId('service-row-svc-1');
    expect(firstRow).toHaveFocus();
  });

  it('Enter on focused row triggers onAdd with correct service (after expanding groups)', async () => {
  const onAdd = vi.fn();
  render(<ServiceCatalogModal open onClose={() => {}} onAdd={onAdd} />);
  await screen.findByTestId('service-categories');
    await userEvent.click(screen.getByTestId('group-toggle-Fluids'));
    await userEvent.click(screen.getByTestId('group-toggle-Chassis'));
    const list = screen.getByTestId('service-list');
    list.focus();
    await userEvent.keyboard('{ArrowDown}'); // focus first
    await userEvent.keyboard('{Enter}');
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0].id).toBe('svc-1');
  });

  it('keyboard navigation skips services in collapsed groups', async () => {
  render(<ServiceCatalogModal open onClose={() => {}} onAdd={() => {}} />);
  await screen.findByTestId('service-categories');
  // Expand only Fluids (svc-1 and svc-4) leaving Chassis collapsed (svc-3)
  await userEvent.click(screen.getByTestId('group-toggle-Fluids'));
    const list = screen.getByTestId('service-list');
    list.focus();
    await userEvent.keyboard('{ArrowDown}'); // svc-1
    await userEvent.keyboard('{ArrowDown}'); // svc-4 (next visible)
    const secondRow = screen.getByTestId('service-row-svc-4');
    expect(secondRow).toHaveFocus();
    // Ensure hidden row (svc-3) is not focused
    const hiddenRow = screen.queryByTestId('service-row-svc-3');
    expect(hiddenRow).toBeNull();
  });
});
