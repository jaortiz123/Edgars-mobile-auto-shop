// Sprint 1A Robustness: Simple Design System JSX Environment Test
import { describe, it, expect } from "vitest";
import { render, screen } from '@testing-library/react';
import React from 'react';

/**
 * Simple Design System JSX Tests
 * Tests JSX component rendering with design system classes in jsdom environment.
 * This validates that:
 * 1. JSX compilation works correctly
 * 2. Design system CSS classes can be applied
 * 3. jsdom environment provides proper DOM APIs
 * 4. React Testing Library integration works
 */

// Test components using design system classes
const TypographyTestComponent: React.FC<{ scale?: string; className?: string }> = ({
  scale = "fs-2",
  className = ""
}) => (
  <div className={`text-${scale} ${className}`.trim()} data-testid="typography-component">
    Typography Test
  </div>
);

const SpacingTestComponent: React.FC<{ spacing?: string; className?: string }> = ({
  spacing = "sp-3",
  className = ""
}) => (
  <div className={`p-${spacing} ${className}`.trim()} data-testid="spacing-component">
    Spacing Test
  </div>
);

const CombinedTestComponent: React.FC = () => (
  <div className="text-fs-3 p-sp-2 m-sp-1" data-testid="combined-component">
    <h1 className="text-fs-5 font-semibold">Design System Test</h1>
    <p className="text-fs-2 leading-normal">This tests multiple design system utilities.</p>
  </div>
);

describe('Design System JSX Environment Tests', () => {
  describe('Typography Scale Rendering', () => {
    it('should render typography component with design system class', () => {
      render(<TypographyTestComponent scale="fs-2" />);

      const element = screen.getByTestId('typography-component');
      expect(element).toBeInTheDocument();
      expect(element).toHaveClass('text-fs-2');
      expect(element).toHaveTextContent('Typography Test');
    });

    it('should render different typography scales', () => {
      const scales = ['fs-1', 'fs-3', 'fs-4', 'fs-5'];

      scales.forEach((scale, index) => {
        const { unmount } = render(<TypographyTestComponent scale={scale} />);
        const element = screen.getByTestId('typography-component');

        expect(element).toHaveClass(`text-${scale}`);
        expect(element).toHaveTextContent('Typography Test');

        unmount(); // Clean up for next iteration
      });
    });

    it('should handle custom className prop', () => {
      render(<TypographyTestComponent scale="fs-3" className="font-bold text-red-500" />);

      const element = screen.getByTestId('typography-component');
      expect(element).toHaveClass('text-fs-3');
      expect(element).toHaveClass('font-bold');
      expect(element).toHaveClass('text-red-500');
    });
  });

  describe('Spacing Scale Rendering', () => {
    it('should render spacing component with design system class', () => {
      render(<SpacingTestComponent spacing="sp-3" />);

      const element = screen.getByTestId('spacing-component');
      expect(element).toBeInTheDocument();
      expect(element).toHaveClass('p-sp-3');
      expect(element).toHaveTextContent('Spacing Test');
    });

    it('should render different spacing scales', () => {
      const spacings = ['sp-0', 'sp-1', 'sp-2', 'sp-4', 'sp-6'];

      spacings.forEach((spacing) => {
        const { unmount } = render(<SpacingTestComponent spacing={spacing} />);
        const element = screen.getByTestId('spacing-component');

        expect(element).toHaveClass(`p-${spacing}`);
        expect(element).toHaveTextContent('Spacing Test');

        unmount();
      });
    });

    it('should handle zero spacing (sp-0)', () => {
      render(<SpacingTestComponent spacing="sp-0" />);

      const element = screen.getByTestId('spacing-component');
      expect(element).toHaveClass('p-sp-0');
    });
  });

  describe('Combined Design System Usage', () => {
    it('should render component with multiple design system classes', () => {
      render(<CombinedTestComponent />);

      const element = screen.getByTestId('combined-component');
      expect(element).toBeInTheDocument();
      expect(element).toHaveClass('text-fs-3');
      expect(element).toHaveClass('p-sp-2');
      expect(element).toHaveClass('m-sp-1');
    });

    it('should render nested elements with design system classes', () => {
      render(<CombinedTestComponent />);

      const heading = screen.getByText('Design System Test');
      expect(heading).toHaveClass('text-fs-5');
      expect(heading).toHaveClass('font-semibold');

      const paragraph = screen.getByText('This tests multiple design system utilities.');
      expect(paragraph).toHaveClass('text-fs-2');
      expect(paragraph).toHaveClass('leading-normal');
    });
  });

  describe('JSX Environment Validation', () => {
    it('should have access to DOM APIs', () => {
      expect(typeof document).toBe('object');
      expect(typeof window).toBe('object');
      expect(typeof document.createElement).toBe('function');
      expect(typeof window.getComputedStyle).toBe('function');
    });

    it('should support CSS class manipulation in jsdom', () => {
      const element = document.createElement('div');
      element.className = 'text-fs-2 p-sp-3';

      expect(element.classList.contains('text-fs-2')).toBe(true);
      expect(element.classList.contains('p-sp-3')).toBe(true);

      element.classList.add('m-sp-2');
      expect(element.classList.contains('m-sp-2')).toBe(true);

      element.classList.remove('text-fs-2');
      expect(element.classList.contains('text-fs-2')).toBe(false);
    });

    it('should support React component rendering and unmounting', () => {
      const { unmount } = render(<TypographyTestComponent />);

      expect(screen.getByTestId('typography-component')).toBeInTheDocument();

      unmount();

      expect(screen.queryByTestId('typography-component')).not.toBeInTheDocument();
    });

    it('should support element attribute access', () => {
      render(<TypographyTestComponent scale="fs-4" />);

      const element = screen.getByTestId('typography-component');
      expect(element.getAttribute('data-testid')).toBe('typography-component');
      expect(element.tagName.toLowerCase()).toBe('div');
    });

    it('should support style property access', () => {
      render(<div data-testid="style-test" style={{ color: 'red', fontSize: 'var(--fs-2, 1rem)' }} />);

      const element = screen.getByTestId('style-test');
      expect(element.style.color).toBe('red');
      expect(element.style.fontSize).toBe('var(--fs-2, 1rem)');
    });
  });

  describe('Error Boundary Testing', () => {
    it('should handle missing props gracefully', () => {
      // Test with minimal props
      expect(() => {
        render(<TypographyTestComponent />);
      }).not.toThrow();

      const element = screen.getByTestId('typography-component');
      expect(element).toHaveClass('text-fs-2'); // default scale
    });

    it('should handle empty className prop', () => {
      expect(() => {
        render(<TypographyTestComponent scale="fs-1" className="" />);
      }).not.toThrow();

      const element = screen.getByTestId('typography-component');
      expect(element).toHaveClass('text-fs-1');
    });

    it('should handle undefined scale gracefully', () => {
      expect(() => {
        render(<TypographyTestComponent scale={undefined} />);
      }).not.toThrow();

      const element = screen.getByTestId('typography-component');
      expect(element).toHaveClass('text-undefined'); // This will render as-is, which is fine
    });
  });
});
