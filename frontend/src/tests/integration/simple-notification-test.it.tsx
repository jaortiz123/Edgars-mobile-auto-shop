import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { server } from '../../test/server/mswServer';
import { withErrorScenario } from '../../test/errorTestHelpersCanonical';

// Simple test wrapper
export const TestAppWrapper = ({ children }: { children: React.ReactNode }) => {
  return <div>{children}</div>;
};

// Minimal notification component for testing
export const SimpleNotificationComponent = () => {
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
      console.log('🔥 Setting error:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    sendNotification();
  }, []);

  console.log('🎯 Current state - loading:', loading, 'error:', error);

  return (
    <div data-testid="simple-component">
      {loading && <div data-testid="loading">Loading...</div>}
      {error && (
        <div data-testid="error-toast" className="error-toast">
          <span data-testid="error-message">{error}</span>
          <button data-testid="retry-button">Retry</button>
        </div>
      )}
      {!loading && !error && <div data-testid="success">Success!</div>}
      <div data-testid="debug-state">
        Error: {error || 'none'}, Loading: {loading ? 'true' : 'false'}
      </div>
    </div>
  );
};

describe('Simple Notification Tests', () => {
  beforeAll(() => {
    console.log('🚀 Starting MSW server...');
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    server.resetHandlers();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it('should display error toast when notification fails', async () => {
    await withErrorScenario('notificationPost500', async () => {
      render(
        <TestAppWrapper>
          <SimpleNotificationComponent />
        </TestAppWrapper>
      );

      // Wait for component to mount
      expect(screen.getByTestId('simple-component')).toBeInTheDocument();

      // Check debug state updates
      await waitFor(() => {
        const debugState = screen.getByTestId('debug-state');
        expect(debugState).toHaveTextContent('Error: Failed to send notification');
      }, { timeout: 10000 });

      // Now check if error toast appears
      await waitFor(() => {
        expect(screen.getByTestId('error-toast')).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to send notification');
      expect(screen.getByTestId('retry-button')).toBeInTheDocument();
    });
  });

  it('should display success when notification succeeds', async () => {
    render(
      <TestAppWrapper>
        <SimpleNotificationComponent />
      </TestAppWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('success')).toBeInTheDocument();
    });
  });
});
