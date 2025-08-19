import '@testing-library/jest-dom/vitest'
import 'whatwg-fetch'

import { expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { toHaveNoViolations } from 'jest-axe'
import { cleanup } from '@testing-library/react'
import failOnConsole from 'vitest-fail-on-console'

// Enhanced CI Console Detection using vitest-fail-on-console + Custom Helpers

/**
 * Allowed console error patterns that should not fail tests
 * These are expected errors during negative path testing or legitimate application errors
 */
const allowedConsoleErrors: RegExp[] = [
  // AppointmentContext errors during test scenarios
  /AppointmentContext: Error in refreshBoard/,
  /Failed to send message/,

  // React act() warnings (handled separately but listed for awareness)
  /Warning: An update to .* inside a test was not wrapped in act/,

  // Network/API errors in test scenarios
  /Network request failed/,
  /API error:/,
  /Failed to fetch/,

  // Authentication errors during negative testing
  /Authentication failed/,
  /Unauthorized access/,

  // Form validation errors (expected in negative tests)
  /Validation error:/,
  /Invalid form data/,

  // Mock-related debug messages that shouldn't fail tests
  /🔧 DIRECT MOCK:/,
  /MOCK FACTORY:/,

  // MSW-related warnings that are expected
  /Found a redundant usage of query/,
  /\[MSW\]/,

  // React Testing Library warnings that are acceptable
  /Consider adding the "hidden" attribute/,
  /Unable to find an element with the text/,
];

/**
 * Helper function to safely convert arguments to string for pattern matching
 * Preserves the sophisticated serialization from our original implementation
 */
function safeArgsToString(args: unknown[]): string {
  const seen = new WeakSet<object>();

  const safeArgs = args.map((arg) => {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (typeof arg === 'string') return arg;
    if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);

    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg, (key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) return '[Circular Reference]';
            seen.add(value);
          }
          return value;
        }, 2);
      } catch {
        try {
          return String(arg);
        } catch {
          return `[Object of type ${Object.prototype.toString.call(arg)}]`;
        }
      }
    }

    try {
      return String(arg);
    } catch {
      return `[${typeof arg}]`;
    }
  });

  return safeArgs.join(' ');
}

/**
 * Helper function to check if a console message should be allowed
 */
function isAllowedConsoleMessage(message: string): boolean {
  return allowedConsoleErrors.some(pattern => pattern.test(message));
}

// Configure vitest-fail-on-console with our sophisticated allowlist
failOnConsole({
  shouldFailOnError: true,
  shouldFailOnWarn: true,
  shouldFailOnAssert: false,
  shouldFailOnDebug: false,
  shouldFailOnInfo: false,
  shouldFailOnLog: false,

  // Use our sophisticated allowlist system
  allowMessage: (message, methodName) => {
    // Convert the message to our expected format for pattern matching
    const fullMessage = message;
    return isAllowedConsoleMessage(fullMessage);
  },

  // Enhanced error message to maintain CI-STRICT-001 branding
  errorMessage: (methodName, bold) => {
    return `${bold('[CI-STRICT-001]')} Unexpected console.${methodName} call detected. Use withConsoleErrorSpy() for tests that expect ${methodName} calls, or add patterns to allowedConsoleErrors.`;
  },

  // Skip console checking for integration tests that have different setup
  skipTest: ({ testPath }) => {
    // Skip for integration tests that use MSW setup
    if (testPath.includes('.it.tsx') || testPath.includes('.it.ts')) {
      return true;
    }

    // Skip for specific legacy test files
    if (testPath.includes('.old.tsx') || testPath.includes('.legacy.')) {
      return true;
    }

    return false;
  },

  // Add delay in non-CI environments for debugging
  afterEachDelay: process.env.CI ? 0 : 100,
});

/**
 * Enhanced test helper for tests that expect console errors
 * Now works with vitest-fail-on-console by temporarily mocking console methods
 * Usage: await withConsoleErrorSpy(async () => { ... test code that should log errors ... });
 */
export async function withConsoleErrorSpy<T>(testFn: () => T | Promise<T>): Promise<T> {
  // Store original console methods
  const originalError = console.error;
  const originalWarn = console.warn;

  // Create spies that don't throw
  const errorSpy = vi.fn((...args) => {
    // Only log to actual console in development for debugging
    if (!process.env.CI) {
      originalError(...args);
    }
  });
  const warnSpy = vi.fn((...args) => {
    if (!process.env.CI) {
      originalWarn(...args);
    }
  });

  // Temporarily replace console methods with non-throwing versions
  console.error = errorSpy;
  console.warn = warnSpy;

  try {
    const result = await Promise.resolve(testFn());
    return result;
  } finally {
    // Restore original console methods (vitest-fail-on-console will re-override them)
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

// Auto cleanup after each test
beforeEach(() => {
  cleanup()
})

// SAFETY-NET-002: Global afterEach safety-nets for test stability
afterEach(() => {
  // 1. Check for timer leaks - fail if timers are still pending (only when fake timers are active)
  try {
    const timerCount = vi.getTimerCount();
    if (timerCount > 0) {
      // Clear any pending timers before failing to prevent cascade failures
      vi.clearAllTimers();
      throw new Error(`[SAFETY-NET-002] Timer leak detected: ${timerCount} timer(s) still pending after test completion. Use vi.useRealTimers() or vi.clearAllTimers() in your test cleanup.`);
    }
  } catch (error) {
    // If timers are not mocked, vi.getTimerCount() will throw - this is fine, skip timer check
    if (error instanceof Error && error.message.includes('Timers are not mocked')) {
      // This is expected when fake timers aren't active - skip timer leak check
    } else {
      // Re-throw other errors
      throw error;
    }
  }

  // 2. Ensure all mocks are properly reset (redundant safety check)
  vi.clearAllMocks();
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
  });
}

console.log('✅ Enhanced CI console detection loaded with vitest-fail-on-console');
