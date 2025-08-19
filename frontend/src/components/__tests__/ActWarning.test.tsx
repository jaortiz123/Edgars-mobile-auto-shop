/* eslint-disable testing-library/prefer-user-event */

import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { test, expect, describe } from 'vitest';

// Simple test component to trigger act() warnings
const AsyncComponent: React.FC = () => {
  const [count, setCount] = useState(0);

  const handleAsyncClick = () => {
    // This async setState should trigger act() warning when not wrapped
    setTimeout(() => setCount(prev => prev + 1), 10);
  };

  return (
    <div>
      <div data-testid="count">{count}</div>
      <button data-testid="async-btn" onClick={handleAsyncClick}>
        Async Update
      </button>
    </div>
  );
};

describe('Act Warning Detection', () => {
  test('unwrapped fireEvent should trigger act() warning', async () => {
    render(<AsyncComponent />);

    // This should trigger act() warning because of async state update
    fireEvent.click(screen.getByTestId('async-btn'));

    // Wait for async update
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('1');
    });
  });
});
