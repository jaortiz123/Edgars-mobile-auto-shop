import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { CardPreferencesProvider } from '@/contexts/CardPreferencesContext';
// minute tick flush removed (no longer needed)
import CardCustomizationModal from '@/components/admin/CardCustomizationModal';
// Mock react-dnd to avoid internal async state updates that trigger act warnings
vi.mock('react-dnd', () => ({
  useDrag: () => [{ isDragging: false }, () => {}],
  useDrop: () => [{}, () => {}],
  DndProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));
vi.mock('react-dnd-html5-backend', () => ({ HTML5Backend: {} }));
vi.mock('@/hooks/useServiceCatalog', () => ({ useServiceCatalog: () => ({ byId: {} }) }));
vi.mock('@/hooks/useServiceOperations', () => ({ useServiceOperations: () => ({ isLoading: false }) }));
vi.mock('@/components/admin/QuickAssignTech', () => ({ default: () => <span data-testid="qa-tech" /> }));

// Helper to open modal with provider
function setup(initialOrder?: string[]) {
  if (initialOrder) {
    localStorage.setItem('adm.cardPrefs.v1.order', JSON.stringify(initialOrder));
  } else {
    localStorage.removeItem('adm.cardPrefs.v1.order');
  }
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <CardPreferencesProvider>
        <CardCustomizationModal open onClose={() => {}} />
      </CardPreferencesProvider>
    </QueryClientProvider>
  );
}

describe('Card field order persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads default order when none stored', async () => {
  vi.useRealTimers();
  setup();
  await screen.findByTestId('card-pref-order-list');
    const items = screen.getAllByRole('listitem');
    expect(items[0].getAttribute('data-field')).toBe('statusBadges');
  });

  it('restores stored order', async () => {
  vi.useRealTimers();
  setup(['customer','vehicle','statusBadges','price']);
  await screen.findByTestId('card-pref-order-list');
    const items = screen.getAllByRole('listitem');
    expect(items[0].getAttribute('data-field')).toBe('customer');
    expect(items[1].getAttribute('data-field')).toBe('vehicle');
  });

  it('persists new order after keyboard move', async () => {
  vi.useRealTimers();
  const utils = userEvent.setup();
  setup();
  await screen.findByTestId('card-pref-order-list');
    let items = screen.getAllByRole('listitem');
    await utils.click(items[1]);
    await utils.keyboard('{ArrowUp}');
    await waitFor(() => {
      items = screen.getAllByRole('listitem');
      expect(items[0].getAttribute('data-field')).toBe('vehicle');
    });
    const stored = JSON.parse(localStorage.getItem('adm.cardPrefs.v1.order') || '[]');
    expect(stored[0]).toBe('vehicle');
  });
});
