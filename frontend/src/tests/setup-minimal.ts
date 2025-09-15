/**
 * Minimal Test Setup - For Diagnosing Silent Hang Issue
 *
 * This is a stripped-down version of setup.ts to help isolate the source
 * of the silent hang. We've removed complex plugins and global mocks.
 */

import '@testing-library/jest-dom/vitest'
import 'whatwg-fetch'

import { expect, vi, beforeEach, afterEach } from 'vitest'
import { toHaveNoViolations } from 'jest-axe'
import { cleanup } from '@test-utils'

// Extend expect with accessibility matchers
expect.extend(toHaveNoViolations)

// Auto cleanup after each test
beforeEach(() => {
  cleanup()
})

// Minimal afterEach cleanup
afterEach(() => {
  // Clear all mocks to prevent state leakage
  vi.clearAllMocks();

  // Clear any remaining timers if fake timers are active
  try {
    const timerCount = vi.getTimerCount();
    if (timerCount > 0) {
      vi.clearAllTimers();
    }
  } catch {
    // If timers are not mocked, this will throw - that's fine
  }
});

// Essential browser API mocks only
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

console.log('✅ Minimal test setup loaded - no complex plugins');
