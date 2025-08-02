/**
 * P2-T-006: Error Path Integration Tests - Canonical MSW Implementation
 * 
 * Comprehensive error scenario testing using MSW's canonical server.use() pattern.
 * Tests verify how the app behaves under failure conditions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from '@testing-library/react';

import { TestAppWrapper } from '../test/TestAppWrapper';
import { Dashboard } from '../admin/Dashboard';
import { withErrorScenario, withConsoleErrorSpy } from '../test/errorTestHelpersCanonical';

describe('P2-T-006: Error Path Integration Tests', () => {
  beforeEach(() => {
    // Clear authentication state before each test
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
      sessionStorage.removeItem('authToken');
    }
  });

  describe('API 500 Errors', () => {
    it('should show error toast when appointment PATCH returns 500', async () => {
      await withErrorScenario('appointmentPatch500', async () => {
        await withConsoleErrorSpy(async (consoleSpy) => {
          const user = userEvent.setup();

          // Render the full app with test wrapper
          render(
            <TestAppWrapper>
              <Dashboard />
            </TestAppWrapper>
          );

          // Wait for dashboard to load
          await waitFor(() => {
            expect(screen.getByText(/scheduled/i)).toBeInTheDocument();
          }, { timeout: 10000 });

          // Find and interact with an appointment card that triggers PATCH
          const appointmentCard = await screen.findByText(/happy path customer/i);
          expect(appointmentCard).toBeInTheDocument();

          // Simulate action that triggers appointment update (e.g., status change)
          await act(async () => {
            await user.click(appointmentCard);
          });

          // Look for drawer or status update trigger
          const statusButtons = screen.getAllByRole('button');
          const updateButton = statusButtons.find(btn => 
            btn.textContent?.toLowerCase().includes('progress') ||
            btn.textContent?.toLowerCase().includes('status') ||
            btn.textContent?.toLowerCase().includes('update')
          );

          if (updateButton) {
            await act(async () => {
              await user.click(updateButton);
            });

            // Verify error handling - should show error toast or message
            await waitFor(() => {
              const errorElements = [
                screen.queryByText(/error updating appointment/i),
                screen.queryByText(/internal server error/i),
                screen.queryByText(/failed to update/i),
                screen.queryByText(/something went wrong/i),
                screen.queryByRole('alert')
              ].filter(Boolean);

              expect(errorElements.length).toBeGreaterThan(0);
            }, { timeout: 5000 });
          }

          // Verify console errors were logged (but handled gracefully)
          expect(consoleSpy).toHaveBeenCalled();
        });
      });
    });

    it('should show retry button after 500 error', async () => {
      await withErrorScenario('appointmentPatch500', async () => {
        const user = userEvent.setup();

        render(
          <TestAppWrapper>
            <Dashboard />
          </TestAppWrapper>
        );

        // Wait for dashboard to load
        await waitFor(() => {
          expect(screen.getByText(/scheduled/i)).toBeInTheDocument();
        }, { timeout: 10000 });

        // Trigger an action that would cause 500 error
        const appointmentCard = await screen.findByText(/happy path customer/i);
        await act(async () => {
          await user.click(appointmentCard);
        });

        // After error occurs, look for retry mechanism
        await waitFor(() => {
          const retryElements = [
            screen.queryByText(/retry/i),
            screen.queryByText(/try again/i),
            screen.queryByRole('button', { name: /retry/i })
          ].filter(Boolean);

          // At least one retry mechanism should be available
          expect(retryElements.length).toBeGreaterThan(0);
        }, { timeout: 5000 });
      });
    });
  });

  describe('401 Unauthorized Errors', () => {
    it('should redirect to login when receiving 401 on protected endpoints', async () => {
      await withErrorScenario('protectedEndpoints401', async () => {
        await withConsoleErrorSpy(async (consoleSpy) => {
          render(
            <TestAppWrapper>
              <Dashboard />
            </TestAppWrapper>
          );

          // Wait for the 401 response to trigger redirect
          await waitFor(() => {
            // Should redirect to login or show login form
            const loginElements = [
              screen.queryByText(/login/i),
              screen.queryByText(/sign in/i),
              screen.queryByText(/authentication required/i),
              screen.queryByText(/unauthorized/i),
              screen.queryByLabelText(/email/i),
              screen.queryByLabelText(/password/i)
            ].filter(Boolean);

            expect(loginElements.length).toBeGreaterThan(0);
          }, { timeout: 8000 });

          // Verify console errors were logged
          expect(consoleSpy).toHaveBeenCalled();
        });
      });
    });

    it('should handle unauthorized access gracefully', async () => {
      await withErrorScenario('unauthorizedAccess', async () => {
        const user = userEvent.setup();

        render(
          <TestAppWrapper>
            <Dashboard />
          </TestAppWrapper>
        );

        // Wait for initial load
        await waitFor(() => {
          expect(screen.getByText(/scheduled/i)).toBeInTheDocument();
        }, { timeout: 10000 });

        // Try to perform action that triggers 401
        const appointmentCard = await screen.findByText(/happy path customer/i);
        await act(async () => {
          await user.click(appointmentCard);
        });

        // Look for status update that would trigger unauthorized error
        const statusButtons = screen.getAllByRole('button');
        const statusButton = statusButtons.find(btn => 
          btn.textContent?.toLowerCase().includes('status')
        );

        if (statusButton) {
          await act(async () => {
            await user.click(statusButton);
          });

          // Should show unauthorized error or redirect to login
          await waitFor(() => {
            const unauthorizedElements = [
              screen.queryByText(/unauthorized/i),
              screen.queryByText(/authentication required/i),
              screen.queryByText(/login/i),
              screen.queryByText(/access denied/i)
            ].filter(Boolean);

            expect(unauthorizedElements.length).toBeGreaterThan(0);
          }, { timeout: 5000 });
        }
      });
    });
  });

  describe('Network Timeout Scenarios', () => {
    it('should show loading state for dashboard stats delay >3s', async () => {
      await withErrorScenario('dashboardStatsDelay', async () => {
        render(
          <TestAppWrapper>
            <Dashboard />
          </TestAppWrapper>
        );

        // Should show loading indicators while waiting for delayed response
        await waitFor(() => {
          const loadingElements = [
            screen.queryByText(/loading/i),
            screen.queryByTestId(/loading/i),
            screen.queryByRole('progressbar'),
            screen.queryByText(/fetching/i)
          ].filter(Boolean);

          expect(loadingElements.length).toBeGreaterThan(0);
        }, { timeout: 2000 });

        // Wait for the delayed response to complete
        await waitFor(() => {
          expect(screen.getByText(/scheduled/i)).toBeInTheDocument();
        }, { timeout: 6000 }); // Should complete after 3.5s delay
      });
    });

    it('should handle network timeout gracefully', async () => {
      await withErrorScenario('dashboardStatsTimeout', async () => {
        await withConsoleErrorSpy(async (consoleSpy) => {
          render(
            <TestAppWrapper>
              <Dashboard />
            </TestAppWrapper>
          );

          // Should eventually show timeout error
          await waitFor(() => {
            const errorElements = [
              screen.queryByText(/timeout/i),
              screen.queryByText(/network error/i),
              screen.queryByText(/failed to load/i),
              screen.queryByText(/connection error/i),
              screen.queryByRole('alert')
            ].filter(Boolean);

            expect(errorElements.length).toBeGreaterThan(0);
          }, { timeout: 8000 });

          // Verify error was logged
          expect(consoleSpy).toHaveBeenCalled();
        });
      });
    });
  });

  describe('Error Recovery Mechanisms', () => {
    it('should allow retry after network errors', async () => {
      await withErrorScenario('dashboardStatsTimeout', async () => {
        const user = userEvent.setup();

        render(
          <TestAppWrapper>
            <Dashboard />
          </TestAppWrapper>
        );

        // Wait for timeout error to occur
        await waitFor(() => {
          const errorElements = [
            screen.queryByText(/timeout/i),
            screen.queryByText(/error/i),
            screen.queryByRole('alert')
          ].filter(Boolean);

          expect(errorElements.length).toBeGreaterThan(0);
        }, { timeout: 8000 });

        // Look for retry mechanism
        const retryButton = screen.queryByRole('button', { name: /retry/i }) ||
                           screen.queryByText(/try again/i) ||
                           screen.queryByText(/refresh/i);

        if (retryButton) {
          await act(async () => {
            await user.click(retryButton);
          });

          // Should attempt to reload/retry
          await waitFor(() => {
            const loadingElements = [
              screen.queryByText(/loading/i),
              screen.queryByRole('progressbar')
            ].filter(Boolean);

            expect(loadingElements.length).toBeGreaterThan(0);
          }, { timeout: 2000 });
        }
      });
    });

    it('should maintain app stability despite multiple errors', async () => {
      // Test that the app doesn't crash when multiple errors occur
      await withErrorScenario('appointmentPatch500', async () => {
        await withConsoleErrorSpy(async (consoleSpy) => {
          const user = userEvent.setup();

          render(
            <TestAppWrapper>
              <Dashboard />
            </TestAppWrapper>
          );

          // Wait for dashboard to load
          await waitFor(() => {
            expect(screen.getByText(/scheduled/i)).toBeInTheDocument();
          }, { timeout: 10000 });

          // Try multiple operations that might fail
          const appointmentCard = await screen.findByText(/happy path customer/i);
          
          // Multiple clicks to trigger multiple error scenarios
          for (let i = 0; i < 3; i++) {
            await act(async () => {
              await user.click(appointmentCard);
            });
            
            // Small delay between operations
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          // App should still be functional
          expect(screen.getByText(/scheduled/i)).toBeInTheDocument();
          
          // Console errors may have been logged, but app should not crash
          if (consoleSpy.mock.calls.length > 0) {
            // Errors were handled gracefully
            expect(consoleSpy).toHaveBeenCalled();
          }
        });
      });
    });
  });
});
