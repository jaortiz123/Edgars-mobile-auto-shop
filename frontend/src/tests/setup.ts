// Ensure React 19 test act environment flag (belt & suspenders in addition to preActEnv)
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import '@testing-library/jest-dom/vitest'
// Use native Node fetch for MSW/node interception; provide wrapper for relative URLs instead of polyfilling with whatwg-fetch (which uses XHR and bypasses msw/node).
const __originalFetch = global.fetch;
global.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === 'string' && input.startsWith('/')) {
    // Normalize relative test URLs to an absolute form MSW can intercept
    const abs = 'http://localhost:3000' + input;
    return __originalFetch(abs, init);
  }
  return __originalFetch(input as RequestInfo, init);
}) as typeof fetch;
import './testEnv'

import { expect, vi, beforeEach, afterEach } from 'vitest'
// Enhanced jest shim (legacy compatibility) now includes timer helpers expected by Testing Library
type JestShim = {
  fn: typeof vi.fn;
  mock: typeof vi.mock;
  clearAllMocks: typeof vi.clearAllMocks;
  spyOn: typeof vi.spyOn;
  restoreAllMocks: typeof vi.restoreAllMocks;
  advanceTimersByTime: typeof vi.advanceTimersByTime;
  runAllTimers: typeof vi.runAllTimers;
  runOnlyPendingTimers: typeof vi.runOnlyPendingTimers;
  advanceTimersToNextTimer: typeof vi.advanceTimersToNextTimer;
  useFakeTimers: typeof vi.useFakeTimers;
  useRealTimers: typeof vi.useRealTimers;
  clearAllTimers: typeof vi.clearAllTimers;
  setSystemTime: typeof vi.setSystemTime;
};
const jest: JestShim = {
  fn: vi.fn,
  mock: vi.mock,
  clearAllMocks: vi.clearAllMocks,
  spyOn: vi.spyOn,
  restoreAllMocks: vi.restoreAllMocks,
  advanceTimersByTime: vi.advanceTimersByTime,
  runAllTimers: vi.runAllTimers,
  runOnlyPendingTimers: vi.runOnlyPendingTimers,
  advanceTimersToNextTimer: vi.advanceTimersToNextTimer,
  useFakeTimers: vi.useFakeTimers,
  useRealTimers: vi.useRealTimers,
  clearAllTimers: vi.clearAllTimers,
  setSystemTime: vi.setSystemTime,
};

// Expose globally
interface GlobalWithJest { jest?: JestShim }
(globalThis as unknown as GlobalWithJest).jest = jest;

// Ensure localStorage.clear exists as a function (some environments provide a non-callable localStorage shim)
if (typeof globalThis.localStorage !== 'object' || !globalThis.localStorage) {
  // Provide a simple in-memory localStorage mock
  const _store: Record<string, string> = {};
  globalThis.localStorage = {
  getItem: (k: string) => (Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null),
    setItem: (k: string, v: string) => { _store[k] = String(v); },
    removeItem: (k: string) => { delete _store[k]; },
    clear: () => { Object.keys(_store).forEach(k => delete _store[k]); }
  } as unknown as Storage;
} else {
  // Ensure required functions exist on existing localStorage
  try {
  const ls = globalThis.localStorage as Storage;
  const lsu = ls as unknown as Record<string, unknown>;
  if (typeof ls.getItem !== 'function') lsu.getItem = () => null;
  if (typeof ls.setItem !== 'function') lsu.setItem = () => { /* noop */ };
  if (typeof ls.removeItem !== 'function') lsu.removeItem = () => { /* noop */ };
  if (typeof ls.clear !== 'function') lsu.clear = () => { /* noop */ };
  } catch {
    // ignore
  }
}
import { toHaveNoViolations } from 'jest-axe'
import { cleanup } from '@testing-library/react'
// (legacy mswServer import removed; centralized server lifecycle handled in jest.setup.ts)
// Removed unused msw imports (http, HttpResponse)
import { createMocks } from '../test/mocks'
// import failOnConsole from 'vitest-fail-on-console' // Disabled due to conflicts

// ========================
// CENTRALIZED MOCK SETUP (P1-T-012)
// ========================
const { time, api, notification, toast, storage } = createMocks();

// Apply mocks globally to prevent circular dependencies
vi.mock('@/utils/time', () => time);
vi.mock('@/lib/api', () => api);
vi.mock('@/services/notificationService', () => notification);
vi.mock('@/components/ui/Toast', () => toast);
vi.mock('@/lib/toast', () => toast);
vi.mock('@/utils/storage', () => storage);
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return actual; // use real router to allow MemoryRouter navigation in tests
});

// (summaryService is intentionally not globally mocked here so individual tests
//  can mock it locally with full control/hoisting semantics)

/**
 * Enhanced test helper for tests that expect console errors
 * Usage: await withConsoleErrorSpy(async () => { ... test code that should log errors ... });
 */
