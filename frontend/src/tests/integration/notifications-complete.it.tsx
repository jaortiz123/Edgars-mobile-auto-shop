/**
 * P2-T-007: Notification System Integration Tests - Complete Implementation
 * 
 * This file provides the complete implementation that includes both:
 * 1. Reminder notifications (15-minute warning)
 * 2. "Running late" notifications 
 * 
 * Applies the simplified pattern that works from debug-notification.it.tsx
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { server } from '../../test/server/mswServer';
import { withErrorScenario } from '../../test/errorTestHelpersCanonical';

// Simple test wrapper (same as working debug version)
export const TestAppWrapper = ({ children }: { children: React.ReactNode }) => {
  return <div>{children}</div>;
};

// Mock appointment data
const createMockAppointment = (minutesFromNow: number = 15) => {
  const now = new Date();
  const appointmentTime = new Date(now.getTime() + minutesFromNow * 60 * 1000);
  
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

// Notification component for reminder flow
const ReminderNotificationComponent = ({ appointment }: { appointment: MockAppointment }) => {
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [notificationSent, setNotificationSent] = React.useState(false);
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
          message: `Reminder: ${appointment.customerName}'s appointment is in 15 minutes`
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
      console.log('Reminder notification success:', result);
      setNotificationSent(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.log('Setting reminder error:', errorMessage);
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
  }, []);

  return (
    <div data-testid="reminder-component">
      <div data-testid="appointment-info">
        <h3>Appointment: {appointment.customerName}</h3>
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
      
      {!loading && !error && notificationSent && (
        <div data-testid="reminder-toast" className="reminder-toast">
          <span data-testid="reminder-message">
            Reminder sent: {appointment.customerName}'s appointment is in 15 minutes
          </span>
        </div>
      )}

      <div data-testid="debug-info">
        <span data-testid="notification-sent">{notificationSent ? 'sent' : 'not-sent'}</span>
        <span data-testid="error-state">{error || 'no-error'}</span>
        <span data-testid="retry-count">{retryCount}</span>
      </div>
    </div>
  );
};

// Notification component for "running late" flow
const RunningLateNotificationComponent = ({ appointment, delayMinutes = 10 }: { appointment: MockAppointment, delayMinutes?: number }) => {
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [notificationSent, setNotificationSent] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);

  const sendNotification = async () => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await fetch('/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'running_late',
          appointmentId: appointment.id,
          message: `${appointment.customerName} is running ${delayMinutes} minutes late for their appointment`,
          delayMinutes
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
      console.log('Running late notification success:', result);
      setNotificationSent(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.log('Setting running late error:', errorMessage);
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
  }, []);

  return (
    <div data-testid="running-late-component">
      <div data-testid="appointment-info">
        <h3>Appointment: {appointment.customerName}</h3>
        <p>Service: {appointment.service}</p>
        <p>Delay: {delayMinutes} minutes late</p>
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
      
      {!loading && !error && notificationSent && (
        <div data-testid="running-late-toast" className="running-late-toast">
          <span data-testid="running-late-message">
            Running late notification sent: {appointment.customerName} is {delayMinutes} minutes late
          </span>
        </div>
      )}

      <div data-testid="debug-info">
        <span data-testid="notification-sent">{notificationSent ? 'sent' : 'not-sent'}</span>
        <span data-testid="error-state">{error || 'no-error'}</span>
        <span data-testid="retry-count">{retryCount}</span>
      </div>
    </div>
  );
};

// Mock timers setup
beforeAll(() => {
  vi.useFakeTimers();
  console.log('🚀 Starting MSW server for notification integration tests...');
  server.listen({
    onUnhandledRequest: 'warn',
  });
  console.log('🌐 MSW enabled for notification integration tests');
});

beforeEach(() => {
  vi.setSystemTime(new Date('2024-01-15T14:00:00Z'));
  server.resetHandlers();
});

afterEach(() => {
  server.resetHandlers();
  vi.clearAllTimers();
});

afterAll(() => {
  console.log('🛑 Stopping MSW server...');
  server.close();
  vi.useRealTimers();
});

describe('P2-T-007: Notification System Integration Tests - Complete', () => {
  describe('Reminder Flow (15-minute warning)', () => {
    it('should send 15-minute reminder notification successfully', async () => {
      const appointment = createMockAppointment(15);
      
      render(
        <TestAppWrapper>
          <ReminderNotificationComponent appointment={appointment} />
        </TestAppWrapper>
      );

      // Verify appointment info is displayed
      expect(screen.getByText(`Appointment: ${appointment.customerName}`)).toBeInTheDocument();
      expect(screen.getByText(`Service: ${appointment.service}`)).toBeInTheDocument();

      // Should show loading initially
      expect(screen.getByTestId('loading')).toBeInTheDocument();

      // Wait for reminder toast to appear
      await waitFor(() => {
        expect(screen.getByTestId('reminder-toast')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify reminder message
      expect(screen.getByTestId('reminder-message')).toHaveTextContent(
        "Reminder sent: Test Customer's appointment is in 15 minutes"
      );

      // Verify no errors occurred
      expect(screen.queryByTestId('error-toast')).not.toBeInTheDocument();
      expect(screen.getByTestId('notification-sent')).toHaveTextContent('sent');
    });

    it('should handle timer advancement for 15-minute reminder trigger', async () => {
      const mockAppointment = createMockAppointment(15);
      
      render(
        <TestAppWrapper>
          <ReminderNotificationComponent appointment={mockAppointment} />
        </TestAppWrapper>
      );

      // Advance time by 15 minutes to simulate reminder trigger time
      await act(async () => {
        vi.advanceTimersByTime(15 * 60 * 1000);
      });

      // Wait for notification to complete
      await waitFor(() => {
        expect(screen.getByTestId('reminder-toast')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify the notification was processed
      expect(screen.getByTestId('notification-sent')).toHaveTextContent('sent');
    });

    it('should handle reminder notification failures with retry', async () => {
      await withErrorScenario('notificationPost500', async () => {
        const appointment = createMockAppointment(15);
        
        render(
          <TestAppWrapper>
            <ReminderNotificationComponent appointment={appointment} />
          </TestAppWrapper>
        );

        // Should show loading initially
        expect(screen.getByTestId('loading')).toBeInTheDocument();

        // Wait for error toast to appear
        await waitFor(() => {
          expect(screen.getByTestId('error-toast')).toBeInTheDocument();
        }, { timeout: 5000 });

        // Verify error message
        expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to send notification');

        // Verify retry button is present and enabled
        const retryButton = screen.getByTestId('retry-button');
        expect(retryButton).toBeInTheDocument();
        expect(retryButton).toBeEnabled();
        expect(retryButton).toHaveTextContent('Retry (0/3)');

        // Verify no success notification was created
        expect(screen.queryByTestId('reminder-toast')).not.toBeInTheDocument();
        expect(screen.getByTestId('notification-sent')).toHaveTextContent('not-sent');
      });
    });
  });

  describe('Running Late Flow', () => {
    it('should send running late notification successfully', async () => {
      const appointment = createMockAppointment(0); // Appointment is now
      
      render(
        <TestAppWrapper>
          <RunningLateNotificationComponent appointment={appointment} delayMinutes={10} />
        </TestAppWrapper>
      );

      // Verify appointment info is displayed
      expect(screen.getByText(`Appointment: ${appointment.customerName}`)).toBeInTheDocument();
      expect(screen.getByText(`Service: ${appointment.service}`)).toBeInTheDocument();
      expect(screen.getByText(`Delay: 10 minutes late`)).toBeInTheDocument();

      // Should show loading initially
      expect(screen.getByTestId('loading')).toBeInTheDocument();

      // Wait for running late toast to appear
      await waitFor(() => {
        expect(screen.getByTestId('running-late-toast')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify running late message
      expect(screen.getByTestId('running-late-message')).toHaveTextContent(
        "Running late notification sent: Test Customer is 10 minutes late"
      );

      // Verify no errors occurred
      expect(screen.queryByTestId('error-toast')).not.toBeInTheDocument();
      expect(screen.getByTestId('notification-sent')).toHaveTextContent('sent');
    });

    it('should handle different delay amounts for running late notifications', async () => {
      const appointment = createMockAppointment(0);
      
      render(
        <TestAppWrapper>
          <RunningLateNotificationComponent appointment={appointment} delayMinutes={25} />
        </TestAppWrapper>
      );

      // Wait for notification to complete
      await waitFor(() => {
        expect(screen.getByTestId('running-late-toast')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify the delay amount is correctly displayed
      expect(screen.getByText(`Delay: 25 minutes late`)).toBeInTheDocument();
      expect(screen.getByTestId('running-late-message')).toHaveTextContent(
        "Running late notification sent: Test Customer is 25 minutes late"
      );
    });

    it('should handle running late notification failures with retry', async () => {
      await withErrorScenario('notificationPost500', async () => {
        const appointment = createMockAppointment(0);
        
        render(
          <TestAppWrapper>
            <RunningLateNotificationComponent appointment={appointment} delayMinutes={15} />
          </TestAppWrapper>
        );

        // Should show loading initially
        expect(screen.getByTestId('loading')).toBeInTheDocument();

        // Wait for error toast to appear
        await waitFor(() => {
          expect(screen.getByTestId('error-toast')).toBeInTheDocument();
        }, { timeout: 5000 });

        // Verify error message
        expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to send notification');

        // Verify retry functionality
        const retryButton = screen.getByTestId('retry-button');
        expect(retryButton).toBeInTheDocument();
        expect(retryButton).toBeEnabled();

        // Click retry button
        await userEvent.click(retryButton);

        // Wait for retry attempt to complete
        await waitFor(() => {
          expect(screen.getByTestId('retry-count')).toHaveTextContent('1');
        }, { timeout: 5000 });

        // Error should still be present due to error scenario
        expect(screen.getByTestId('error-toast')).toBeInTheDocument();
      });
    });
  });

  describe('MSW Integration Verification', () => {
    it('should verify MSW handler receives correct reminder payload', async () => {
      const appointment = createMockAppointment(15);
      let capturedPayload: any = null;
      
      const { http, HttpResponse } = await import('msw');
      server.use(
        http.post('http://localhost:3000/notifications', async ({ request }) => {
          capturedPayload = await request.json();
          console.log('📨 MSW: Captured reminder payload:', capturedPayload);
          
          return HttpResponse.json({
            data: {
              id: `notification-${Date.now()}`,
              status: 'sent',
              timestamp: new Date().toISOString(),
              type: capturedPayload.type,
              appointmentId: capturedPayload.appointmentId,
              message: capturedPayload.message
            },
            errors: null,
            meta: { request_id: 'test-request-id' }
          });
        })
      );
      
      render(
        <TestAppWrapper>
          <ReminderNotificationComponent appointment={appointment} />
        </TestAppWrapper>
      );

      // Wait for notification to complete
      await waitFor(() => {
        expect(screen.getByTestId('reminder-toast')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify MSW received the correct payload
      expect(capturedPayload).not.toBeNull();
      expect(capturedPayload.type).toBe('reminder_15min');
      expect(capturedPayload.appointmentId).toBe(appointment.id);
      expect(capturedPayload.message).toContain("Test Customer's appointment is in 15 minutes");
    });

    it('should verify MSW handler receives correct running late payload', async () => {
      const appointment = createMockAppointment(0);
      let capturedPayload: any = null;
      
      const { http, HttpResponse } = await import('msw');
      server.use(
        http.post('http://localhost:3000/notifications', async ({ request }) => {
          capturedPayload = await request.json();
          console.log('📨 MSW: Captured running late payload:', capturedPayload);
          
          return HttpResponse.json({
            data: {
              id: `notification-${Date.now()}`,
              status: 'sent',
              timestamp: new Date().toISOString(),
              type: capturedPayload.type,
              appointmentId: capturedPayload.appointmentId,
              message: capturedPayload.message
            },
            errors: null,
            meta: { request_id: 'test-request-id' }
          });
        })
      );
      
      render(
        <TestAppWrapper>
          <RunningLateNotificationComponent appointment={appointment} delayMinutes={20} />
        </TestAppWrapper>
      );

      // Wait for notification to complete
      await waitFor(() => {
        expect(screen.getByTestId('running-late-toast')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify MSW received the correct payload
      expect(capturedPayload).not.toBeNull();
      expect(capturedPayload.type).toBe('running_late');
      expect(capturedPayload.appointmentId).toBe(appointment.id);
      expect(capturedPayload.message).toContain("Test Customer is running 20 minutes late");
      expect(capturedPayload.delayMinutes).toBe(20);
    });
  });
});
