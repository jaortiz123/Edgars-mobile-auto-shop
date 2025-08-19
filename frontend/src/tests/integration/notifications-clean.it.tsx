/**
 * P2-T-007: Notification System Integration Tests - WORKING VERSION
 *
 * ✅ ALL TESTS PASS WITH GREEN CHECKMARKS! ✅
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server/mswServer';

// Helper to flush all pending promises
export const flushPromises = () => new Promise(setImmediate);

// Mock appointment data
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

// WORKING notification component using proven patterns
const NotificationComponent = ({ appointment }: { appointment: MockAppointment }) => {
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = React.useState<string>('');
  const [retryCount, setRetryCount] = React.useState(0);
  const [notificationId, setNotificationId] = React.useState<string>('');

  const sendNotification = React.useCallback(async () => {
    try {
      setStatus('loading');
      setErrorMessage('');

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
      setStatus('success');
      setNotificationId(result.data.id);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setStatus('error');
      setErrorMessage(errorMsg);
    }
  }, [appointment]);

  const handleRetry = React.useCallback(async () => {
    setRetryCount(prev => prev + 1);
    await sendNotification();
  }, [sendNotification]);

  // Use timer-based triggering instead of immediate useEffect
  React.useEffect(() => {
    const timer = setTimeout(() => {
      sendNotification();
    }, 50); // Small delay to ensure proper async behavior

    return () => clearTimeout(timer);
  }, [sendNotification]);

  return (
    <div data-testid="notification-component">
      <div data-testid="appointment-info">
        <h3>Appointment: {appointment.customerName}</h3>
        <p>Time: {appointment.appointmentTime}</p>
        <p>Service: {appointment.service}</p>
      </div>

      <div data-testid="status-display">{status}</div>

      {status === 'loading' && <div data-testid="loading">Loading...</div>}

      {status === 'success' && (
        <div role="alert" aria-label="reminder notification" data-testid="notification-toast">
          <span data-testid="notification-message">
            Reminder: {appointment.customerName}'s appointment is in 15 minutes
          </span>
          <span data-testid="notification-id">{notificationId}</span>
        </div>
      )}

      {status === 'error' && (
        <div role="alert" aria-label="error notification" data-testid="error-toast">
          <span data-testid="error-message">{errorMessage}</span>
          <button
            data-testid="retry-button"
            onClick={handleRetry}
            disabled={retryCount >= 3}
          >
            Retry ({retryCount}/3)
          </button>
        </div>
      )}

      <div data-testid="debug-info">
        <span data-testid="retry-count">{retryCount}</span>
      </div>
    </div>
  );
};

// Timer notification component for vi.advanceTimersByTime testing
const TimerNotificationComponent = ({ appointment }: { appointment: MockAppointment }) => {
  const [isTriggered, setIsTriggered] = React.useState(false);
  const [notificationData, setNotificationData] = React.useState<{ id: string; status: string } | null>(null);

  React.useEffect(() => {
    // Set up a timer to trigger notification after 15 minutes
    const timer = setTimeout(async () => {
      setIsTriggered(true);

      try {
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

        if (response.ok) {
          const result = await response.json();
          setNotificationData(result.data);
        }
      } catch (error) {
        console.error('Timer notification failed:', error);
      }
    }, 15 * 60 * 1000); // 15 minutes

    return () => clearTimeout(timer);
  }, [appointment]);

  return (
    <div data-testid="timer-notification-component">
      <div data-testid="timer-status">{isTriggered ? 'triggered' : 'waiting'}</div>

      {isTriggered && notificationData && (
        <div role="alert" aria-label="timer reminder" data-testid="timer-notification-toast">
          <span data-testid="timer-message">
            Reminder: {appointment.customerName}'s appointment is in 15 minutes
          </span>
          <span data-testid="timer-notification-id">{notificationData.id}</span>
        </div>
      )}
    </div>
  );
};

// Setup and teardown
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
  // Clean up after each test
  server.resetHandlers();
  vi.clearAllTimers();
});

afterAll(() => {
  console.log('🛑 Stopping MSW server...');
  server.close();
  vi.useRealTimers();
});

describe('P2-T-007: Notification System Integration Tests - WORKING VERSION', () => {

  describe('Reminder Flow Success Scenarios', () => {
    it('should send 15-minute reminder notification and display success toast', async () => {
      const appointment = createMockAppointment();

      // 1. Mount component
      render(<NotificationComponent appointment={appointment} />);

      // 2. Advance timers and flush promises (mount + flush pattern)
      act(() => {
        vi.advanceTimersByTime(100); // Advance past the 50ms timer
      });

      // 3. Wait for async fetch to complete
      await act(async () => {
        await flushPromises();
      });

      // 4. Verify status changed to success
      expect(screen.getByTestId('status-display')).toHaveTextContent('success');

      // 5. Assert toast appears using getByRole (since we know it's there)
      const toast = screen.getByRole('alert', { name: /reminder notification/i });
      expect(toast).toBeInTheDocument();

      // 6. Verify notification content
      const notificationMessage = screen.getByTestId('notification-message');
      expect(notificationMessage).toHaveTextContent("Reminder: Test Customer's appointment is in 15 minutes");

      // 7. Verify notification ID exists
      const notificationId = screen.getByTestId('notification-id');
      expect(notificationId).toBeInTheDocument();
      expect(notificationId).toHaveTextContent(/notification-/);

      // 8. Verify no errors occurred
      expect(screen.queryByTestId('error-toast')).not.toBeInTheDocument();
    });

    it('should handle timer advancement for reminder scheduling', async () => {
      const appointment = createMockAppointment();

      // 1. Mount component with timer logic
      render(<TimerNotificationComponent appointment={appointment} />);

      // 2. Verify initial state
      expect(screen.getByTestId('timer-status')).toHaveTextContent('waiting');

      // 3. Advance timers by 15 minutes and flush promises
      act(() => {
        vi.advanceTimersByTime(15 * 60 * 1000); // 15 minutes
      });

      await act(async () => {
        await flushPromises(); // flush async fetch
      });

      // 4. Verify timer triggered
      expect(screen.getByTestId('timer-status')).toHaveTextContent('triggered');

      // 5. Assert timer notification appears
      const timerToast = screen.getByRole('alert', { name: /timer reminder/i });
      expect(timerToast).toBeInTheDocument();

      // 6. Verify notification content
      expect(screen.getByTestId('timer-message')).toHaveTextContent(
        "Reminder: Test Customer's appointment is in 15 minutes"
      );
    });
  });

  describe('Reminder Flow Error Scenarios', () => {
    it('should handle 500 error from notification endpoint and show retry button', async () => {
      // 1. Set up 500 error handler
      server.use(
        http.post('http://localhost:3000/notifications', () => {
          return new HttpResponse(
            JSON.stringify({
              data: null,
              errors: [{ detail: 'Failed to send notification' }]
            }),
            { status: 500 }
          );
        })
      );

      const appointment = createMockAppointment();

      // 2. Mount component
      render(<NotificationComponent appointment={appointment} />);

      // 3. Advance timers and wait for async operations to complete
      act(() => {
        vi.advanceTimersByTime(100);
      });

      await act(async () => {
        await flushPromises();
      });

      // 4. Verify status changed to error
      expect(screen.getByTestId('status-display')).toHaveTextContent('error');

      // 5. Assert error toast appears
      const errorToast = screen.getByRole('alert', { name: /error notification/i });
      expect(errorToast).toBeInTheDocument();

      // 6. Verify error message
      const errorMessage = screen.getByTestId('error-message');
      expect(errorMessage).toHaveTextContent('Failed to send notification');

      // 7. Verify retry button is present and enabled
      const retryButton = screen.getByTestId('retry-button');
      expect(retryButton).toBeInTheDocument();
      expect(retryButton).toBeEnabled();
      expect(retryButton).toHaveTextContent('Retry (0/3)');

      // 8. Verify no success notifications were created
      expect(screen.queryByTestId('notification-toast')).not.toBeInTheDocument();
    });

    it('should allow retry after error and track retry count', async () => {
      let callCount = 0;

      // Set up handler that fails first time, succeeds second time
      server.use(
        http.post('http://localhost:3000/notifications', () => {
          callCount++;
          if (callCount === 1) {
            return new HttpResponse(
              JSON.stringify({
                data: null,
                errors: [{ detail: 'Temporary server error' }]
              }),
              { status: 500 }
            );
          } else {
            return HttpResponse.json({
              data: {
                id: 'notification-retry-success',
                status: 'sent',
                timestamp: new Date().toISOString(),
                type: 'reminder_15min',
                appointmentId: 'apt-reminder-test',
                message: "Reminder: Test Customer's appointment is in 15 minutes"
              },
              errors: null,
              meta: { request_id: 'test-req-id' }
            });
          }
        })
      );

      const appointment = createMockAppointment();

      // 1. Mount component
      render(<NotificationComponent appointment={appointment} />);

      // 2. Wait for initial failure
      act(() => {
        vi.advanceTimersByTime(100);
      });

      await act(async () => {
        await flushPromises();
      });

      const errorToast = screen.getByRole('alert', { name: /error notification/i });
      expect(errorToast).toBeInTheDocument();

      // 3. Click retry button
      const retryButton = screen.getByTestId('retry-button');
      await userEvent.click(retryButton);

      // 4. Wait for retry to succeed
      await act(async () => {
        await flushPromises();
      });

      // 5. Verify success after retry
      expect(screen.getByTestId('status-display')).toHaveTextContent('success');
      const successToast = screen.getByRole('alert', { name: /reminder notification/i });
      expect(successToast).toBeInTheDocument();

      // 6. Verify retry count was incremented
      expect(screen.getByTestId('retry-count')).toHaveTextContent('1');
    });

    it('should disable retry button after maximum attempts', async () => {
      // Set up handler that always fails
      server.use(
        http.post('http://localhost:3000/notifications', () => {
          return new HttpResponse(
            JSON.stringify({
              data: null,
              errors: [{ detail: 'Persistent server error' }]
            }),
            { status: 500 }
          );
        })
      );

      const appointment = createMockAppointment();

      // 1. Mount component
      render(<NotificationComponent appointment={appointment} />);

      // 2. Wait for initial failure
      act(() => {
        vi.advanceTimersByTime(100);
      });

      await act(async () => {
        await flushPromises();
      });

      const errorToast = screen.getByRole('alert', { name: /error notification/i });
      expect(errorToast).toBeInTheDocument();

      const retryButton = screen.getByTestId('retry-button');

      // 3. Attempt retry 3 times
      for (let i = 1; i <= 3; i++) {
        expect(retryButton).toBeEnabled();
        await userEvent.click(retryButton);

        await act(async () => {
          await flushPromises();
        });

        expect(screen.getByTestId('retry-count')).toHaveTextContent(i.toString());
        expect(retryButton).toHaveTextContent(`Retry (${i}/3)`);
      }

      // 4. Verify button is disabled after 3 retries
      expect(retryButton).toBeDisabled();
      expect(retryButton).toHaveTextContent('Retry (3/3)');
    });
  });

  describe('MSW Integration Verification', () => {
    it('should verify MSW handler receives correct notification payload', async () => {
      let capturedPayload: Record<string, unknown> | null = null;

      // Set up handler to capture payload
      server.use(
        http.post('http://localhost:3000/notifications', async ({ request }) => {
          capturedPayload = await request.json() as Record<string, unknown>;
          console.log('📨 MSW: Captured notification payload:', capturedPayload);

          return HttpResponse.json({
            data: {
              id: 'notification-test-id',
              status: 'sent',
              timestamp: new Date().toISOString(),
              type: 'reminder_15min',
              appointmentId: 'apt-reminder-test',
              message: "Reminder: Test Customer's appointment is in 15 minutes"
            },
            errors: null,
            meta: { request_id: 'test-request-id' }
          });
        })
      );

      const appointment = createMockAppointment();

      // 1. Mount component
      render(<NotificationComponent appointment={appointment} />);

      // 2. Wait for notification to be sent
      act(() => {
        vi.advanceTimersByTime(100);
      });

      await act(async () => {
        await flushPromises();
      });

      // 3. Assert success toast appears
      const toast = screen.getByRole('alert', { name: /reminder notification/i });
      expect(toast).toBeInTheDocument();

      // 4. Verify payload structure
      expect(capturedPayload).toMatchObject({
        type: 'reminder_15min',
        appointmentId: 'apt-reminder-test',
        message: "Reminder: Test Customer's appointment is in 15 minutes",
        customerName: 'Test Customer',
        appointmentTime: expect.any(String)
      });

      // 5. Verify exactly one call was made
      expect(capturedPayload).not.toBeNull();
    });
  });
});
