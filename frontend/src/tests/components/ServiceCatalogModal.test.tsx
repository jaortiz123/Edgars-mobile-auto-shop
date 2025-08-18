import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceCatalogModal } from '@/components/appointments/ServiceCatalogModal';
import type { ServiceOperation } from '@/components/appointments/ServiceCatalogModal';

// Preserve original fetch so we can restore after tests that monkey-patch
interface GlobalWithFetch { fetch: typeof fetch }
const originalFetch: typeof fetch = (globalThis as GlobalWithFetch).fetch;
// Helper to mock one fetch call returning provided data
function mockFetchOnce(data: ServiceOperation[]) {
  const mocked: typeof fetch = vi.fn(async () => new Response(JSON.stringify(data), { status: 200 })) as unknown as typeof fetch;
  (globalThis as GlobalWithFetch).fetch = mocked;
}

const MOCK_SERVICES: ServiceOperation[] = [
  { id: 'svc-1', name: 'Oil Change', category: 'MAINTENANCE', subcategory: 'Fluids', internal_code: 'OIL', display_order: 2, default_hours: 1, base_labor_rate: 49.99, is_active: true, keywords: [], skill_level: null },
  { id: 'svc-2', name: 'Brake Inspection', category: 'BRAKES', subcategory: 'Inspection', internal_code: 'BRK-INSP', display_order: 1, default_hours: 0.5, base_labor_rate: 39.0, is_active: true, keywords: [], skill_level: null },
  { id: 'svc-3', name: 'Alignment Check', category: 'MAINTENANCE', subcategory: 'Chassis', internal_code: 'ALIGN', display_order: 3, default_hours: 0.7, base_labor_rate: 69.0, is_active: true, keywords: [], skill_level: null },
  { id: 'svc-4', name: 'Coolant Flush', category: 'MAINTENANCE', subcategory: 'Fluids', internal_code: 'COOL', display_order: 4, default_hours: 1.2, base_labor_rate: 89.0, is_active: true, keywords: [], skill_level: null }
];

