/* eslint-disable testing-library/prefer-user-event */
import React, { useState, useEffect } from 'react';
import { render, screen, fireEvent, waitFor } from '@test-utils';
import userEvent from '@testing-library/user-event';
import { vi, test, expect, describe, beforeEach } from 'vitest';

// Simple component that triggers state updates for testing act() warnings
const AsyncStateComponent: React.FC = () => {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleAsyncClick = async () => {
    setLoading(true);
    // Simulate async operation
    setTimeout(() => {
      setCount(prev => prev + 1);
      setLoading(false);
    }, 100);
  };

  const handleSyncClick = () => {
    setCount(prev => prev + 1);
  };

  useEffect(() => {
    // Simulate component effect that updates state
    const timer = setTimeout(() => {
      setCount(prev => prev + 10);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div>
      <div data-testid="count">Count: {count}</div>
      <div data-testid="loading">{loading ? 'Loading...' : 'Ready'}</div>
      <button data-testid="async-button" onClick={handleAsyncClick}>
        Async Click
      </button>
      <button data-testid="sync-button" onClick={handleSyncClick}>
        Sync Click
      </button>
    </div>
  );
};

describe('P1-T-005: React act() Warnings Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('SHOULD trigger act() warnings with unwrapped fireEvent', async () => {
    render(<AsyncStateComponent />);

    // Wait for initial effect to complete
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('Count: 10');
    });

    // This should trigger act() warning - UNWRAPPED fireEvent
    fireEvent.click(screen.getByTestId('async-button'));

    // Wait for async state update
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('Count: 11');
    }, { timeout: 200 });
  });

  test('SHOULD NOT trigger act() warnings with userEvent', async () => {
    const user = userEvent.setup();
    render(<AsyncStateComponent />);

    // Wait for initial effect to complete
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('Count: 10');
    });

    // This should NOT trigger act() warning - userEvent handles act() internally
    await user.click(screen.getByTestId('sync-button'));

    expect(screen.getByTestId('count')).toHaveTextContent('Count: 11');
  });

  test('sync fireEvent should NOT trigger act() warnings', async () => {
    render(<AsyncStateComponent />);

    // Wait for initial effect to complete
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('Count: 10');
    });

    // This should NOT trigger act() warning - synchronous update
    fireEvent.click(screen.getByTestId('sync-button'));

    expect(screen.getByTestId('count')).toHaveTextContent('Count: 11');
  });

  test('multiple rapid fireEvent calls should trigger act() warnings', async () => {
    render(<AsyncStateComponent />);

    // Wait for initial effect to complete
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('Count: 10');
    });

    // Multiple rapid calls that cause async state updates - should trigger warnings
    fireEvent.click(screen.getByTestId('async-button'));
    fireEvent.click(screen.getByTestId('async-button'));
    fireEvent.click(screen.getByTestId('async-button'));

    // Wait for all updates to complete
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('Count: 13');
    }, { timeout: 500 });
  });
});
