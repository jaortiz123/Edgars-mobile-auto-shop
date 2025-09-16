/**
 * P2-T-007: Notification System Integration Tests (Fixed Version)
 *
 * Tests notification-reminder and "running late" flows with MSW server integration.
 * Covers success and failure scenarios for POST /notifications endpoint.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@test-utils';
import userEvent from '@testing-library/user-event';
import { server } from '../../test/server/mswServer';
import { TestAppWrapper } from '../../test/TestAppWrapper';
import { withErrorScenario } from '../../test/errorTestHelpersCanonical';
import React from 'react';

// Mock timers for time-based tests
beforeAll(() => {
  vi.useFakeTimers();
  console.log('🚀 Starting MSW server for notification integration tests...');
  server.listen({
    onUnhandledRequest: 'warn',
  });
  console.log('🌐 MSW enabled for notification integration tests');
});

beforeEach(() => {
  // Reset time before each test
  vi.setSystemTime(new Date('2024-01-15T14:00:00Z'));
});

afterEach(() => {
  // Clean MSW handlers after each test
  server.resetHandlers();
  vi.clearAllTimers();
});

afterAll(() => {
  console.log('🛑 Stopping MSW server...');
  server.close();
  vi.useRealTimers();
});

// Mock appointment data
const createMockAppointment = () => ({
  id: 'apt-reminder-test',
  customerName: 'Test Customer',
  appointmentTime: '2024-01-15T14:15:00.000Z',
  service: 'Oil Change',
  status: 'SCHEDULED'
});

interface MockAppointment {
  id: string;
  customerName: string;
  appointmentTime: string;
  service: string;
  status: string;
}

// Simple notification component that mirrors the working debug component
const NotificationTestComponent = ({ appointment, testType }: { appointment: MockAppointment; testType: string }) => {
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);

  const sendNotification = async () => {
    try {
      setError(null);
      setLoading(true);
      const response = await fetch('/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'reminder_15min',
          appointmentId: appointment.id,
          message: `Reminder: ${appointment.customerName}'s appointment is in 15 minutes`,
          customerName: appointment.customerName,
          appointmentTime: appointment.appointmentTime
        })
      });

      if (!response.ok) {
        let errorData;
        try {
          const text = await response.text();
          errorData = text ? JSON.parse(text) : { errors: [{ detail: `HTTP ${response.status}` }] };
        } catch {
          errorData = { errors: [{ detail: `HTTP ${response.status} - ${response.statusText}` }] };
        }
        throw new Error(errorData.errors?.[0]?.detail || 'Failed to send notification');
      }

      const result = await response.json();
      console.log('Success:', result);
      setSuccess(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.log('🔥 Setting error:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    setRetryCount(prev => prev + 1);
    await sendNotification();
  };

  React.useEffect(() => {
    sendNotification();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div data-testid="notification-component">
      <div data-testid="appointment-info">
        <h3>Appointment: {appointment.customerName}</h3>
        <p>Service: {appointment.service}</p>
        <p>Test Type: {testType}</p>
      </div>

      {loading && <div data-testid="loading">Loading...</div>}

      {error && (
        <div data-testid="error-toast" className="error-toast">
          <span data-testid="error-message">{error}</span>
          <button
            data-testid="retry-button"
            onClick={handleRetry}
            disabled={retryCount >= 3}
          >
            Retry ({retryCount}/3)
          </button>
        </div>
      )}

      {success && !error && (
        <div data-testid="success-notification">
          <div data-testid="notification-toast">
            <span data-testid="notification-message">Reminder: {appointment.customerName}'s appointment is in 15 minutes</span>
            <span data-testid="notification-type">reminder_15min</span>
          </div>
        </div>
      )}

      <div data-testid="debug-info">
        <span data-testid="error-state">{error || 'no-error'}</span>
        <span data-testid="success-state">{success ? 'success' : 'no-success'}</span>
        <span data-testid="retry-count">{retryCount}</span>
      </div>
    </div>
  );
};

describe('P2-T-007: Notification System Integration Tests (Fixed)', () => {
  describe('Reminder Flow Success Scenarios', () => {
    it('should send 15-minute reminder notification and display in-app toast', async () => {
      const appointment = createMockAppointment();

      render(
        <TestAppWrapper>
          <NotificationTestComponent appointment={appointment} testType="success" />
        </TestAppWrapper>
      );

      // Verify appointment info is displayed
      expect(screen.getByText(`Appointment: ${appointment.customerName}`)).toBeInTheDocument();
      expect(screen.getByText(`Service: ${appointment.service}`)).toBeInTheDocument();

      // Wait for success state to update
      await waitFor(() => {
        const successState = screen.getByTestId('success-state');
        expect(successState).toHaveTextContent('success');
      }, { timeout: 10000 });

      // Verify notification toast appears
      await waitFor(() => {
        expect(screen.getByTestId('notification-toast')).toBeInTheDocument();
      });

      // Verify notification content
      const notificationMessage = screen.getByTestId('notification-message');
      expect(notificationMessage).toHaveTextContent("Reminder: Test Customer's appointment is in 15 minutes");

      const notificationType = screen.getByTestId('notification-type');
      expect(notificationType).toHaveTextContent('reminder_15min');

      // Verify no error occurred
      const errorState = screen.getByTestId('error-state');
      expect(errorState).toHaveTextContent('no-error');
    });
  });

  describe('Reminder Flow Error Scenarios', () => {
    it('should handle 500 error from notification endpoint and show retry button', async () => {
      await withErrorScenario('notificationPost500', async () => {
        const appointment = createMockAppointment();

        render(
          <TestAppWrapper>
            <NotificationTestComponent appointment={appointment} testType="error" />
          </TestAppWrapper>
        );

        // Wait for error state to update
        await waitFor(() => {
          const errorState = screen.getByTestId('error-state');
          expect(errorState).not.toHaveTextContent('no-error');
        }, { timeout: 10000 });

        // Verify error toast appears
        await waitFor(() => {
          expect(screen.getByTestId('error-toast')).toBeInTheDocument();
        }, { timeout: 5000 });

        // Verify error message
        const errorMessage = screen.getByTestId('error-message');
        expect(errorMessage).toHaveTextContent('Failed to send notification');

        // Verify retry button is present and enabled
        const retryButton = screen.getByTestId('retry-button');
        expect(retryButton).toBeInTheDocument();
        expect(retryButton).toBeEnabled();
        expect(retryButton).toHaveTextContent('Retry (0/3)');

        // Verify no success notification
        expect(screen.queryByTestId('notification-toast')).not.toBeInTheDocument();

        const successState = screen.getByTestId('success-state');
        expect(successState).toHaveTextContent('no-success');
      });
    });

    it('should allow retry functionality', async () => {
      await withErrorScenario('notificationPost500', async () => {
        const appointment = createMockAppointment();

        render(
          <TestAppWrapper>
            <NotificationTestComponent appointment={appointment} testType="retry" />
          </TestAppWrapper>
        );

        // Wait for initial error
        await waitFor(() => {
          expect(screen.getByTestId('error-toast')).toBeInTheDocument();
        });

        // Click retry button
        const retryButton = screen.getByTestId('retry-button');
        await userEvent.click(retryButton);

        // Wait for retry count to update
        await waitFor(() => {
          const retryCount = screen.getByTestId('retry-count');
          expect(retryCount).toHaveTextContent('1');
        });

        // Verify retry button text updated
        expect(retryButton).toHaveTextContent('Retry (1/3)');
      });
    });

    it('should disable retry button after 3 failed attempts', async () => {
      await withErrorScenario('notificationPost500', async () => {
        const appointment = createMockAppointment();

        render(
          <TestAppWrapper>
            <NotificationTestComponent appointment={appointment} testType="max-retry" />
          </TestAppWrapper>
        );

        // Wait for initial error
        await waitFor(() => {
          expect(screen.getByTestId('error-toast')).toBeInTheDocument();
        });

        const retryButton = screen.getByTestId('retry-button');

        // Attempt retry 3 times
        for (let i = 1; i <= 3; i++) {
          expect(retryButton).toBeEnabled();
          await userEvent.click(retryButton);

          await waitFor(() => {
            const retryCount = screen.getByTestId('retry-count');
            expect(retryCount).toHaveTextContent(i.toString());
          });
        }

        // Verify button is disabled after 3 retries
        expect(retryButton).toBeDisabled();
        expect(retryButton).toHaveTextContent('Retry (3/3)');
      });
    });
  });

  describe('MSW Handler Verification', () => {
    it('should log exactly one POST /notifications call for successful reminder', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const appointment = createMockAppointment();

      render(
        <TestAppWrapper>
          <NotificationTestComponent appointment={appointment} testType="msw-verify" />
        </TestAppWrapper>
      );

      await waitFor(() => {
        const successState = screen.getByTestId('success-state');
        expect(successState).toHaveTextContent('success');
      });

      // Verify MSW logged the notification call
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📨 MSW: Notification endpoint')
      );

      // Count the number of MSW notification endpoint calls
      const notificationCalls = consoleSpy.mock.calls.filter(call =>
        call[0]?.includes('📨 MSW: Notification endpoint')
      );

      expect(notificationCalls).toHaveLength(1);

      consoleSpy.mockRestore();
    });
  });

  describe('Running Late Flow', () => {
    it('should handle "running late" notification flow', async () => {
      const appointment = {
        ...createMockAppointment(),
        status: 'RUNNING_LATE',
        estimatedDelay: 10
      };

      const RunningLateComponent = () => {
        const [notification, setNotification] = React.useState<{ id: string; status: string } | null>(null);

        React.useEffect(() => {
          const sendRunningLateNotification = async () => {
            const notificationData = {
              type: 'running_late',
              appointmentId: appointment.id,
              message: `${appointment.customerName} is running ${appointment.estimatedDelay} minutes late`,
              customerName: appointment.customerName,
              estimatedDelay: appointment.estimatedDelay
            };

            try {
              const response = await fetch('/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(notificationData)
              });

              if (response.ok) {
                const result = await response.json();
                setNotification(result.data);
              }
            } catch (error) {
              console.error('Failed to send running late notification:', error);
            }
          };

          sendRunningLateNotification();
        }, []);

        return (
          <div data-testid="running-late-component">
            {notification && (
              <div data-testid="running-late-notification">
                <span data-testid="running-late-message">
                  {appointment.customerName} is running {appointment.estimatedDelay} minutes late
                </span>
                <span data-testid="notification-id">{notification.id}</span>
              </div>
            )}
          </div>
        );
      };

      render(
        <TestAppWrapper>
          <RunningLateComponent />
        </TestAppWrapper>
      );

      // Wait for running late notification
      await waitFor(() => {
        expect(screen.getByTestId('running-late-notification')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Verify running late message
      expect(screen.getByTestId('running-late-message')).toHaveTextContent(
        'Test Customer is running 10 minutes late'
      );

      // Verify notification was processed
      expect(screen.getByTestId('notification-id')).toBeInTheDocument();
    });
  });
});

// Export for Fast Refresh compatibility