describe('ServiceCatalogModal (keyboard nav + accordion)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  (globalThis as GlobalWithFetch).fetch = originalFetch;
  });
  it('renders categories and defaults to MAINTENANCE (no groups expanded yet)', async () => {
    mockFetchOnce(MOCK_SERVICES);
    render(<ServiceCatalogModal open onClose={() => {}} onAdd={() => {}} />);
    await screen.findByText('MAINTENANCE');
    // No rows until a group is expanded
    expect(screen.queryByText('Oil Change')).not.toBeInTheDocument();
    expect(screen.queryByText('Alignment Check')).not.toBeInTheDocument();
    expect(screen.queryByText('Brake Inspection')).not.toBeInTheDocument();
    // Expand Fluids only then Oil Change appears
    await userEvent.click(await screen.findByTestId('group-toggle-Fluids'));
    await screen.findByText('Oil Change');
    expect(screen.queryByText('Alignment Check')).not.toBeInTheDocument();
  });

  it('filters when clicking another category (requires expanding group in that category)', async () => {
    mockFetchOnce(MOCK_SERVICES);
    render(<ServiceCatalogModal open onClose={() => {}} onAdd={() => {}} />);
    await screen.findByText('MAINTENANCE');
    const brakesBtn = screen.getByRole('button', { name: /BRAKES/i });
    await userEvent.click(brakesBtn);
    // Expand its group to reveal items
    await userEvent.click(await screen.findByTestId('group-toggle-Inspection'));
    await screen.findByText('Brake Inspection');
    expect(screen.queryByText('Oil Change')).not.toBeInTheDocument();
  });

  it('invokes onAdd when clicking a service row', async () => {
    const onAdd = vi.fn();
    mockFetchOnce(MOCK_SERVICES);
    render(<ServiceCatalogModal open onClose={() => {}} onAdd={onAdd} />);
    await screen.findByText('MAINTENANCE');
  await userEvent.click(await screen.findByTestId('group-toggle-Fluids'));
  const oil = await screen.findByText('Oil Change');
    await userEvent.click(oil);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0].id).toBe('svc-1');
  });

  it('focuses the search input on mount', async () => {
    mockFetchOnce(MOCK_SERVICES);
    render(<ServiceCatalogModal open onClose={() => {}} onAdd={() => {}} />);
    const search = await screen.findByTestId('service-search');
    expect(search).toHaveFocus();
  });

  it('ArrowDown from list container focuses first visible service item after expanding groups', async () => {
    mockFetchOnce(MOCK_SERVICES);
    render(<ServiceCatalogModal open onClose={() => {}} onAdd={() => {}} />);
    await screen.findByText('MAINTENANCE');
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
    mockFetchOnce(MOCK_SERVICES);
    render(<ServiceCatalogModal open onClose={() => {}} onAdd={onAdd} />);
    await screen.findByText('MAINTENANCE');
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
    mockFetchOnce(MOCK_SERVICES);
    render(<ServiceCatalogModal open onClose={() => {}} onAdd={() => {}} />);
    await screen.findByText('MAINTENANCE');
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

  it('renders package badge, nested children, and only parent selectable', async () => {
    const pkgId = 'svc-pkg-1';
    const child1 = 'svc-1';
    const child2 = 'svc-2';
    const data: ServiceOperation[] = [
      { id: child1, name: 'Oil Change', category: 'MAINTENANCE', subcategory: 'Fluids', internal_code: 'OIL', display_order: 2, default_hours: 1, base_labor_rate: 49.99, is_active: true, keywords: [], skill_level: null },
      { id: child2, name: 'Brake Inspection', category: 'MAINTENANCE', subcategory: 'Fluids', internal_code: 'BRK-INSP', display_order: 3, default_hours: 0.5, base_labor_rate: 39.0, is_active: true, keywords: [], skill_level: null },
      { id: pkgId, name: 'Safety Package', category: 'MAINTENANCE', subcategory: 'Fluids', internal_code: 'PKG-SAFE', display_order: 1, default_hours: 1.5, base_labor_rate: 120.0, is_active: true, keywords: [], skill_level: null, is_package: true, package_items: [ { child_id: child1, qty: 1 }, { child_id: child2, qty: 2 } ] }
    ];
    mockFetchOnce(data);
    const onAdd = vi.fn();
    render(<ServiceCatalogModal open onClose={() => {}} onAdd={onAdd} />);
    await screen.findByText('MAINTENANCE');
    // Expand group
    await userEvent.click(screen.getByTestId('group-toggle-Fluids'));
  // Badge + icon (visual distinction ensures package row rendered)
  expect(await screen.findByTestId(`package-badge-${pkgId}`)).toBeInTheDocument();
  expect(await screen.findByTestId(`package-icon-${pkgId}`)).toBeInTheDocument();
  // Ensure no add events fired just by expanding
  expect(onAdd).not.toHaveBeenCalled();
    // Children list
    const childrenList = await screen.findByTestId(`package-children-${pkgId}`);
    expect(childrenList).toBeInTheDocument();
    expect(screen.getByTestId(`package-child-${pkgId}-${child1}`)).toHaveTextContent(/Oil Change/);
    expect(screen.getByTestId(`package-child-${pkgId}-${child2}`)).toHaveTextContent(/Brake Inspection/);
    expect(screen.getByTestId(`package-child-${pkgId}-${child2}`)).toHaveTextContent(/× 2/);
    // Clicking a child should not add (non-interactive list item) - simulate by dispatching click
  await userEvent.click(screen.getByTestId(`package-child-${pkgId}-${child1}`));
  // Child click must not trigger add
  expect(onAdd).not.toHaveBeenCalled();
    // Clicking parent row should add
    await userEvent.click(screen.getByTestId(`service-row-${pkgId}`));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0].id).toBe(pkgId);
  });
});
