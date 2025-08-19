import '@testing-library/jest-dom/vitest'
import 'whatwg-fetch'

import { expect, vi, beforeAll, beforeEach } from 'vitest'
import { toHaveNoViolations } from 'jest-axe'
import { cleanup } from '@testing-library/react'

// CI-STRICT-001: Fail tests on console.error/warn with allowlist support (STABILIZED)

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
  /MOCK FACTORY:/
];

/**
 * Helper function to check if a console message should be allowed
 */
function isAllowedConsoleMessage(message: string): boolean {
  return allowedConsoleErrors.some(pattern => pattern.test(message));
}

/**
 * Enhanced console spy that tracks calls without throwing for allowed patterns
 */
interface ConsoleSpyState {
  errorSpy: ReturnType<typeof vi.spyOn>;
  warnSpy: ReturnType<typeof vi.spyOn>;
  originalError: typeof console.error;
  originalWarn: typeof console.warn;
}

let globalConsoleSpy: ConsoleSpyState | null = null;

/**
 * Helper function to safely convert arguments to string for pattern matching
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
 * Setup strict console monitoring with allowlist support
 */
function setupStrictConsole(): void {
  const originalError = console.error;
  const originalWarn = console.warn;

  // Create spies that track calls but allow them through to original console
  const errorSpy = vi.spyOn(console, 'error');
  const warnSpy = vi.spyOn(console, 'warn');

  // Override console.error with strict checking
  console.error = (...args: unknown[]) => {
    try {
      const message = safeArgsToString(args);

      // If this is an allowed pattern, log it normally and continue
      if (isAllowedConsoleMessage(message)) {
        originalError(...args);
        return;
      }

      // For disallowed patterns, throw an error to fail the test
      const error = new Error(`console.error: [CI-STRICT-001] Unexpected error: ${message}`);
      if (Error.captureStackTrace) {
        Error.captureStackTrace(error, console.error);
      }
      throw error;
    } catch (processingError) {
      // Graceful degradation
      const errorMessage = processingError instanceof Error ? processingError.message : 'Unknown error';
      throw new Error(`console.error: [CI-STRICT-001 Processing Error: ${errorMessage}]`);
    }
  };

  // Override console.warn with strict checking
  console.warn = (...args: unknown[]) => {
    try {
      const message = safeArgsToString(args);

      // If this is an allowed pattern, log it normally and continue
      if (isAllowedConsoleMessage(message)) {
        originalWarn(...args);
        return;
      }

      // For disallowed patterns, throw an error to fail the test
      const error = new Error(`console.warn: [CI-STRICT-001] Unexpected warning: ${message}`);
      if (Error.captureStackTrace) {
        Error.captureStackTrace(error, console.warn);
      }
      throw error;
    } catch (processingError) {
      // Graceful degradation
      const errorMessage = processingError instanceof Error ? processingError.message : 'Unknown error';
      throw new Error(`console.warn: [CI-STRICT-001 Processing Error: ${errorMessage}]`);
    }
  };

  globalConsoleSpy = {
    errorSpy,
    warnSpy,
    originalError,
    originalWarn
  };
}

/**
 * Test helper for tests that expect console errors
 * Usage: await withConsoleErrorSpy(async () => { ... test code that should log errors ... });
 */
export async function withConsoleErrorSpy<T>(testFn: () => T | Promise<T>): Promise<T> {
  if (!globalConsoleSpy) {
    throw new Error('Console spy not initialized. Make sure setupStrictConsole() was called.');
  }

  const { originalError, originalWarn } = globalConsoleSpy;

  // Temporarily replace console methods with non-throwing versions
  const tempErrorSpy = vi.fn(originalError);
  const tempWarnSpy = vi.fn(originalWarn);

  console.error = tempErrorSpy;
  console.warn = tempWarnSpy;

  try {
    const result = await Promise.resolve(testFn());
    return result;
  } finally {
    // Restore strict console monitoring
    setupStrictConsole();
  }
}

