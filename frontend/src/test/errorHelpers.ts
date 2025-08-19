/**
 * P2-T-006: Canonical Error Test Helpers
 *
 * Provides clean, deterministic error scenario testing using MSW server.use()
 * pattern to avoid global state issues and ensure proper test isolation.
 */

import { http, HttpResponse } from 'msw';
import { act } from '@testing-library/react';
import { server } from './server/mswServer';

/**
 * Available error scenarios for testing
 */
export type ErrorScenario =
  | 'appointmentPatch500'
  | 'unauthorizedAccess'
  | 'networkTimeout'
  | 'dashboardStats500'
  | 'appointmentBoard500';

/**
 * Configuration for error scenario tests
 */
interface ErrorTestConfig {
  /** Timeout in milliseconds for the test operation (default: 8000ms) */
  timeout?: number;
  /** Additional cleanup function to run */
  cleanup?: () => void | Promise<void>;
}

/**
 * Canonical error scenario wrapper using MSW server.use() pattern.
 *
 * This function ensures:
 * - Error scenarios are enabled only for the duration of the test
 * - Proper cleanup using server.resetHandlers() in finally block
 * - No global state that can cause test interference
 * - Timeout protection to prevent hanging tests
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
 *   expect(await screen.findByText(/error updating appointment/i)).toBeInTheDocument();
 * });
 * ```
 */
export async function withErrorScenario<T>(
  scenario: ErrorScenario,
  testFn: () => Promise<T> | T,
  config: ErrorTestConfig = {}
): Promise<T> {
  const { timeout = 8000, cleanup } = config;

  // Create timeout promise that rejects after specified time
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Test timed out after ${timeout}ms. This usually indicates a hanging promise or infinite wait.`));
    }, timeout);
  });

  try {
    // Enable the error scenario using server.use()
    const errorHandler = createErrorHandler(scenario);
    server.use(errorHandler);
    console.log(`🚨 Error Test: Enabled scenario '${scenario}'`);

    // Execute test function with timeout protection
    const testPromise = Promise.resolve(testFn());
    const result = await Promise.race([testPromise, timeoutPromise]);

    return result;
  } finally {
    // Clear timeout
    clearTimeout(timeoutId!);

    // Guaranteed cleanup - runs even if test throws or times out
    try {
      // Reset MSW handlers to remove error scenario
      server.resetHandlers();

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
 */
export async function withErrorScenarios<T>(
  scenarios: ErrorScenario[],
  testFn: (scenario: ErrorScenario) => Promise<T> | T,
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
 * Combined error scenario and act() wrapper for React testing.
 * Provides the most common pattern for error integration tests.
 */
export async function withErrorScenarioAct<T>(
  scenario: ErrorScenario,
  operation: () => Promise<T> | T,
  config: ErrorTestConfig = {}
): Promise<T> {
  return withErrorScenario(scenario, async () => {
    let result: T;
    await act(async () => {
      result = await Promise.resolve(operation());
    });
    return result!;
  }, config);
}

/**
 * Create MSW error handlers for different scenarios
 */
function createErrorHandler(scenario: ErrorScenario) {
  switch (scenario) {
    case 'appointmentPatch500':
      return http.patch('*/appointments/:id', () => {
        console.log('🚨 MSW: appointmentPatch500 - returning 500 error');
        return HttpResponse.json(
          { error: 'Internal Server Error', message: 'Failed to update appointment' },
          { status: 500 }
        );
      });

    case 'unauthorizedAccess':
      return http.all('*/admin/*', () => {
        console.log('🚨 MSW: unauthorizedAccess - returning 401 error');
        return HttpResponse.json(
          { error: 'Unauthorized', message: 'Access denied' },
          { status: 401 }
        );
      });

    case 'networkTimeout':
      return http.all('*/appointments/board', () => {
        console.log('🚨 MSW: networkTimeout - simulating timeout');
        return new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Network timeout'));
          }, 3000); // 3 second timeout
        });
      });

    case 'dashboardStats500':
      return http.get('*/admin/dashboard/stats', () => {
        console.log('🚨 MSW: dashboardStats500 - returning 500 error');
        return HttpResponse.json(
          { error: 'Internal Server Error', message: 'Failed to load dashboard stats' },
          { status: 500 }
        );
      });

    case 'appointmentBoard500':
      return http.get('*/admin/appointments/board', () => {
        console.log('🚨 MSW: appointmentBoard500 - returning 500 error');
        return HttpResponse.json(
          { error: 'Internal Server Error', message: 'Failed to load appointment board' },
          { status: 500 }
        );
      });

    default:
      throw new Error(`Unknown error scenario: ${scenario}`);
  }
}

/**
 * Utility to create a scoped error scenario function.
 * Returns a function that automatically applies the specified scenario.
 */
export function createScopedErrorTest<T>(
  scenario: ErrorScenario,
  config: ErrorTestConfig = {}
) {
  return (testFn: () => Promise<T> | T, testConfig?: ErrorTestConfig): Promise<T> => {
    return withErrorScenario(scenario, testFn, { ...config, ...testConfig });
  };
}
