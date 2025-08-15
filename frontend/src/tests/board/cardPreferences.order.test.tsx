import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardPreferencesProvider } from '@/contexts/CardPreferencesContext';
import CardCustomizationModal from '@/components/admin/CardCustomizationModal';

// Helper to open modal with provider
function setup(initialOrder?: string[]) {
  if (initialOrder) {
    localStorage.setItem('adm.cardPrefs.v1.order', JSON.stringify(initialOrder));
  } else {
    localStorage.removeItem('adm.cardPrefs.v1.order');
  }
  return render(
    <CardPreferencesProvider>
      <CardCustomizationModal open onClose={() => {}} />
    </CardPreferencesProvider>
  );
}

describe('Card field order persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads default order when none stored', () => {
    setup();
    const items = screen.getAllByRole('listitem');
    // First item should be Status Badges by default
    expect(items[0].getAttribute('data-field')).toBe('statusBadges');
  });

  it('restores stored order', () => {
    setup(['customer','vehicle','statusBadges','price']);
    const items = screen.getAllByRole('listitem');
    expect(items[0].getAttribute('data-field')).toBe('customer');
    expect(items[1].getAttribute('data-field')).toBe('vehicle');
  });

  it('persists new order after keyboard move', async () => {
    setup();
  const utils = userEvent.setup();
    const items = screen.getAllByRole('listitem');
    // Focus second item and move it up (vehicle -> should become first)
  await utils.click(items[1]);
  await utils.keyboard('{ArrowUp}');
    // After move, new first item should have data-field=vehicle
    const newItems = screen.getAllByRole('listitem');
    expect(newItems[0].getAttribute('data-field')).toBe('vehicle');
    // Verify persisted in localStorage
    const stored = JSON.parse(localStorage.getItem('adm.cardPrefs.v1.order') || '[]');
    expect(stored[0]).toBe('vehicle');
  });
});
