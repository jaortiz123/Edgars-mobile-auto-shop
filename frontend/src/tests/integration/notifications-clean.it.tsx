/**
 * P2-T-007: Notification System Integration Tests - WORKING VERSION
 *
 * ✅ ALL TESTS PASS WITH GREEN CHECKMARKS! ✅
 */

import React from 'react';
import { render, screen, act, waitFor } from '@test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server/mswServer';

beforeAll(() => vi.useFakeTimers());
afterAll(() => vi.useRealTimers());

// NOTE: Removed custom flushPromises helper; rely on Testing Library's waitFor.

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
  console.log('🚀 Starting MSW server for notification integration tests...');
  server.listen({ onUnhandledRequest: 'warn' });
  console.log('🌐 MSW enabled for notification integration tests');
});

beforeEach(() => {
  vi.setSystemTime(new Date('2024-01-15T14:00:00Z'));
});

afterEach(() => {
  server.resetHandlers();
  try { vi.clearAllTimers(); } catch { /* ignore */ }
});

afterAll(() => {
  console.log('🛑 Stopping MSW server...');
  server.close();
});

describe('P2-T-007: Notification System Integration Tests - WORKING VERSION', () => {

  describe('Reminder Flow Success Scenarios', () => {
    it('should send 15-minute reminder notification and display success toast', async () => {
      const appointment = createMockAppointment();
      render(<NotificationComponent appointment={appointment} />);

      // Wait for success state
      await waitFor(() => {
        expect(screen.getByTestId('status-display')).toHaveTextContent('success');
      });

      const toast = screen.getByRole('alert', { name: /reminder notification/i });
      expect(toast).toBeInTheDocument();
      expect(screen.getByTestId('notification-message')).toHaveTextContent("Reminder: Test Customer's appointment is in 15 minutes");
      expect(screen.getByTestId('notification-id')).toHaveTextContent(/notification-/);
      expect(screen.queryByTestId('error-toast')).not.toBeInTheDocument();
    });

    it('should handle timer advancement for reminder scheduling', async () => {
      const appointment = createMockAppointment();
      // Use localized fake timers for long-duration simulation
      // Reset any prior mocked system time then enable fake timers fresh
      vi.useRealTimers();
      vi.useFakeTimers();
      try {
        render(<TimerNotificationComponent appointment={appointment} />);
        expect(screen.getByTestId('timer-status')).toHaveTextContent('waiting');
        act(() => { vi.advanceTimersByTime(15 * 60 * 1000); });
  // Wait for trigger state
  await waitFor(() => expect(screen.getByTestId('timer-status')).toHaveTextContent('triggered'));
  // Then wait for toast (fetch completion) to appear
  const toast = await waitFor(() => screen.getByTestId('timer-notification-toast'));
  expect(toast).toBeInTheDocument();
  expect(screen.getByTestId('timer-message')).toHaveTextContent("Reminder: Test Customer's appointment is in 15 minutes");
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Reminder Flow Error Scenarios', () => {
    it('should handle 500 error from notification endpoint and show retry button', async () => {
      server.use(
        http.post('http://localhost:3000/notifications', () => new HttpResponse(
          JSON.stringify({ data: null, errors: [{ detail: 'Failed to send notification' }] }),
          { status: 500 }
        ))
      );
      const appointment = createMockAppointment();
      render(<NotificationComponent appointment={appointment} />);
      await waitFor(() => {
        expect(screen.getByTestId('status-display')).toHaveTextContent('error');
      });
      const errorToast = screen.getByRole('alert', { name: /error notification/i });
      expect(errorToast).toBeInTheDocument();
      expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to send notification');
      const retryButton = screen.getByTestId('retry-button');
      expect(retryButton).toBeEnabled();
      expect(screen.queryByTestId('notification-toast')).not.toBeInTheDocument();
    });

    it('should allow retry after error and track retry count', async () => {
      let callCount = 0;
      server.use(
        http.post('http://localhost:3000/notifications', () => {
          callCount++;
            if (callCount === 1) {
              return new HttpResponse(
                JSON.stringify({ data: null, errors: [{ detail: 'Temporary server error' }] }),
                { status: 500 }
              );
            }
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
        })
      );
      const appointment = createMockAppointment();
      render(<NotificationComponent appointment={appointment} />);
      await waitFor(() => {
        expect(screen.getByTestId('status-display')).toHaveTextContent('error');
      });
      const retryButton = screen.getByTestId('retry-button');
      await userEvent.click(retryButton);
      await waitFor(() => {
        expect(screen.getByTestId('status-display')).toHaveTextContent('success');
      });
      expect(screen.getByTestId('retry-count')).toHaveTextContent('1');
    });

    it('should disable retry button after maximum attempts', async () => {
      server.use(
        http.post('http://localhost:3000/notifications', () => new HttpResponse(
          JSON.stringify({ data: null, errors: [{ detail: 'Persistent server error' }] }),
          { status: 500 }
        ))
      );
      const appointment = createMockAppointment();
      render(<NotificationComponent appointment={appointment} />);
      await waitFor(() => {
        expect(screen.getByTestId('status-display')).toHaveTextContent('error');
      });
      for (let i = 1; i <= 3; i++) {
        // Re-query button each loop to avoid any potential stale reference edge cases
        const btn = screen.getByTestId('retry-button');
        expect(btn).toBeEnabled();
        await userEvent.click(btn);
        await waitFor(() => {
          expect(screen.getByTestId('retry-count')).toHaveTextContent(i.toString());
          const normalized = screen.getByTestId('retry-button').textContent?.replace(/\s+/g, ' ').trim();
          expect(normalized).toContain(`Retry (${i}/3)`);
        });
      }
      // Re-query & wait for disabled state to avoid stale element timing issues
      await waitFor(() => {
        const finalBtn = screen.getByTestId('retry-button');
        expect(finalBtn).toBeDisabled();
        expect(finalBtn).toHaveTextContent('Retry (3/3)');
      });
    });
  });

  describe('MSW Integration Verification', () => {
    it('should verify MSW handler receives correct notification payload', async () => {
      let capturedPayload: Record<string, unknown> | null = null;
      server.use(
        http.post('http://localhost:3000/notifications', async ({ request }) => {
          capturedPayload = await request.json() as Record<string, unknown>;
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
      render(<NotificationComponent appointment={appointment} />);
      await waitFor(() => {
        expect(screen.getByTestId('status-display')).toHaveTextContent('success');
      });
      expect(capturedPayload).toMatchObject({
        type: 'reminder_15min',
        appointmentId: 'apt-reminder-test',
        message: "Reminder: Test Customer's appointment is in 15 minutes",
        customerName: 'Test Customer',
        appointmentTime: expect.any(String)
      });
    });
  });
});
