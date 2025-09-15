// Sprint 1A Robustness: Minimal Design System JSX Test
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@test-utils';
import { test, expect } from 'vitest';
import React from 'react';

test('minimal design system jsx test', () => {
  const TestComponent = () => (
    <div data-testid="test" className="text-fs-2 p-sp-3">
      Test
    </div>
  );

  render(<TestComponent />);

  const element = screen.getByTestId('test');
  expect(element).toBeInTheDocument();
  expect(element).toHaveClass('text-fs-2');
  expect(element).toHaveClass('p-sp-3');
});
