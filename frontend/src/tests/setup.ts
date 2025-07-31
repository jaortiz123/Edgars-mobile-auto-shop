import '@testing-library/jest-dom/vitest'
import 'whatwg-fetch'

import { expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { toHaveNoViolations } from 'jest-axe'
import { cleanup } from '@testing-library/react'
import { setupCleanConsole, restoreConsole } from './testEnv'

// Extend expect with accessibility matchers
expect.extend(toHaveNoViolations)

// Auto cleanup after each test
beforeEach(() => {
  cleanup()
})

// Note: Global vi.mock declarations removed to prevent circular dependencies.
// Tests should now use createTestMocks() directly for dependency injection.
// Example: const { api, time, notification } = createTestMocks();

// Mock performance monitoring service
vi.mock('@/services/performanceMonitoring', () => ({
  default: {
    generateReport: vi.fn(() => ({
      overall: { score: 85, grade: 'B', recommendations: [] },
      memory: { pressure: 'low' },
      network: { online: true, rtt: 50 },
      notifications: { sent: 0, failed: 0 }
    })),
    trackComponent: vi.fn(),
    startMeasurement: vi.fn(() => vi.fn()),
  },
  usePerformanceMonitoring: vi.fn(() => ({
    trackUpdate: vi.fn(),
    trackError: vi.fn(),
    measure: vi.fn(() => vi.fn()),
  })),
}));

// Mock offline support service
vi.mock('@/services/offlineSupport', () => ({
  default: {
    getState: vi.fn(() => ({ 
      isOnline: true, 
      queuedActions: [], 
      lastSync: new Date() 
    })),
    addAction: vi.fn(),
    processQueue: vi.fn(),
  },
}));

// Apply browser API mocks globally in beforeAll
beforeAll(() => {
  // Note: Mock factory globals removed to prevent circular dependencies
  // Individual tests should use createTestMocks() for dependency injection
  setupCleanConsole();
});

// Enhanced JSDOM environment setup (fallback for any missing mocks)
if (!global.ResizeObserver) {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// IntersectionObserver fallback
if (!global.IntersectionObserver) {
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
    get root() { return null; }
    get rootMargin() { return '0px'; }
    get thresholds() { return []; }
    takeRecords() { return []; }
  };
}

// Enhanced matchMedia mock for responsive design testing
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: query.includes('max-width: 768px'), // Default mobile breakpoint
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn().mockReturnValue(false)
  } as MediaQueryList);
}

// createRange stub for editors and portals
if (!document.createRange) {
  document.createRange = () => ({
    setStart: () => {},
    setEnd: () => {},
    commonAncestorContainer: document.body,
    createContextualFragment: (html: string) => {
      const template = document.createElement('template');
      template.innerHTML = html;
      return template.content;
    },
  } as Range);
}

// Navigation and scroll mocks
global.scrollTo = () => {};
global.scroll = () => {};

// Performance API mock for monitoring tests
if (!global.performance.mark) {
  global.performance.mark = vi.fn();
}
if (!global.performance.measure) {
  global.performance.measure = vi.fn();
}

// Enhanced console management using test environment utilities
afterAll(() => { 
  restoreConsole();
});
