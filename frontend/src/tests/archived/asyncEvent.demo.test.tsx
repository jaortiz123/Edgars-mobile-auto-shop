/**
 * ACT-HELPER-001 Demonstration Test
 * Shows usage of asyncEvent helper vs manual act() wrapping
 */

/* eslint-disable testing-library/no-unnecessary-act */
/* eslint-disable testing-library/prefer-user-event */

import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@test-utils';
import { describe, test, expect } from 'vitest';
import { asyncEvent, asyncClick, asyncChange, wrapUserAction } from '../test-utils/asyncEvent';

// Demo component that triggers async state updates
const AsyncFormComponent: React.FC = () => {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    // Simulate async form submission
    setTimeout(() => {
      setSubmitted(true);
    }, 10);
  };

  return (
    <div>
      <input
        data-testid="form-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter text"
      />
      <button
        data-testid="submit-button"
        onClick={handleSubmit}
        disabled={!value.trim()}
      >
        Submit
      </button>
      {submitted && <div data-testid="success-message">Form submitted!</div>}
    </div>
  );
};

describe('ACT-HELPER-001: AsyncEvent Helper Demonstration', () => {

  test('OLD WAY: Manual act() wrapping (verbose)', async () => {
    render(<AsyncFormComponent />);

    const input = screen.getByTestId('form-input');
    const button = screen.getByTestId('submit-button');

    // Old way: Manual act() wrapping for each fireEvent
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Test input' } });
    });

    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(screen.getByTestId('success-message')).toBeInTheDocument();
    });
  });

  test('NEW WAY: asyncEvent helper (clean)', async () => {
    render(<AsyncFormComponent />);

    const input = screen.getByTestId('form-input');
    const button = screen.getByTestId('submit-button');

    // New way: Clean asyncEvent helper
    await asyncEvent(() => {
      fireEvent.change(input, { target: { value: 'Test input' } });
    });

    await asyncEvent(() => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(screen.getByTestId('success-message')).toBeInTheDocument();
    });
  });

  test('CONVENIENCE: Using asyncChange and asyncClick helpers', async () => {
    render(<AsyncFormComponent />);

    const input = screen.getByTestId('form-input');
    const button = screen.getByTestId('submit-button');

    // Even cleaner with convenience methods
    await asyncChange(input, 'Test input');
    await asyncClick(button);

    await waitFor(() => {
      expect(screen.getByTestId('success-message')).toBeInTheDocument();
    });
  });

  test('BULK OPERATIONS: Multiple events in single asyncEvent call', async () => {
    render(<AsyncFormComponent />);

    const input = screen.getByTestId('form-input');
    const button = screen.getByTestId('submit-button');

    // Multiple fireEvent calls in single asyncEvent wrapper
    await asyncEvent(() => {
      fireEvent.change(input, { target: { value: 'Bulk operation' } });
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(screen.getByTestId('success-message')).toBeInTheDocument();
    });
  });

  test('SEMANTIC ALIAS: Using wrapUserAction for clarity', async () => {
    render(<AsyncFormComponent />);

    const input = screen.getByTestId('form-input');
    const button = screen.getByTestId('submit-button');

    // Semantic alias for better readability
    await wrapUserAction(() => {
      fireEvent.change(input, { target: { value: 'User action' } });
    });

    await wrapUserAction(() => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(screen.getByTestId('success-message')).toBeInTheDocument();
    });
  });
});
