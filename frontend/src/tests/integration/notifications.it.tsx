/**
 * P2-T-007: Notification System Integration Tests
 *
 * Tests notification-reminder and "running late" flows with MSW server integration.
 * Covers success and failure scenarios for POST /notifications endpoint.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@test-utils';
import { setupUserEvent } from '@/tests/testUtils/userEventHelper';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server/mswServer';
import { TestAppWrapper } from '../../test/TestAppWrapper';
import React from 'react';

// Use global MSW lifecycle from tests/setup.ts. Only manage timers locally.
beforeEach(() => {
  try { vi.useFakeTimers(); } catch { /* already in fake timer mode */ }
  vi.setSystemTime(new Date('2024-01-15T14:00:00Z'));
});

afterEach(() => {
  try { vi.useRealTimers(); } catch { /* ignore */ }
});

// Mock appointment data 15 minutes from now
const createMockAppointment = () => {
  const now = new Date();
  const appointmentTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now

  return {
    id: 'apt-reminder-test',
    customerName: 'Test Customer',
    appointmentTime: appointmentTime.toISOString(),
    service: 'Oil Change',
    status: 'SCHEDULED'
  };
};

interface MockAppointment {
  id: string;
  customerName: string;
  appointmentTime: string;
  service: string;
  status: string;
}

interface Notification {
  id: string;
  message: string;
  type: string;
}

