// Sprint 1A Robustness: Design System JSX Environment Test
import { render, screen } from '@test-utils';
import { test, expect, describe } from 'vitest';
import React from 'react';

// Test component using design system classes
const DesignSystemComponent: React.FC<{
  scale?: string;
  spacing?: string;
  children?: React.ReactNode;
}> = ({
  scale = "fs-2",
  spacing = "sp-3",
  children = "Design System Test"
}) => (
  <div
    className={`text-${scale} p-${spacing}`}
    data-testid="design-system-component"
  >
    {children}
  </div>
);

// Simple standalone tests
test('renders design system component with typography and spacing classes', () => {
  render(<DesignSystemComponent scale="fs-3" spacing="sp-2" />);

  const element = screen.getByTestId('design-system-component');
  expect(element).toBeInTheDocument();
  expect(element).toHaveClass('text-fs-3');
  expect(element).toHaveClass('p-sp-2');
  expect(element).toHaveTextContent('Design System Test');
});

test('renders with default design system values', () => {
  render(<DesignSystemComponent />);

  const element = screen.getByTestId('design-system-component');
  expect(element).toHaveClass('text-fs-2'); // default
  expect(element).toHaveClass('p-sp-3');    // default
});

test('supports custom children content', () => {
  render(<DesignSystemComponent>Custom Content</DesignSystemComponent>);

  const element = screen.getByTestId('design-system-component');
  expect(element).toHaveTextContent('Custom Content');
});

test('validates jsdom environment has DOM APIs', () => {
  expect(typeof document).toBe('object');
  expect(typeof window).toBe('object');
  expect(typeof document.createElement).toBe('function');
});

test('supports CSS class manipulation in jsdom', () => {
  const element = document.createElement('div');
  element.className = 'text-fs-2 p-sp-3';

  expect(element.classList.contains('text-fs-2')).toBe(true);
  expect(element.classList.contains('p-sp-3')).toBe(true);

  element.classList.add('m-sp-2');
  expect(element.classList.contains('m-sp-2')).toBe(true);
});

// Grouped tests in describe block
describe('Design System Typography Scales', () => {
  test('renders different typography scales correctly', () => {
    const scales = ['fs-1', 'fs-3', 'fs-4'];

    scales.forEach((scale) => {
      const { unmount } = render(<DesignSystemComponent scale={scale} />);
      const element = screen.getByTestId('design-system-component');
      expect(element).toHaveClass(`text-${scale}`);
      unmount();
    });
  });

  test('handles edge case scales', () => {
    // Test minimum scale
    render(<DesignSystemComponent scale="fs-0" />);
    expect(screen.getByTestId('design-system-component')).toHaveClass('text-fs-0');
  });
});

describe('Design System Spacing Scales', () => {
  test('renders different spacing scales correctly', () => {
    const spacings = ['sp-0', 'sp-1', 'sp-2', 'sp-4'];

    spacings.forEach((spacing) => {
      const { unmount } = render(<DesignSystemComponent spacing={spacing} />);
      const element = screen.getByTestId('design-system-component');
      expect(element).toHaveClass(`p-${spacing}`);
      unmount();
    });
  });

  test('handles zero spacing correctly', () => {
    render(<DesignSystemComponent spacing="sp-0" />);
    const element = screen.getByTestId('design-system-component');
    expect(element).toHaveClass('p-sp-0');
  });
});
