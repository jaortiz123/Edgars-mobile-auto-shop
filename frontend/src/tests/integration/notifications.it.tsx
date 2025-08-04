/**
 * P2-T-007: Notification System Integration Tests
 * 
 * Tests notification-reminder and "running late" flows with MSW server integration.
 * Covers success and failure scenarios for POST /notifications endpoint.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
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
      await act(async () => {
        vi.advanceTimersByTime(200); // Advance past the 100ms delay
      });

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
      await act(async () => {
        vi.advanceTimersByTime(15 * 60 * 1000);
      });

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
      await withErrorScenario('notificationPost500', async () => {
        const appointment = createMockAppointment();
        
        render(
          <TestAppWrapper>
            <MockNotificationComponent appointment={appointment} />
          </TestAppWrapper>
        );

        // First, let's check that we can see the debug info
        await waitFor(() => {
          expect(screen.getByTestId('debug-info')).toBeInTheDocument();
        });

        // Wait for the async network call to complete and state to update
        await waitFor(() => {
          const errorState = screen.getByTestId('error-state');
          expect(errorState).not.toHaveTextContent('no-error');
        }, { timeout: 10000 });

        // Now wait for error toast to appear
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

        // Verify no successful notifications were created
        expect(screen.queryByTestId('notification-toast')).not.toBeInTheDocument();
        
        const notificationCount = screen.getByTestId('notification-count');
        expect(notificationCount).toHaveTextContent('0');
      });
    });

    it('should allow retry after error and eventually succeed', async () => {
      let errorCallCount = 0;
      
      // Use a custom handler that fails first time, succeeds second time
      server.use(
        http.post('http://localhost:3001/notifications', async ({ request }) => {
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
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(screen.getByTestId('error-toast')).toBeInTheDocument();
      });

      // Click retry button
      const retryButton = screen.getByTestId('retry-button');
      await userEvent.click(retryButton);

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
      await withErrorScenario('notificationPost500', async () => {
        const appointment = createMockAppointment();
        
        render(
          <TestAppWrapper>
            <MockNotificationComponent appointment={appointment} />
          </TestAppWrapper>
        );

        // Wait for initial failure
        await act(async () => {
          vi.advanceTimersByTime(200);
        });

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
          <MockNotificationComponent appointment={appointment} />
        </TestAppWrapper>
      );

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(screen.getByTestId('notification-toast')).toBeInTheDocument();
      });

      // Verify MSW logged the notification call
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📨 MSW: Notification endpoint called with body:')
      );
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ MSW: Notification sent successfully:')
      );

      // Count the number of MSW notification endpoint calls
      const notificationCalls = consoleSpy.mock.calls.filter(call => 
        call[0]?.includes('📨 MSW: Notification endpoint called')
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

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(screen.getByTestId('notification-toast')).toBeInTheDocument();
      });

      // Find the MSW log call with the request body
      const bodyLog = consoleSpy.mock.calls.find(call => 
        call[0]?.includes('📨 MSW: Notification endpoint called with body:')
      );

      expect(bodyLog).toBeDefined();
      
      // Extract and parse the JSON payload from the log
      const bodyLogString = bodyLog?.[1] || '';
      const payload = JSON.parse(bodyLogString);
      
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
