// Design System Component Tests (JSdom Environment)
// P1-T-013: Separated from utils for proper environment isolation

import { render, screen } from '@testing-library/react';
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

describe('Design System Components (JSdom)', () => {
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
    // These APIs should be available in jsdom environment
    expect(document).toBeDefined();
    expect(window).toBeDefined();
    expect(document.createElement).toBeDefined();
    expect(getComputedStyle).toBeDefined();
  });

  test('can query DOM elements for class validation', () => {
    render(<DesignSystemComponent scale="fs-4" spacing="sp-1" />);

    const element = screen.getByTestId('design-system-component');
    const styles = window.getComputedStyle(element);

    // In jsdom, computed styles might be empty, but the API should exist
    expect(styles).toBeDefined();
    expect(typeof styles.getPropertyValue).toBe('function');
  });

  test('validates accessibility attributes on components', () => {
    render(
      <DesignSystemComponent>
        <button aria-label="Test button">Click me</button>
      </DesignSystemComponent>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Test button');
  });

  test('validates responsive design system classes', () => {
    const ResponsiveComponent = () => (
      <div
        className="text-fs-1 md:text-fs-3 lg:text-fs-4"
        data-testid="responsive-component"
      >
        Responsive Text
      </div>
    );

    render(<ResponsiveComponent />);

    const element = screen.getByTestId('responsive-component');
    expect(element).toHaveClass('text-fs-1');
    expect(element).toHaveClass('md:text-fs-3');
    expect(element).toHaveClass('lg:text-fs-4');
  });
});