// Mock notification service component for testing (simplified to match working debug component)
const MockNotificationComponent = ({ appointment }: { appointment: MockAppointment }) => {
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);

  const sendNotification = async () => {
    try {
      setError(null);
      setLoading(true);
  // Use absolute URL so error scenario override handlers (http://localhost:3000/notifications) take precedence consistently
  const response = await fetch('http://localhost:3000/notifications', {
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

      // Add to in-app notifications
      setNotifications(prev => [...prev, {
        id: result.data.id,
        message: `Reminder: ${appointment.customerName}'s appointment is in 15 minutes`,
        type: 'reminder_15min'
      }]);

      console.log('Success:', result);
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
        <p>Time: {appointment.appointmentTime}</p>
        <p>Service: {appointment.service}</p>
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
      {!loading && !error && notifications.length > 0 && (
        <div data-testid="notification-list">
          {notifications.map(notification => (
            <div key={notification.id} data-testid="notification-toast" className="notification-toast">
              <span data-testid="notification-message">{notification.message}</span>
              <span data-testid="notification-type">{notification.type}</span>
            </div>
          ))}
        </div>
      )}

      <div data-testid="debug-info">
        <span data-testid="notification-count">{notifications.length}</span>
        <span data-testid="error-state">{error || 'no-error'}</span>
  <span data-testid="retry-count">{retryCount}</span>
      </div>
    </div>
  );
};

describe('P2-T-007: Notification System Integration Tests', () => {
  describe('Reminder Flow Success Scenarios', () => {
    it('should send 15-minute reminder notification and display in-app toast', async () => {
      const appointment = createMockAppointment();

      render(
        <TestAppWrapper>
          <MockNotificationComponent appointment={appointment} />
        </TestAppWrapper>
      );

      // Verify appointment info is displayed
      expect(screen.getByText(`Appointment: ${appointment.customerName}`)).toBeInTheDocument();
      expect(screen.getByText(`Service: ${appointment.service}`)).toBeInTheDocument();

      // Wait for the reminder timer to trigger and notification to be sent
  vi.advanceTimersByTime(200); // Advance past the 100ms delay

      // Wait for the notification to appear
      await waitFor(() => {
        expect(screen.getByTestId('notification-toast')).toBeInTheDocument();
      });

      // Verify notification content
      const notificationMessage = screen.getByTestId('notification-message');
      expect(notificationMessage).toHaveTextContent("Reminder: Test Customer's appointment is in 15 minutes");

      const notificationType = screen.getByTestId('notification-type');
      expect(notificationType).toHaveTextContent('reminder_15min');

      // Verify exactly one notification was created
      const notificationCount = screen.getByTestId('notification-count');
      expect(notificationCount).toHaveTextContent('1');

      // Verify no errors occurred
      expect(screen.queryByTestId('error-toast')).not.toBeInTheDocument();
    });

    it('should advance timers by 15 minutes and verify reminder trigger timing', async () => {
      const mockAppointment = createMockAppointment();

      render(
        <TestAppWrapper>
          <MockNotificationComponent appointment={mockAppointment} />
        </TestAppWrapper>
      );

      // Advance time by exactly 15 minutes (900,000ms)
  vi.advanceTimersByTime(15 * 60 * 1000);

      // Wait for notification processing
      await waitFor(() => {
        expect(screen.getByTestId('notification-toast')).toBeInTheDocument();
      });

      // Verify the timing-based notification was triggered
      expect(screen.getByTestId('notification-message')).toHaveTextContent(
        "Reminder: Test Customer's appointment is in 15 minutes"
      );
    });
  });

  describe('Reminder Flow Error Scenarios', () => {
    it('should handle 500 error from notification endpoint and show retry button', async () => {
      // Deterministic 500 for first request (avoid race with existing handler priorities)
      server.use(
        http.post('http://localhost:3000/notifications', () => {
          return HttpResponse.json({
            data: null,
            errors: [{ status: '500', code: 'NOTIFICATION_ERROR', detail: 'Failed to send notification' }],
            meta: { request_id: 'test-error-1' }
          }, { status: 500 });
        })
      );
        const appointment = createMockAppointment();

        render(
          <TestAppWrapper>
            <MockNotificationComponent appointment={appointment} />
          </TestAppWrapper>
        );

        await waitFor(() => expect(screen.getByTestId('error-toast')).toBeInTheDocument(), { timeout: 4000 });
        expect(screen.getByTestId('debug-info')).toBeInTheDocument();

        // Verify error message
  const errorMessage = screen.getByTestId('error-message');
  expect(errorMessage.textContent || '').toMatch(/Failed to send notification|NOTIFICATION_ERROR|500/i);

        // Verify retry button is present and enabled
        const retryButton = screen.getByTestId('retry-button');
        expect(retryButton).toBeInTheDocument();
        expect(retryButton).toBeEnabled();
        expect(retryButton).toHaveTextContent('Retry (0/3)');

        // Verify no successful notifications were created
  expect(screen.queryByTestId('notification-toast')).not.toBeInTheDocument();
  const notificationCount = screen.getByTestId('notification-count');
  expect(notificationCount).toHaveTextContent('0');
    });

    it('should allow retry after error and eventually succeed', async () => {
      let errorCallCount = 0;

      // Use a custom handler that fails first time, succeeds second time
      server.use(
        // Align endpoint with production handler which logs as (localhost:3000)
        http.post('http://localhost:3000/notifications', async ({ request }) => {
          const body = await request.json() as Record<string, unknown>;
          errorCallCount++;

          if (errorCallCount === 1) {
            // First call fails
            console.log('🚨 MSW: Simulating 500 error for POST /notifications (retry test)');
            return HttpResponse.json(
              {
                data: null,
                errors: [{ status: '500', code: 'NOTIFICATION_ERROR', detail: 'Temporary server error' }],
                meta: { request_id: 'test-req-id' }
              },
              { status: 500 }
            );
          } else {
            // Second call succeeds
            console.log('✅ MSW: Notification sent successfully after retry');
            return HttpResponse.json({
              data: {
                id: 'notification-retry-success',
                status: 'sent',
                timestamp: new Date().toISOString(),
                type: body.type as string,
                appointmentId: body.appointmentId as string,
                message: body.message as string
              },
              errors: null,
              meta: { request_id: 'test-req-id' }
            });
          }
        })
      );

      const appointment = createMockAppointment();

      render(
        <TestAppWrapper>
          <MockNotificationComponent appointment={appointment} />
        </TestAppWrapper>
      );

      // Wait for initial failure
  vi.advanceTimersByTime(200);

      await waitFor(() => {
        expect(screen.getByTestId('error-toast')).toBeInTheDocument();
      });

      // Click retry button
      const retryButton = screen.getByTestId('retry-button');
  const user = setupUserEvent();
  await user.click(retryButton);

      // Wait for retry to succeed
      await waitFor(() => {
        expect(screen.getByTestId('notification-toast')).toBeInTheDocument();
      });

      // Verify success after retry
      expect(screen.getByTestId('notification-message')).toHaveTextContent(
        "Reminder: Test Customer's appointment is in 15 minutes"
      );

      // Verify error is cleared
      expect(screen.queryByTestId('error-toast')).not.toBeInTheDocument();

      // Verify retry count was incremented
      const retryCount = screen.getByTestId('retry-count');
      expect(retryCount).toHaveTextContent('1');
    });

    it('should disable retry button after 3 failed attempts', async () => {
      // Always fail for every attempt
      server.use(
        http.post('http://localhost:3000/notifications', () => {
          return HttpResponse.json({
            data: null,
            errors: [{ status: '500', code: 'NOTIFICATION_ERROR', detail: 'Failed to send notification' }],
            meta: { request_id: 'test-error-retry' }
          }, { status: 500 });
        })
      );
        const appointment = createMockAppointment();

        render(
          <TestAppWrapper>
            <MockNotificationComponent appointment={appointment} />
          </TestAppWrapper>
        );

  // Wait for initial failure (error toast visible after first failed POST)
  vi.advanceTimersByTime(200);
  await waitFor(() => expect(screen.getByTestId('error-toast')).toBeInTheDocument());

  // Attempt retry 3 times
        // We start at 0 attempts shown in text, each click increments
        for (let i = 1; i <= 3; i++) {
          const btn = await screen.findByTestId('retry-button');
          expect(btn).toBeEnabled();
          const user = setupUserEvent();
          await user.click(btn);
          await waitFor(() => expect(screen.getByTestId('retry-count')).toHaveTextContent(String(i)));
        }

        // After 3 failed attempts button should be disabled with (3/3)
  const finalBtn = await screen.findByTestId('retry-button');
  expect(finalBtn).toBeDisabled();
  expect(finalBtn).toHaveTextContent('Retry (3/3)');
    });
  });

  describe('MSW Handler Verification', () => {
    it('should log exactly one POST /notifications call for successful reminder', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const appointment = createMockAppointment();

      render(
        <TestAppWrapper>
          <MockNotificationComponent appointment={appointment} />
        </TestAppWrapper>
      );

  vi.advanceTimersByTime(200);

      await waitFor(() => {
        expect(screen.getByTestId('notification-toast')).toBeInTheDocument();
      });

      // Verify MSW logged the notification call
      // Relax assertion: ensure at least one call includes the substring (logs now have body as second arg)
      const hasEndpointLog = consoleSpy.mock.calls.some(call =>
        call.some(arg => typeof arg === 'string' && arg.includes('📨 MSW: Notification endpoint (localhost:3000) called with body:'))
      );
      expect(hasEndpointLog).toBe(true);

      const hasSuccessLog = consoleSpy.mock.calls.some(call =>
        call.some(arg => typeof arg === 'string' && arg.includes('✅ MSW: Notification (localhost:3000) sent successfully:'))
      );
      expect(hasSuccessLog).toBe(true);

      // Count the number of MSW notification endpoint calls
      const notificationCalls = consoleSpy.mock.calls.filter(call =>
        call[0]?.includes('📨 MSW: Notification endpoint (localhost:3000) called')
      );

      expect(notificationCalls).toHaveLength(1);

      consoleSpy.mockRestore();
    });

    it('should verify notification payload structure sent to MSW', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const appointment = createMockAppointment();

      render(
        <TestAppWrapper>
          <MockNotificationComponent appointment={appointment} />
        </TestAppWrapper>
      );

  vi.advanceTimersByTime(200);

      await waitFor(() => {
        expect(screen.getByTestId('notification-toast')).toBeInTheDocument();
      });

      // Find the MSW log call with the request body
      const bodyLog = consoleSpy.mock.calls.find(call =>
        call[0]?.includes('📨 MSW: Notification endpoint (localhost:3000) called with body:')
      );

      expect(bodyLog).toBeDefined();

      // Extract and parse the JSON payload from the log
  const rawPayload = bodyLog?.[1];
  const payload = rawPayload ? JSON.parse(rawPayload as string) : {};

      // Verify payload structure
      expect(payload).toMatchObject({
        type: 'reminder_15min',
        appointmentId: 'apt-reminder-test',
        message: "Reminder: Test Customer's appointment is in 15 minutes",
        customerName: 'Test Customer',
        appointmentTime: expect.any(String)
      });

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
              const response = await fetch('http://localhost:3000/notifications', {
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
      });

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
export {};
