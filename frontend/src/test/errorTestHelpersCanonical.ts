/**
 * P2-T-006: Error Scenario Test Helpers - Canonical MSW Implementation
 *
 * This file provides utilities for testing error scenarios using MSW's canonical pattern.
 * Uses server.use() and server.resetHandlers() for true test isolation.
 */

import { vi } from 'vitest';
import type { RequestHandler } from 'msw';
// Use centralized host-agnostic server (tests/server/server)
import { server } from '../tests/server/server';
import {
  appointment500Handlers,
  unauthorizedHandlers,
  dashboardStatsDelayHandler,
  dashboardStatsTimeoutHandler,
  dashboardStats401Handler,
  notification500Handlers
} from './server/errorHandlers';

/**
 * Available error scenarios for testing
 */
export type ErrorScenario =
  | 'appointmentPatch500'
  | 'unauthorizedAccess'
  | 'dashboardStatsDelay'
  | 'dashboardStatsTimeout'
  | 'protectedEndpoints401'
  | 'notificationPost500';

/**
 * Canonical MSW pattern for error scenario testing.
 * Uses server.use() for per-test handler overrides with automatic cleanup.
 *
 * @param scenario - The error scenario to simulate
 * @param testFn - The test function to run with the error scenario active
 * @returns Promise that resolves when test completes and cleanup is done
 */
export async function withErrorScenario<T>(
  scenario: ErrorScenario,
  testFn: () => Promise<T>
): Promise<T> {
  // Get the appropriate error handlers for the scenario
  const errorHandlers = getErrorHandlers(scenario);

  console.log(`🚨 Setting up error scenario: ${scenario}`);

  // Override handlers for this test
  server.use(...errorHandlers);

  try {
    // Run the test
    const result = await testFn();
    return result;
  } finally {
    // Clean up - reset to original handlers
    server.resetHandlers();
    console.log(`✅ Cleaned up error scenario: ${scenario}`);
  }
}

/**
 * Get the appropriate error handlers for a given scenario
 */
function getErrorHandlers(scenario: ErrorScenario): RequestHandler[] {
  switch (scenario) {
    case 'appointmentPatch500':
      return appointment500Handlers;

    case 'unauthorizedAccess':
      return unauthorizedHandlers;

    case 'dashboardStatsDelay':
      return [dashboardStatsDelayHandler];

    case 'dashboardStatsTimeout':
      return [dashboardStatsTimeoutHandler];

    case 'protectedEndpoints401':
      return [dashboardStats401Handler];

    case 'notificationPost500':
      return notification500Handlers;

    default:
      throw new Error(`Unknown error scenario: ${scenario}`);
  }
}

/**
 * Helper to create console error spy that can be used for negative testing.
 * This should be used when testing error scenarios to ensure errors are properly handled.
 */
export function withConsoleErrorSpy<T>(testFn: (consoleSpy: ReturnType<typeof vi.spyOn>) => Promise<T>): Promise<T> {
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  return testFn(consoleSpy).finally(() => {
    consoleSpy.mockRestore();
  });
}

/**
 * Helper to test that an error scenario produces the expected console errors.
 * Combines withErrorScenario and withConsoleErrorSpy for convenience.
 */
export async function testErrorScenario<T>(
  scenario: ErrorScenario,
  testFn: (consoleSpy: ReturnType<typeof vi.spyOn>) => Promise<T>,
  expectedErrorCount?: number
): Promise<T> {
  return withErrorScenario(scenario, () =>
    withConsoleErrorSpy(async (consoleSpy) => {
      const result = await testFn(consoleSpy);

      if (expectedErrorCount !== undefined) {
        expect(consoleSpy).toHaveBeenCalledTimes(expectedErrorCount);
      }

      return result;
    })
  );
}
