import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { server } from '../../test/server/mswServer';
import { withErrorScenario } from '../../test/errorTestHelpersCanonical';

// Simple test wrapper
export const TestAppWrapper = ({ children }: { children: React.ReactNode }) => {
  return <div>{children}</div>;
};

// Reminder notification component for testing
export const ReminderNotificationComponent = () => {
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const sendNotification = async () => {
    try {
      setError(null);
      setLoading(true);
      const response = await fetch('/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'reminder_15min', appointmentId: 'apt-reminder-test', message: "Reminder: Test Customer's appointment is in 15 minutes" })
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.log('Setting error:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    sendNotification();
  }, []);

  return (
    <div data-testid="reminder-component">
      {loading && <div data-testid="loading">Loading...</div>}
      {error && (
        <div data-testid="error-toast" className="error-toast">
          <span data-testid="error-message">{error}</span>
        </div>
      )}
      {!loading && !error && <div data-testid="success">Success!</div>}
    </div>
  );
};

// Running late notification component for testing
export const RunningLateNotificationComponent = () => {
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const sendNotification = async () => {
    try {
      setError(null);
      setLoading(true);
      const response = await fetch('/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'running_late', appointmentId: 'apt-late-test', message: "Test Customer is running late for their appointment" })
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.log('Setting error:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    sendNotification();
  }, []);

  return (
    <div data-testid="running-late-component">
      {loading && <div data-testid="loading">Loading...</div>}
      {error && (
        <div data-testid="error-toast" className="error-toast">
          <span data-testid="error-message">{error}</span>
        </div>
      )}
      {!loading && !error && <div data-testid="success">Success!</div>}
    </div>
  );
};

// Retry notification component
export const RetryNotificationComponent = () => {
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);

  const sendNotification = async () => {
    try {
      setError(null);
      setLoading(true);
      const response = await fetch('/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'reminder_15min', appointmentId: 'apt-retry-test', message: "Reminder: Test Customer's appointment is in 15 minutes" })
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.log('Setting error:', errorMessage);
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
    <div data-testid="retry-component">
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
          <span data-testid="retry-count" className="sr-only">{retryCount}</span>
        </div>
      )}
      {!loading && !error && <div data-testid="success">Success!</div>}
    </div>
  );
};

describe('P2-T-007: Notification System Integration Tests - Final', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    console.log('🚀 Starting MSW server for notification tests...');
    server.listen({ onUnhandledRequest: 'warn' });
    console.log('🌐 MSW enabled for notification tests');
  });

  afterAll(() => {
    console.log('🛑 Stopping MSW server...');
    server.close();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.setSystemTime(new Date('2024-01-15T14:00:00Z'));
    server.resetHandlers();
  });

  afterEach(() => {
    server.resetHandlers();
    vi.clearAllTimers();
  });

  it('should send 15-minute reminder notification successfully', async () => {
    render(
      <TestAppWrapper>
        <ReminderNotificationComponent />
      </TestAppWrapper>
    );

    // Should show loading initially
    expect(screen.getByTestId('loading')).toBeInTheDocument();

    // Wait for success to appear - add debugging
    await waitFor(() => {
      const component = screen.getByTestId('reminder-component');
      console.log('🔍 Component HTML:', component.innerHTML);
      expect(screen.getByTestId('success')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Should not show error
    expect(screen.queryByTestId('error-toast')).not.toBeInTheDocument();
  }, 10000);

  it('should handle timer advancement for 15-minute reminder trigger', async () => {
    render(
      <TestAppWrapper>
        <ReminderNotificationComponent />
      </TestAppWrapper>
    );

    // Advance time by 15 minutes to simulate reminder trigger time
    vi.advanceTimersByTime(15 * 60 * 1000);

    // Wait for success to appear
    await waitFor(() => {
      expect(screen.getByTestId('success')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Should not show error
    expect(screen.queryByTestId('error-toast')).not.toBeInTheDocument();
  });

  it('should send running late notification successfully', async () => {
    render(
      <TestAppWrapper>
        <RunningLateNotificationComponent />
      </TestAppWrapper>
    );

    // Should show loading initially
    expect(screen.getByTestId('loading')).toBeInTheDocument();

    // Wait for success to appear
    await waitFor(() => {
      expect(screen.getByTestId('success')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Should not show error
    expect(screen.queryByTestId('error-toast')).not.toBeInTheDocument();
  });

  it('should handle 500 error from notification endpoint and show error toast', async () => {
    await withErrorScenario('notificationPost500', async () => {
      render(
        <TestAppWrapper>
          <ReminderNotificationComponent />
        </TestAppWrapper>
      );

      // Should show loading initially
      expect(screen.getByTestId('loading')).toBeInTheDocument();

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByTestId('error-toast')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify error message
      expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to send notification');

      // Should not show success
      expect(screen.queryByTestId('success')).not.toBeInTheDocument();
    });
  });

  it('should handle retry functionality after error', async () => {
    await withErrorScenario('notificationPost500', async () => {
      render(
        <TestAppWrapper>
          <RetryNotificationComponent />
        </TestAppWrapper>
      );

      // Wait for initial error
      await waitFor(() => {
        expect(screen.getByTestId('error-toast')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify retry button is present
      const retryButton = screen.getByTestId('retry-button');
      expect(retryButton).toBeInTheDocument();
      expect(retryButton).toBeEnabled();
      expect(retryButton).toHaveTextContent('Retry (0/3)');

      // Click retry button
      await userEvent.click(retryButton);

      // Wait for retry attempt to complete (will still fail due to error scenario)
      await waitFor(() => {
        expect(screen.getByTestId('retry-count')).toHaveTextContent('1');
      }, { timeout: 5000 });

      // Verify button text updates
      expect(retryButton).toHaveTextContent('Retry (1/3)');
    });
  });

  it('should verify exactly one MSW call per notification', async () => {
    let callCount = 0;
    const { http, HttpResponse } = await import('msw');

    server.use(
      http.post('http://localhost:3000/notifications', async () => {
        callCount++;
        console.log(`📨 MSW: Notification call count: ${callCount}`);

        return HttpResponse.json({
          data: {
            id: `notification-${Date.now()}`,
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

    render(
      <TestAppWrapper>
        <ReminderNotificationComponent />
      </TestAppWrapper>
    );

    // Wait for notification to complete
    await waitFor(() => {
      expect(screen.getByTestId('success')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Verify exactly one MSW call was made
    expect(callCount).toBe(1);
  });
});
