import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';

/**
 * Centralized userEvent setup that integrates with fake timers.
 * Tests should import { setupUser } and call it once per test (or per describe).
 * This removes the need for manual act() wrappers or explicit vi.advanceTimersByTime calls
 * adjacent to user interactions. Debounced UI logic should be awaited via findBy* queries.
 */
export function setupUserEvent() {
  return userEvent.setup({
    advanceTimers: vi.advanceTimersByTime,
  });
}

// Backwards-compatible name (older refactor in progress)
export const setupUser = setupUserEvent;
