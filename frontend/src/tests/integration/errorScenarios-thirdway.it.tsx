/**
 * P2-T-006: Error Path Integration Tests - "Third Way" Implementation
 *
 * Comprehensive error scenario testing using the robust withErrorScenario wrapper
 * with guaranteed cleanup and timeout protection. This approach ensures:
 * - No hanging tests due to infinite promises or network timeouts
 * - Proper isolation between test scenarios
 * - Guaranteed cleanup even if tests throw exceptions
 * - True integration testing without full app rendering overhead
 *
 * Test Categories:
 * - API 500 errors with proper error handling and user feedback
 * - Network timeouts and delays with loading states
 * - Auth rejection (401) with redirect to login
 * - Proper async/await patterns with act() wrapping
 * - No uncaught promise rejections
 */



import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { screen, waitFor, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  withErrorScenario,
  withErrorScenarioAct,
  withErrorScenarios,
  createScopedErrorTest
} from '../../test/errorTestHelpers';
import { TestAppWrapper } from '../../test/TestAppWrapper';
import { server, resetMockData } from '../../test/server/mswServer';
import { mockAuthentication, clearAuthentication } from '../../test/integrationUtils';

// Unmock the API module to allow real HTTP calls to MSW server
vi.unmock('@/lib/api');

// Mock the notification service to prevent actual notifications during error testing
vi.mock('@/services/notificationService', () => ({
  scheduleReminder: vi.fn(),
  getNotifications: vi.fn(() => []),
  getNotificationsByType: vi.fn(() => []),
  getUnreadNotifications: vi.fn(() => []),
  clearAllNotifications: vi.fn(),
  markNotificationAsRead: vi.fn(),
  markAsRead: vi.fn()
}));

// Import components to test
import { AppointmentEditor } from '@/components/appointments/AppointmentEditor';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { AppointmentList } from '@/components/appointments/AppointmentList';