/**
 * Get console spy state for assertions in tests
 */
export function getConsoleSpies() {
  if (!globalConsoleSpy) {
    throw new Error('Console spy not initialized. Make sure setupStrictConsole() was called.');
  }
  return {
    errorSpy: globalConsoleSpy.errorSpy,
    warnSpy: globalConsoleSpy.warnSpy
  };
}

/**
 * Timer control utilities for stable async testing
 */

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
 * Advanced timer utility that runs pending timers and flushes promises
 * Usage: await advanceAllTimers(); // Run all pending timers and wait for effects
 */
export async function advanceAllTimers(): Promise<void> {
  // Run all pending timers
  vi.runOnlyPendingTimers();

  // Flush any promises that were scheduled by the timers
  await flushPromises();

  // Run any additional timers that might have been scheduled
  vi.runOnlyPendingTimers();

  // Final flush for good measure
  await flushPromises();
}

/**
 * Advanced timer utility for progressing time by a specific amount
 * Usage: await advanceTimersByTime(1000); // Advance by 1 second
 */
export async function advanceTimersByTime(ms: number): Promise<void> {
  vi.advanceTimersByTime(ms);
  await flushPromises();
}

/**
 * Helper to run test code with fake timers and proper cleanup
 * Usage: await withFakeTimers(async () => { ... test code ... });
 */
export async function withFakeTimers<T>(testFn: () => T | Promise<T>): Promise<T> {
  vi.useFakeTimers();
  try {
    const result = await Promise.resolve(testFn());
    // Ensure all timers are cleared before restoring
    vi.clearAllTimers();
    return result;
  } finally {
    vi.useRealTimers();
  }
}

// Extend expect with accessibility matchers
expect.extend(toHaveNoViolations)

/**
 * Initialize strict console monitoring
 */
beforeAll(() => {
  setupStrictConsole();

  // Store references for backward compatibility
  const globals = globalThis as typeof globalThis & {
    __originalConsole?: {
      error: typeof console.error;
      warn: typeof console.warn;
    };
  };

  if (globalConsoleSpy) {
    globals.__originalConsole = {
      error: globalConsoleSpy.originalError,
      warn: globalConsoleSpy.originalWarn
    };
  }
});

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

  // 2. Verify no unexpected console errors occurred (unless explicitly allowed)
  if (globalConsoleSpy) {
    const { errorSpy, warnSpy } = globalConsoleSpy;

    // Check for any console.error calls that weren't handled
    const errorCalls = errorSpy.mock.calls;
    const warnCalls = warnSpy.mock.calls;

    // Filter out allowed messages from the calls
    const unexpectedErrors = errorCalls.filter(call => {
      const message = safeArgsToString(call);
      return !isAllowedConsoleMessage(message);
    });

    const unexpectedWarnings = warnCalls.filter(call => {
      const message = safeArgsToString(call);
      return !isAllowedConsoleMessage(message);
    });

    // Clear spy call history for next test
    errorSpy.mockClear();
    warnSpy.mockClear();

    // Fail if unexpected console messages were found
    if (unexpectedErrors.length > 0) {
      const messages = unexpectedErrors.map(call => safeArgsToString(call)).join('\n  - ');
      throw new Error(`[SAFETY-NET-002] Unexpected console.error calls detected:\n  - ${messages}\n\nUse withConsoleErrorSpy() for tests that expect errors, or add patterns to allowedConsoleErrors.`);
    }

    if (unexpectedWarnings.length > 0) {
      const messages = unexpectedWarnings.map(call => safeArgsToString(call)).join('\n  - ');
      throw new Error(`[SAFETY-NET-002] Unexpected console.warn calls detected:\n  - ${messages}\n\nUse withConsoleErrorSpy() for tests that expect warnings, or add patterns to allowedConsoleErrors.`);
    }
  }

  // 3. Ensure all mocks are properly reset (redundant safety check)
  vi.clearAllMocks();
});
