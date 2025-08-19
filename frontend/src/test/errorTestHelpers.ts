/**
 * P2-T-006: Error Test Helpers - "Third Way" Solution
 *
 * Provides robust error scenario testing utilities with guaranteed cleanup
 * and timeout safety to prevent hanging tests.
 */

import { act } from '@testing-library/react';
import { vi } from 'vitest';
import { enableErrorScenario, disableErrorScenario, resetErrorScenarios } from './server/mswServer';
import type { ErrorScenarioConfig } from './server/mswServer';

/**
 * Configuration for error scenario tests
 */
interface ErrorTestConfig {
  /** Timeout in milliseconds for the test operation (default: 10000ms) */
  timeout?: number;
  /** Additional cleanup function to run */
  cleanup?: () => void | Promise<void>;
  /** Whether to reset all error scenarios after test (default: true) */
  resetAfterTest?: boolean;
}

/**
 * Robust error scenario wrapper with guaranteed cleanup and timeout protection.
 *
 * This function ensures:
 * - Error scenarios are properly enabled before test execution
 * - All scenarios are cleaned up after test, even if test throws
 * - Tests don't hang due to network timeouts or infinite promises
 * - Proper act() wrapping for React state updates
 *
 * @param scenario - The error scenario to enable during test
 * @param testFn - The test function to execute
 * @param config - Additional configuration options
 * @returns Promise that resolves when test completes
 *
 * @example
 * ```tsx
 * await withErrorScenario('appointmentPatch500', async () => {
 *   render(<AppointmentEditor />);
 *   await user.click(screen.getByRole('button', { name: /save/i }));
 *   expect(screen.getByText(/error updating appointment/i)).toBeInTheDocument();
 * });
 * ```
 */
export async function withErrorScenario<T>(
  scenario: keyof ErrorScenarioConfig,
  testFn: () => Promise<T> | T,
  config: ErrorTestConfig = {}
): Promise<T> {
  const {
    timeout = 10000,
    cleanup,
    resetAfterTest = true
  } = config;

  // Timer conflict resolution: Store current timer state to restore it later
  const wasUsingFakeTimers = vi.isFakeTimers && vi.isFakeTimers();
  let timeoutId: NodeJS.Timeout | null = null;

  // Create timeout promise that rejects after specified time
  const timeoutPromise = new Promise<never>((_, reject) => {
    // Temporarily switch to real timers for the timeout guard
    // This prevents conflicts with Vitest's fake timer system
    if (wasUsingFakeTimers) {
      vi.useRealTimers();
    }

    timeoutId = setTimeout(() => {
      reject(new Error(`Test timed out after ${timeout}ms. This may indicate a hanging promise or infinite wait.`));
    }, timeout);

    // Restore fake timers for test execution if they were being used
    if (wasUsingFakeTimers) {
      vi.useFakeTimers();
    }
  });

  try {
    // Enable the error scenario
    enableErrorScenario(scenario);
    console.log(`🚨 Error Test: Enabled scenario '${scenario}'`);

    // Execute test function with timeout protection
    const testPromise = Promise.resolve(testFn());
    const result = await Promise.race([testPromise, timeoutPromise]);

    return result;
  } finally {
    // Clean up timeout using real timers if needed
    if (timeoutId) {
      if (wasUsingFakeTimers) {
        vi.useRealTimers();
      }
      clearTimeout(timeoutId);

      // Restore original timer state
      if (wasUsingFakeTimers) {
        vi.useFakeTimers();
      }
    }

    // Guaranteed cleanup - runs even if test throws or times out
    try {
      // Disable the specific scenario
      disableErrorScenario(scenario);

      // Reset all scenarios if requested
      if (resetAfterTest) {
        resetErrorScenarios();
      }

      // Run custom cleanup if provided
      if (cleanup) {
        await cleanup();
      }

      console.log(`✅ Error Test: Cleaned up scenario '${scenario}'`);
    } catch (cleanupError) {
      console.error(`❌ Error Test: Cleanup failed for scenario '${scenario}':`, cleanupError);
      // Don't throw cleanup errors to avoid masking original test failures
    }
  }
}

/**
 * Wrapper for testing multiple error scenarios in sequence.
 * Ensures each scenario is properly isolated from others.
 *
 * @param scenarios - Array of scenario configurations to test
 * @param testFn - Function that receives the current scenario and runs the test
 * @param config - Configuration applied to all scenarios
 */
export async function withErrorScenarios<T>(
  scenarios: Array<keyof ErrorScenarioConfig>,
  testFn: (scenario: keyof ErrorScenarioConfig) => Promise<T> | T,
  config: ErrorTestConfig = {}
): Promise<T[]> {
  const results: T[] = [];

  for (const scenario of scenarios) {
    const result = await withErrorScenario(scenario, () => testFn(scenario), config);
    results.push(result);
  }

  return results;
}

/**
 * Helper to wrap test operations in act() for React state updates.
 * Combines with error scenario testing for comprehensive coverage.
 *
 * @param operation - The operation to wrap in act()
 * @returns Promise that resolves with the operation result
 */
export async function actAsync<T>(operation: () => Promise<T> | T): Promise<T> {
  let result: T;

  await act(async () => {
    result = await Promise.resolve(operation());
  });

  return result!;
}

/**
 * Combined error scenario and act() wrapper for React testing.
 * Provides the most common pattern for error integration tests.
 *
 * @param scenario - The error scenario to enable
 * @param operation - The React operation to perform
 * @param config - Additional configuration
 */
export async function withErrorScenarioAct<T>(
  scenario: keyof ErrorScenarioConfig,
  operation: () => Promise<T> | T,
  config: ErrorTestConfig = {}
): Promise<T> {
  return withErrorScenario(scenario, () => actAsync(operation), config);
}

/**
 * Utility to create a scoped error scenario function.
 * Returns a function that automatically applies the specified scenario.
 *
 * @param scenario - The scenario to scope to
 * @param config - Default configuration for this scenario
 * @returns Function that runs tests with the scoped scenario
 */
export function createScopedErrorTest<T>(
  scenario: keyof ErrorScenarioConfig,
  config: ErrorTestConfig = {}
) {
  return (testFn: () => Promise<T> | T, testConfig?: ErrorTestConfig): Promise<T> => {
    return withErrorScenario(scenario, testFn, { ...config, ...testConfig });
  };
}

/**
 * Type-safe error scenario configuration export for test files
 */
export type { ErrorScenarioConfig } from './server/mswServer';