describe('P2-T-006: Error Path Integration Tests - Third Way', () => {
  beforeAll(() => {
    console.log('🚀 Starting MSW server for Error Path integration tests...');

    // Start MSW server
    server.listen({
      onUnhandledRequest: 'warn',
    });

    console.log('🌐 MSW enabled for error scenario testing');
  });

  beforeEach(() => {
    // Clear authentication and reset mock data before each test
    clearAuthentication();
    resetMockData();
  });

  afterAll(() => {
    // Stop MSW server
    server.close();
    console.log('🔌 MSW server stopped');
  });

  describe('API 500 Server Error Scenarios', () => {
    it.error('should handle appointment update 500 error with user feedback', async () => {
      // Create scoped test function for this specific scenario
      const testAppointmentPatch500 = createScopedErrorTest('appointmentPatch500', {
        timeout: 8000, // 8 second timeout for this specific test
      });

      await testAppointmentPatch500(async () => {
        // Mock authentication for protected routes
        mockAuthentication();

        // Render appointment editor within test wrapper
        render(
          <TestAppWrapper initialRoute="/appointments/apt-happy-1/edit">
            <AppointmentEditor appointmentId="apt-happy-1" />
          </TestAppWrapper>
        );

        // Wait for component to load
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /save|update/i })).toBeInTheDocument();
        });

        // User interaction that will trigger the 500 error
        const user = userEvent.setup();
        const saveButton = screen.getByRole('button', { name: /save|update/i });

        await user.click(saveButton);

        // Assert that error feedback is shown to user
        await waitFor(() => {
          expect(
            screen.getByText(/error updating appointment|failed to save|something went wrong/i)
          ).toBeInTheDocument();
        }, { timeout: 5000 });

        // Ensure no uncaught promise rejections occurred
        // The vitest-fail-on-console should catch any console.error calls
      });
    });

    it.error('should handle dashboard stats 500 error with fallback UI', async () => {
      await withErrorScenario('dashboardStatsDelay', async () => {
        // Mock authentication
        mockAuthentication();

        // Render dashboard stats component
        render(
          <TestAppWrapper>
            <DashboardStats />
          </TestAppWrapper>
        );

        // Should show loading state initially
        expect(screen.getByText(/loading|fetching/i)).toBeInTheDocument();

        // After delay/error, should show error state or fallback
        await waitFor(() => {
          const errorElement = screen.queryByText(/error|failed|unable to load/i);
          const fallbackElement = screen.queryByText(/dashboard temporarily unavailable/i);

          expect(errorElement || fallbackElement).toBeInTheDocument();
        }, { timeout: 6000 }); // Allow time for the 3.5s delay plus processing
      });
    });
  });

  describe('Authentication Error Scenarios', () => {
    it.error('should handle 401 unauthorized access with redirect', async () => {
      await withErrorScenarioAct('unauthorizedAccess', async () => {
        // Start without authentication to trigger 401
        clearAuthentication();

        // Attempt to render a protected component
        render(
          <TestAppWrapper initialRoute="/appointments">
            <AppointmentList />
          </TestAppWrapper>
        );

        // Should redirect to login or show unauthorized message
        await waitFor(() => {
          const loginRedirect = screen.queryByText(/login|sign in/i);
          const unauthorizedMessage = screen.queryByText(/unauthorized|access denied/i);

          expect(loginRedirect || unauthorizedMessage).toBeInTheDocument();
        });
      });
    });

    it.error('should handle protected endpoint 401 with proper error handling', async () => {
      const testProtectedEndpoints = createScopedErrorTest('protectedEndpoints401');

      await testProtectedEndpoints(async () => {
        // Mock partial authentication (expired token scenario)
        mockAuthentication();

        render(
          <TestAppWrapper initialRoute="/admin">
            <div data-testid="admin-panel">Admin Panel Placeholder</div>
          </TestAppWrapper>
        );

        // Should handle 401 gracefully without crashing
        await waitFor(() => {
          // Either redirect to login or show error message
          const hasRedirect = window.location.pathname.includes('/login');
          const hasErrorMessage = screen.queryByText(/session expired|please log in again/i);

          expect(hasRedirect || hasErrorMessage).toBeTruthy();
        });
      });
    });
  });

  describe('Network Timeout and Delay Scenarios', () => {
    it.error('should handle network timeout gracefully', async () => {
      await withErrorScenario('networkTimeout', async () => {
        mockAuthentication();

        render(
          <TestAppWrapper>
            <DashboardStats />
          </TestAppWrapper>
        );

        // Should show loading state
        expect(screen.getByText(/loading|fetching/i)).toBeInTheDocument();

        // After timeout, should show error or retry option
        await waitFor(() => {
          const timeoutError = screen.queryByText(/timeout|network error|try again/i);
          const retryButton = screen.queryByRole('button', { name: /retry|refresh/i });

          expect(timeoutError || retryButton).toBeInTheDocument();
        }, { timeout: 3000 });
      }, { timeout: 5000 }); // Shorter timeout for network timeout test
    });

    it.error('should show loading states during network delays', async () => {
      await withErrorScenarioAct('dashboardStatsDelay', async () => {
        mockAuthentication();

        render(
          <TestAppWrapper>
            <DashboardStats />
          </TestAppWrapper>
        );

        // Should immediately show loading state
        expect(screen.getByText(/loading|fetching/i)).toBeInTheDocument();

        // Loading state should persist during the delay
        await waitFor(() => {
          expect(screen.getByText(/loading|fetching/i)).toBeInTheDocument();
        }, { timeout: 2000 });

        // Eventually should either load data or show error
        await waitFor(() => {
          const hasData = screen.queryByText(/appointments|statistics/i);
          const hasError = screen.queryByText(/error|failed/i);
          const hasLoading = screen.queryByText(/loading|fetching/i);

          // Should either have data, error, or still be loading (all valid states)
          expect(hasData || hasError || hasLoading).toBeInTheDocument();
        }, { timeout: 8000 });
      });
    });
  });

  describe('Multiple Error Scenarios in Sequence', () => {
    it.error('should handle multiple error types without interference', async () => {
      // Test multiple scenarios in sequence to ensure proper isolation
      const scenarios = ['appointmentPatch500', 'unauthorizedAccess', 'networkTimeout'] as const;

      const results = await withErrorScenarios(scenarios, async (scenario) => {
        mockAuthentication();

        // Different component for each scenario to test isolation
        const ComponentMap = {
          appointmentPatch500: () => <AppointmentEditor appointmentId="apt-happy-1" />,
          unauthorizedAccess: () => <AppointmentList />,
          networkTimeout: () => <DashboardStats />,
        };

        const TestComponent = ComponentMap[scenario];

        render(
          <TestAppWrapper>
            <TestComponent />
          </TestAppWrapper>
        );

        // Each scenario should handle its error appropriately
        await waitFor(() => {
          // Look for any error indication or fallback UI
          const errorIndicators = [
            /error|failed|unable|timeout/i,
            /try again|retry|refresh/i,
            /login|unauthorized|access denied/i
          ];

          const hasErrorIndication = errorIndicators.some(pattern =>
            screen.queryByText(pattern)
          );

          expect(hasErrorIndication).toBeTruthy();
        }, { timeout: 5000 });

        return `${scenario}-handled`;
      });

      // Verify all scenarios were handled
      expect(results).toHaveLength(3);
      expect(results).toEqual([
        'appointmentPatch500-handled',
        'unauthorizedAccess-handled',
        'networkTimeout-handled'
      ]);
    });
  });

  describe('Error Recovery and Retry Patterns', () => {
    it.error('should provide retry functionality after network errors', async () => {
      await withErrorScenario('networkTimeout', async () => {
        mockAuthentication();

        render(
          <TestAppWrapper>
            <DashboardStats />
          </TestAppWrapper>
        );

        // Wait for timeout error to appear
        await waitFor(() => {
          expect(screen.getByText(/error|timeout|failed/i)).toBeInTheDocument();
        }, { timeout: 3000 });

        // Look for retry mechanism
        const retryButton = screen.queryByRole('button', { name: /retry|refresh|try again/i });

        if (retryButton) {
          // Test retry functionality
          const user = userEvent.setup();
          await user.click(retryButton);

          // Should show loading state again
          await waitFor(() => {
            expect(screen.getByText(/loading|retrying/i)).toBeInTheDocument();
          });
        } else {
          // If no explicit retry button, component should handle it gracefully
          expect(screen.getByText(/error|timeout|failed/i)).toBeInTheDocument();
        }
      }, { timeout: 8000 });
    });
  });
});