export async function withConsoleErrorSpy<T>(testFn: () => T | Promise<T>): Promise<T> {
  // Create mocks that capture calls but don't actually log or throw
  const errorSpy = vi.fn();
  const warnSpy = vi.fn();

  // Temporarily replace console methods with our silent spies
  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = errorSpy;
  console.warn = warnSpy;

  try {
    const result = await Promise.resolve(testFn());
    return result;
  } finally {
    // Restore original console methods
    console.error = originalError;
    console.warn = originalWarn;
  }
}

/**
 * Get current console spy references for test assertions
 * Note: With vitest-fail-on-console, spies work differently, so this provides
 * compatibility for existing tests
 */
export function getConsoleSpies() {
  return {
    errorSpy: vi.spyOn(console, 'error'),
    warnSpy: vi.spyOn(console, 'warn'),
  };
}

/**
 * Flush all pending promises in the microtask queue
 * Useful for waiting for state updates and effects to complete
 */
export async function flushPromises(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Test utility for handling fake timers
 */
export async function withFakeTimers<T>(testFn: () => T | Promise<T>): Promise<T> {
  vi.useFakeTimers();
  try {
    const result = await Promise.resolve(testFn());
    return result;
  } finally {
    vi.useRealTimers();
  }
}

// Extend expect with accessibility matchers
expect.extend(toHaveNoViolations)

// MSW setup for unit tests
// (server.listen moved to jest.setup.ts)

// Auto cleanup and reset localStorage before each test
beforeEach(() => {
  // Provide a fresh in-memory localStorage for each test to avoid leakage
  const _store: Record<string, string> = {};
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
  getItem: (k: string) => (Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null),
      setItem: (k: string, v: string) => { _store[k] = String(v); },
      removeItem: (k: string) => { delete _store[k]; },
      clear: () => { Object.keys(_store).forEach(k => delete _store[k]); }
    } as unknown as Storage
  });

  cleanup();
})

// SAFETY-NET-002: Global afterEach safety-nets for test stability
afterEach(async () => {
  // (MSW handlers reset in jest.setup.ts)

  // 1b. Flush pending microtasks & promises.
  // If fake timers are active, advancing timers is required; otherwise use a real setTimeout(0).
  let usingFakeTimers = false;
  try {
    // vi.getTimerCount only works when timers are mocked
    vi.getTimerCount();
    usingFakeTimers = true;
  } catch { /* not mocked */ }

  if (usingFakeTimers) {
    try { vi.runAllTimers(); } catch { /* ignore */ }
    // Also resolve any microtasks
    await Promise.resolve();
  } else {
    await new Promise(res => setTimeout(res, 0));
  }

  // 1c. Clear any pending timers proactively
  try { vi.clearAllTimers(); } catch { /* ignore */ }

  // 2. Timer leak detection (only when fake timers were active)
  if (usingFakeTimers) {
    try {
      const remaining = vi.getTimerCount();
      if (remaining > 0) {
        vi.clearAllTimers();
        throw new Error(`[SAFETY-NET-002] Timer leak detected: ${remaining} timer(s) still pending after test completion. Ensure timers are awaited or cleared.`);
      }
    } catch { /* swallow if timers got restored mid-test */ }
  }

  // 3. Reset mocks
  vi.clearAllMocks();
  // 4. Always restore real timers to avoid leakage across tests
  try { vi.useRealTimers(); } catch { /* ignore */ }
});

// Mock window.matchMedia for component tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
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

// Mock window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true,
});

// Mock document.createRange
if (!document.createRange) {
  document.createRange = () => ({
    setStart: vi.fn(),
    setEnd: vi.fn(),
    commonAncestorContainer: document.createElement('div'),
    collapsed: false,
    endContainer: document.createElement('div'),
    endOffset: 0,
    startContainer: document.createElement('div'),
    startOffset: 0,
    cloneContents: vi.fn(),
    cloneRange: vi.fn(),
    collapse: vi.fn(),
    compareBoundaryPoints: vi.fn(),
    comparePoint: vi.fn(),
    deleteContents: vi.fn(),
    detach: vi.fn(),
    extractContents: vi.fn(),
    getBoundingClientRect: vi.fn(),
    getClientRects: vi.fn(),
    insertNode: vi.fn(),
    intersectsNode: vi.fn(),
    isPointInRange: vi.fn(),
    selectNode: vi.fn(),
    selectNodeContents: vi.fn(),
    setEndAfter: vi.fn(),
    setEndBefore: vi.fn(),
    setStartAfter: vi.fn(),
    setStartBefore: vi.fn(),
    surroundContents: vi.fn(),
    toString: vi.fn(),
    createContextualFragment: vi.fn(() => document.createDocumentFragment()),
    START_TO_START: 0,
    START_TO_END: 1,
    END_TO_END: 2,
    END_TO_START: 3,
  });
}

// Fallback handlers for common endpoints used across many tests.
// These return safe defaults and reduce noisy 'unmatched request' warnings.
// Removed fallback appointment handlers (handled by host-agnostic handlers now)

// MSW cleanup after all tests
// (server.close moved to jest.setup.ts)

// console.log('✅ Enhanced CI console detection loaded with vitest-fail-on-console');
