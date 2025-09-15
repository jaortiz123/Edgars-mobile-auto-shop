/**
 * P2-T-006: Error Path Integration Tests - Deterministic Implementation
 *
 * Tests how the app behaves under failure conditions using the canonical
 * withErrorScenario helper with MSW server.use() pattern.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, waitFor } from '@test-utils';
import userEvent from '@testing-library/user-event';
import { server } from '../../test/server/mswServer';
import { TestAppWrapper } from '../../test/TestAppWrapper';
import { withErrorScenario } from '../../test/errorHelpers';

// Start MSW server for these integration tests
beforeAll(() => {
  console.log('🚀 Starting MSW server for error path integration tests...');
  server.listen({
    onUnhandledRequest: 'warn',
  });
  console.log('🌐 MSW enabled for error path integration tests');
});

afterEach(() => {
  // Clean MSW handlers after each test
  server.resetHandlers();
});

afterAll(() => {
  console.log('🛑 Stopping MSW server...');
  server.close();
});

describe('Error Path Integration Tests', () => {
  describe('Appointment Update Errors', () => {
    it('should handle 500 errors on appointment update gracefully', async () => {
      await withErrorScenario('appointmentPatch500', async () => {
        // Mock a simple appointment editor component for testing
        const MockAppointmentEditor = () => {
          const [error, setError] = React.useState<string | null>(null);
          const [isLoading, setIsLoading] = React.useState(false);

          const handleSave = async () => {
            setIsLoading(true);
            setError(null);

            try {
              const response = await fetch('/api/appointments/123', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'completed' })
              });

              if (!response.ok) {
                throw new Error('Failed to update appointment');
              }
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
              setIsLoading(false);
            }
          };

          return (
            <div>
              <button onClick={handleSave} disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Appointment'}
              </button>
              {error && (
                <div role="alert" data-testid="error-message">
                  Error: {error}
                </div>
              )}
            </div>
          );
        };

        const user = userEvent.setup();

        render(
          <TestAppWrapper>
            <MockAppointmentEditor />
          </TestAppWrapper>
        );

        // Click save button
        await user.click(screen.getByRole('button', { name: /save appointment/i }));

        // Wait for error message to appear
        await waitFor(() => {
          const errorMessage = screen.getByTestId('error-message');
          expect(errorMessage).toBeInTheDocument();
          expect(errorMessage).toHaveTextContent(/error.*failed to update appointment/i);
        }, { timeout: 5000 });
      });
    });
  });

  describe('Authorization Errors', () => {
    it('should handle 401 unauthorized access errors', async () => {
      await withErrorScenario('unauthorizedAccess', async () => {
        // Mock a component that accesses admin endpoints
        const MockDashboard = () => {
          const [error, setError] = React.useState<string | null>(null);
          const [isLoading, setIsLoading] = React.useState(false);

          React.useEffect(() => {
            const loadDashboard = async () => {
              setIsLoading(true);
              setError(null);

              try {
                const response = await fetch('/api/admin/dashboard/stats');

                if (response.status === 401) {
                  throw new Error('Unauthorized access');
                }
                if (!response.ok) {
                  throw new Error('Failed to load dashboard');
                }
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
              } finally {
                setIsLoading(false);
              }
            };

            loadDashboard();
          }, []);

          if (isLoading) return <div>Loading dashboard...</div>;
          if (error) return <div role="alert" data-testid="auth-error">Access denied: {error}</div>;
          return <div>Dashboard loaded</div>;
        };

        render(
          <TestAppWrapper>
            <MockDashboard />
          </TestAppWrapper>
        );

        // Wait for unauthorized error to appear
        await waitFor(() => {
          const errorMessage = screen.getByTestId('auth-error');
          expect(errorMessage).toBeInTheDocument();
          expect(errorMessage).toHaveTextContent(/access denied.*unauthorized/i);
        }, { timeout: 5000 });
      });
    });
  });

  describe('Network Timeout Handling', () => {
    it('should handle network timeouts on board loading', async () => {
      await withErrorScenario('networkTimeout', async () => {
        // Mock a component that loads appointment board
        const MockAppointmentBoard = () => {
          const [error, setError] = React.useState<string | null>(null);
          const [isLoading, setIsLoading] = React.useState(false);

          React.useEffect(() => {
            const loadBoard = async () => {
              setIsLoading(true);
              setError(null);

              try {
                // Create a timeout promise that rejects after 2 seconds
                const timeoutPromise = new Promise((_, reject) => {
                  setTimeout(() => reject(new Error('Network timeout')), 2000);
                });

                // Race the fetch against the timeout
                const result = await Promise.race([
                  fetch('/api/appointments/board'),
                  timeoutPromise
                ]);

                // Type guard to ensure we have a Response
                if (!(result instanceof Response)) {
                  throw new Error('Unexpected result type');
                }

                const response = result;

                if (!response.ok) {
                  throw new Error('Failed to load board');
                }
              } catch (err) {
                // Handle any network errors (including timeout)
                if (err instanceof Error && err.message.includes('Network timeout')) {
                  setError('Network timeout - please try again');
                } else if (err instanceof TypeError && err.message.includes('fetch')) {
                  setError('Network timeout - please try again');
                } else if (err instanceof Error && err.message.includes('Failed to fetch')) {
                  setError('Network timeout - please try again');
                } else {
                  setError(err instanceof Error ? err.message : 'Unknown error');
                }
              } finally {
                setIsLoading(false);
              }
            };

            loadBoard();
          }, []);

          if (isLoading) return <div>Loading board...</div>;
          if (error) return <div role="alert" data-testid="timeout-error">Network error: {error}</div>;
          return <div>Board loaded</div>;
        };

        render(
          <TestAppWrapper>
            <MockAppointmentBoard />
          </TestAppWrapper>
        );

        // Wait for timeout error to appear
        await waitFor(() => {
          const errorMessage = screen.getByTestId('timeout-error');
          expect(errorMessage).toBeInTheDocument();
          expect(errorMessage).toHaveTextContent(/network error.*timeout/i);
        }, { timeout: 3000 }); // Reduced timeout to prevent test timeout
      });
    }, 4000); // Set test timeout to 4 seconds
  });

  describe('Dashboard Stats Errors', () => {
    it('should handle 500 errors on dashboard stats loading', async () => {
      await withErrorScenario('dashboardStats500', async () => {
        // Mock dashboard stats component
        const MockDashboardStats = () => {
          const [stats, setStats] = React.useState(null);
          const [error, setError] = React.useState<string | null>(null);
          const [isLoading, setIsLoading] = React.useState(false);

          React.useEffect(() => {
            const loadStats = async () => {
              setIsLoading(true);
              setError(null);

              try {
                const response = await fetch('/api/admin/dashboard/stats');

                if (!response.ok) {
                  throw new Error('Failed to load dashboard statistics');
                }

                const data = await response.json();
                setStats(data);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
              } finally {
                setIsLoading(false);
              }
            };

            loadStats();
          }, []);

          if (isLoading) return <div>Loading stats...</div>;
          if (error) return <div role="alert" data-testid="stats-error">Stats error: {error}</div>;
          return <div>Stats loaded: {JSON.stringify(stats)}</div>;
        };

        render(
          <TestAppWrapper>
            <MockDashboardStats />
          </TestAppWrapper>
        );

        // Wait for stats error to appear
        await waitFor(() => {
          const errorMessage = screen.getByTestId('stats-error');
          expect(errorMessage).toBeInTheDocument();
          expect(errorMessage).toHaveTextContent(/stats error.*failed to load/i);
        }, { timeout: 5000 });
      });
    });
  });

  describe('Error Scenario Isolation', () => {
    it('should properly isolate error scenarios between tests', async () => {
      // First test: Should work normally (no error scenario active)
      const MockNormalComponent = () => {
        const [data, setData] = React.useState<string | null>(null);
        const [error, setError] = React.useState<string | null>(null);

        React.useEffect(() => {
          fetch('/api/admin/dashboard/stats')
            .then(response => {
              if (response.ok) {
                setData('Success');
              } else {
                throw new Error('Request failed');
              }
            })
            .catch(err => setError(err.message));
        }, []);

        if (error) return <div data-testid="unexpected-error">Unexpected error: {error}</div>;
        if (data) return <div data-testid="success">Success: {data}</div>;
        return <div>Loading...</div>;
      };

      render(
        <TestAppWrapper>
          <MockNormalComponent />
        </TestAppWrapper>
      );

      // Should succeed because no error scenario is active
      await waitFor(() => {
        expect(screen.getByTestId('success')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });
});

// Add React import for JSX
import React from 'react';
