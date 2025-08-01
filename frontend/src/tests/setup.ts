import '@testing-library/jest-dom/vitest'
import 'whatwg-fetch'

import { expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { toHaveNoViolations } from 'jest-axe'
import { cleanup } from '@testing-library/react'
import { restoreConsole } from './testEnv'

// CI-STRICT-001: Fail tests on console.error/warn (ROBUSTNESS ENHANCED)
beforeAll(() => {
  const origError = console.error;
  const origWarn = console.warn;
  
  /**
   * Create a robust console override that handles edge cases safely
   */
  const createSafeConsoleOverride = (level: 'error' | 'warn') => {
    return (...args: unknown[]) => {
      try {
        // Track seen objects for circular reference detection
        const seen = new WeakSet<object>();
        
        // Safe argument processing with comprehensive error handling
        const safeArgs = args.map((arg) => {
          if (arg === null) return 'null';
          if (arg === undefined) return 'undefined';
          if (typeof arg === 'string') return arg;
          if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
          
          // Handle objects and complex types safely
          if (typeof arg === 'object' && arg !== null) {
            try {
              // Try JSON.stringify first (handles most objects)
              return JSON.stringify(arg, (key, value) => {
                // Handle circular references
                if (typeof value === 'object' && value !== null) {
                  if (seen.has(value)) return '[Circular Reference]';
                  seen.add(value);
                }
                return value;
              }, 2);
            } catch {
              try {
                // Fallback to toString if JSON fails
                return String(arg);
              } catch {
                // Last resort: describe the object safely
                return `[Object of type ${Object.prototype.toString.call(arg)} - toString failed]`;
              }
            }
          }
          
          // Handle functions and other types
          try {
            return String(arg);
          } catch {
            return `[${typeof arg} - conversion failed]`;
          }
        });
        
        // Create error with enhanced context
        const message = safeArgs.join(' ');
        const error = new Error(`console.${level}: ${message}`);
        
        // Preserve stack trace for better debugging
        if (Error.captureStackTrace) {
          Error.captureStackTrace(error, createSafeConsoleOverride);
        }
        
        throw error;
      } catch (processingError) {
        // Graceful degradation: if our processing fails, still fail the test
        const errorMessage = processingError instanceof Error ? processingError.message : 'Unknown error';
        throw new Error(`console.${level}: [CI-STRICT-001 Error: ${errorMessage}] - Original console call failed processing`);
      }
    };
  };
  
  // Apply robust console overrides
  console.error = createSafeConsoleOverride('error');
  console.warn = createSafeConsoleOverride('warn');
  
  // Store originals for potential restoration if needed (backward compatibility)
  const globals = globalThis as typeof globalThis & {
    __originalConsole?: {
      error: typeof console.error;
      warn: typeof console.warn;
    };
  };
  
  globals.__originalConsole = {
    error: origError,
    warn: origWarn
  };
});

// Extend expect with accessibility matchers
expect.extend(toHaveNoViolations)

// Auto cleanup after each test
beforeEach(() => {
  cleanup()
})

// MOCK-FACTORY-001: Complete MockFactory API implementation
import { createMocks } from './mocks';
const { time, notification, api } = createMocks();

// Apply centralized mocks to avoid circular dependencies
vi.mock('@/utils/time', () => time);
vi.mock('@/services/notificationService', () => notification);
vi.mock('@/lib/api', () => api);

// Note: Global vi.mock declarations replaced with centralized mock factory.
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
  // setupCleanConsole(); // Commented out because CI-STRICT-001 overrides console methods
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
