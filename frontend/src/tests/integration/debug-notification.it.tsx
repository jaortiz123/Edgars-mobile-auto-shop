import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { server } from '../../test/server/mswServer';
import { withErrorScenario } from '../../test/errorTestHelpersCanonical';

// Simple test wrapper
export const TestAppWrapper = ({ children }: { children: React.ReactNode }) => {
  return <div>{children}</div>;
};

// Mock notification component for testing
export const DebugNotificationComponent = () => {
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const sendNotification = async () => {
    try {
      setError(null);
      setLoading(true);
      const response = await fetch('/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'test', appointmentId: 'test', message: 'test' })
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
    <div data-testid="debug-component">
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

describe('Debug Notification Tests', () => {
  // Centralized server lifecycle handled in jest.setup.ts; only per-test resets needed if we add handlers
  beforeEach(() => server.resetHandlers());

  it('should display error message when notification fails', async () => {
    await withErrorScenario('notificationPost500', async () => {
      render(
        <TestAppWrapper>
          <DebugNotificationComponent />
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
    });
  });

  it('should display success when notification succeeds', async () => {
    render(
      <TestAppWrapper>
        <DebugNotificationComponent />
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
});
