/**
 * P2-T-007: Notification System Integration Tests - Debug Version
 *
 * This version is purely for debugging the waitFor timing issue.
 */

import React from 'react';
import { render, screen, waitFor } from '@test-utils';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { server } from '../../test/server/mswServer';

beforeAll(() => vi.useFakeTimers());
afterAll(() => vi.useRealTimers());

// Simple test wrapper
export const TestAppWrapper = ({ children }: { children: React.ReactNode }) => {
  return <div>{children}</div>;
};

// Ultra-simple notification component
export const DebugNotificationComponent = () => {
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const sendNotification = async () => {
    try {
      setError(null);
      setLoading(true);
      console.log('🔵 About to send notification...');

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
      console.log('🟢 Success - about to set loading false:', result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.log('🔴 Error - about to set error:', errorMessage);
      setError(errorMessage);
    } finally {
      console.log('🔵 Setting loading to false...');
      setLoading(false);
      console.log('🔵 Loading set to false');
    }
  };

  React.useEffect(() => {
    console.log('🔵 Component mounted, sending notification...');
    sendNotification();
  }, []);

  console.log('🔵 Render - loading:', loading, 'error:', error);

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
  beforeAll(() => {
    vi.useFakeTimers();
    console.log('🚀 Starting MSW server for debug tests...');
    server.listen({ onUnhandledRequest: 'warn' });
    console.log('🌐 MSW enabled for debug tests');
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

  it('should successfully send notification with detailed logging', async () => {
    console.log('🧪 Starting test...');

    render(
      <TestAppWrapper>
        <DebugNotificationComponent />
      </TestAppWrapper>
    );

    console.log('🧪 Component rendered, checking for loading...');

    // Should show loading initially
    expect(screen.getByTestId('loading')).toBeInTheDocument();
    console.log('🧪 Loading confirmed, waiting for success...');

    // Wait with more detailed logging
    await waitFor(() => {
      const component = screen.getByTestId('debug-component');
      console.log('🔍 Current HTML:', component.innerHTML);

      const successElement = screen.queryByTestId('success');
      console.log('🔍 Success element found:', !!successElement);

      if (!successElement) {
        throw new Error('Success element not found yet');
      }

      expect(successElement).toBeInTheDocument();
    }, { timeout: 15000, interval: 100 });

    console.log('🧪 Success found! Test completed.');

    // Should not show error
    expect(screen.queryByTestId('error-toast')).not.toBeInTheDocument();
  }, 20000);
});
