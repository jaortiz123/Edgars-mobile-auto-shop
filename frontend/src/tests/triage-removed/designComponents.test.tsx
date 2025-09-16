// Sprint 1A Robustness: Design System Component Tests (jsdom Environment)
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from '@test-utils';
import {
  DesignSystemValidator,
  getCSSVariable,
  createDesignSystemClasses,
  validateDesignToken
} from '@/utils/designSystemValidator';
import {
  CSSPerformanceMonitor,
  measureCSSPerformance,
  getOptimizedCSSVariable
} from '@/utils/cssPerformanceMonitor';

/**
 * Design System Component Tests
 * These tests rely on the global JSDOM CSS environment setup in setup.ts
 * All CSS variables are pre-injected and getComputedStyle is globally mocked
 */
describe('Design System Component Validation', () => {
  let validator: DesignSystemValidator;
  let performanceMonitor: CSSPerformanceMonitor;

  beforeEach(() => {
    validator = DesignSystemValidator.getInstance();
    performanceMonitor = CSSPerformanceMonitor.getInstance();
    validator.clearLogs();
    performanceMonitor.clearMetrics();
  });

  afterEach(() => {
    validator.clearLogs();
    performanceMonitor.stopMonitoring();
  });

  describe('CSS Variable Validation', () => {
    it('should validate typography scale CSS variables', () => {
      // Using global JSDOM CSS setup from setup.ts - no per-test mocks needed
      const isValid = validator.validateTypographyScale('fs-2');
      expect(isValid).toBe(true);
    });

    it('should detect invalid typography scale', () => {
      const isValid = validator.validateTypographyScale('fs-invalid');
      expect(isValid).toBe(false);

      const state = validator.getValidationState();
      expect(state.warnings.length).toBeGreaterThan(0);
    });

    it('should validate spacing scale CSS variables', () => {
      // Using global CSS variable setup - sp-3 should be available
      const isValid = validator.validateSpacingScale('sp-3');
      expect(isValid).toBe(true);
    });

    it('should detect missing CSS variables', () => {
      // Test with a variable that doesn't exist in our global setup
      const isValid = validator.validateCSSVariable('--non-existent-variable');
      expect(isValid).toBe(false);

      const state = validator.getValidationState();
      expect(state.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Design System Class Validation', () => {
    it('should validate typography classes', () => {
      // Global setup should have fs-3 available
      const isValid = validator.validateDesignSystemClass('text-fs-3');
      expect(isValid).toBe(true);
    });

    it('should validate spacing classes', () => {
      // Global setup should have sp-4 available
      const isValid = validator.validateDesignSystemClass('p-sp-4');
      expect(isValid).toBe(true);
    });
  });

  describe('Accessibility Testing', () => {
    it('should validate element accessibility', () => {
      // Create a proper DOM element with good accessibility
      const element = document.createElement('button');
      element.style.width = '44px';
      element.style.height = '44px';
      element.style.outline = '2px solid blue';

      const isValid = validator.validateAccessibility(element);
      expect(isValid).toBe(true);
    });

    it('should detect accessibility violations', () => {
      // Create an element that fails accessibility checks
      const element = document.createElement('button');
      element.style.width = '20px';  // Too small for touch target
      element.style.height = '20px';

      const isValid = validator.validateAccessibility(element);
      expect(isValid).toBe(false);

      const state = validator.getValidationState();
      expect(state.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Monitoring', () => {
    it('should measure CSS performance', () => {
      // Test the performance measurement utility
      const { result, duration } = measureCSSPerformance('test-operation', () => {
        return 'test-result';
      });

      expect(result).toBe('test-result');
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should provide optimized CSS variable access', () => {
      // Test CSS variable access using global setup
      const value = getOptimizedCSSVariable('--fs-2');
      expect(value).toBe('1rem'); // From our global setup
    });

    it('should track CSS measurement performance', () => {
      // Create a real DOM element for performance testing
      const element = document.createElement('div');
      element.style.fontSize = '1rem';
      document.body.appendChild(element);

      // Test that performance measurement doesn't throw
      expect(() => {
        performanceMonitor.measureTypographyRender(element, 'test-typography');
      }).not.toThrow();

      // Cleanup
      document.body.removeChild(element);
    });
  });

  describe('Design Token Validation', () => {
    it('should validate design tokens', () => {
      const TestComponent = () => (
        <div data-testid="test-component" className="text-fs-2 p-sp-3">
          Test Component
        </div>
      );

      render(<TestComponent />);
      const element = screen.getByTestId('test-component');

      // Test design token validation
      expect(() => {
        validateDesignToken('typography', 'fs-2');
      }).not.toThrow();

      expect(() => {
        validateDesignToken('spacing', 'sp-3');
      }).not.toThrow();
    });

    it('should validate CSS runtime state', () => {
      const TestComponent = () => (
        <div data-testid="runtime-test" className="text-fs-2">
          Runtime Test
        </div>
      );

      render(<TestComponent />);
      const element = screen.getByTestId('runtime-test');

      // Test runtime CSS validation
      expect(() => {
        validator.validateRuntimeCSS();
      }).not.toThrow();
    });
  });

  describe('CSS Variable Integration', () => {
    it('should get CSS variables correctly', () => {
      // Test CSS variable getter with global setup
      const value = getCSSVariable('--fs-2');
      expect(value).toBe('1rem'); // From global setup
    });

    it('should create design system classes', () => {
      // Test class generation utility - fix the API usage
      const classes = createDesignSystemClasses('text-fs-2', 'p-sp-3');
      expect(classes).toContain('text-fs-2');
      expect(classes).toContain('p-sp-3');
    });

    it('should handle missing CSS variables gracefully', () => {
      // Test with fallback for missing variable
      const value = getCSSVariable('--non-existent', 'fallback');
      expect(value).toBe('fallback');
    });
  });
});
