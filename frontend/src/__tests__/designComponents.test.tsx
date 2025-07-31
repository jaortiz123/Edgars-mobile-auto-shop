// Sprint 1A Robustness: Design System Component Tests (jsdom Environment)
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from '@testing-library/react';
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
import type { 
  MockGlobalDocument,
  MockGlobalWindow,
  MockComputedStyle,
  MockAccessibilityElement,
  MockPerformanceElement,
  MockStyleSheet
} from '../types/test';

/**
 * Mock DOM for jsdom testing
 */
const mockDocument: MockGlobalDocument = {
  documentElement: {
    style: {
      getPropertyValue: vi.fn(),
      setProperty: vi.fn()
    }
  },
  createElement: vi.fn(),
  querySelectorAll: vi.fn(() => []),
  styleSheets: []
};

const createMockComputedStyle = (overrides: Partial<MockComputedStyle> = {}): MockComputedStyle => ({
  getPropertyValue: vi.fn(),
  fontSize: '16px',
  lineHeight: '1.5',
  fontWeight: '400',
  outlineWidth: '2px',
  margin: '8px',
  ...overrides
});

const mockWindow: MockGlobalWindow = {
  getComputedStyle: vi.fn((_element: Element) => createMockComputedStyle()),
  performance: {
    now: vi.fn(() => Date.now())
  }
};

// Mock globals for jsdom environment  
global.document = mockDocument as unknown as Document;
global.window = mockWindow as unknown as Window & typeof globalThis;

/**
 * Design System Component Tests
 * These tests require DOM access and jsdom environment for:
 * - CSS variable validation
 * - Element accessibility testing  
 * - Performance monitoring with real elements
 * - Development mode DOM features
 */
describe('Design System Component Validation', () => {
  let validator: DesignSystemValidator;
  let performanceMonitor: CSSPerformanceMonitor;

  beforeEach(() => {
    validator = DesignSystemValidator.getInstance();
    performanceMonitor = CSSPerformanceMonitor.getInstance();
    validator.clearLogs();
    performanceMonitor.clearMetrics();
    vi.clearAllMocks();
  });

  afterEach(() => {
    validator.clearLogs();
    performanceMonitor.stopMonitoring();
  });

  describe('CSS Variable Validation', () => {
    it('should validate typography scale CSS variables', () => {
      vi.mocked(mockWindow.getComputedStyle).mockReturnValue(createMockComputedStyle({
        getPropertyValue: vi.fn(() => '1rem')
      }));

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
      vi.mocked(mockWindow.getComputedStyle).mockReturnValue(createMockComputedStyle({
        getPropertyValue: vi.fn(() => '1rem')
      }));

      const isValid = validator.validateSpacingScale('sp-3');
      expect(isValid).toBe(true);
    });

    it('should detect missing CSS variables', () => {
      vi.mocked(mockWindow.getComputedStyle).mockReturnValue(createMockComputedStyle({
        getPropertyValue: vi.fn(() => '')
      }));

      const isValid = validator.validateCSSVariable('--fs-2');
      expect(isValid).toBe(false);
      
      const state = validator.getValidationState();
      expect(state.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Design System Class Validation', () => {
    it('should validate typography classes', () => {
      vi.mocked(mockWindow.getComputedStyle).mockReturnValue(createMockComputedStyle({
        getPropertyValue: vi.fn(() => '1.25rem')
      }));

      const isValid = validator.validateDesignSystemClass('text-fs-3');
      expect(isValid).toBe(true);
    });

    it('should validate spacing classes', () => {
      vi.mocked(mockWindow.getComputedStyle).mockReturnValue(createMockComputedStyle({
        getPropertyValue: vi.fn(() => '1.5rem')
      }));

      const isValid = validator.validateDesignSystemClass('p-sp-4');
      expect(isValid).toBe(true);
    });
  });

  describe('Accessibility Testing', () => {
    it('should validate element accessibility', () => {
      const mockElement: MockAccessibilityElement = {
        getBoundingClientRect: () => ({
          width: 44,
          height: 44,
          top: 0,
          left: 0,
          bottom: 44,
          right: 44,
          x: 0,
          y: 0,
          toJSON: () => ({})
        }),
        matches: () => true
      };

      vi.mocked(mockWindow.getComputedStyle).mockReturnValue(createMockComputedStyle({
        outlineWidth: '2px'
      }));

      const isValid = validator.validateAccessibility(mockElement as unknown as HTMLElement);
      expect(isValid).toBe(true);
    });

    it('should detect accessibility violations', () => {
      const mockElement: MockAccessibilityElement = {
        getBoundingClientRect: () => ({
          width: 20,
          height: 20,
          top: 0,
          left: 0,
          bottom: 20,
          right: 20,
          x: 0,
          y: 0,
          toJSON: () => ({})
        }),
        matches: () => false
      };

      const isValid = validator.validateAccessibility(mockElement as unknown as HTMLElement);
      expect(isValid).toBe(false);
      
      const state = validator.getValidationState();
      expect(state.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Monitoring', () => {
    it('should measure CSS performance', () => {
      vi.mocked(mockWindow.getComputedStyle).mockReturnValue(createMockComputedStyle({
        getPropertyValue: vi.fn(() => '1rem')
      }));

      const startTime = performanceMonitor.startMeasurement('typography-render-test');
      performanceMonitor.endMeasurement('typography-render-test', startTime);
      
      const report = performanceMonitor.getPerformanceReport();
      expect(report.metrics['typography-render-test']).toBeDefined();
    });

    it('should provide optimized CSS variable access', () => {
      vi.mocked(mockWindow.getComputedStyle).mockReturnValue(createMockComputedStyle({
        getPropertyValue: vi.fn(() => '1rem')
      }));

      const value = getOptimizedCSSVariable('--fs-2');
      expect(value).toBe('1rem');
    });

    it('should track CSS measurement performance', () => {
      vi.mocked(mockWindow.getComputedStyle).mockReturnValue(createMockComputedStyle({
        getPropertyValue: vi.fn(() => '1rem')
      }));

      const mockElementWithMethods = {
        getBoundingClientRect: vi.fn(() => ({
          width: 100,
          height: 50,
          top: 0,
          left: 0,
          bottom: 50,
          right: 100,
          x: 0,
          y: 0,
          toJSON: () => ({})
        })),
        getPropertyValue: vi.fn(() => '1rem')
      } as unknown as MockPerformanceElement;

      expect(() => {
        measureCSSPerformance(mockElementWithMethods as unknown as HTMLElement, 'test-measurement');
      }).not.toThrow();
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

      expect(() => {
        validateDesignToken(element, 'typography');
      }).not.toThrow();
    });

    it('should validate CSS runtime state', () => {
      const mockStyleSheets: MockStyleSheet[] = [
        {
          cssRules: [
            { selectorText: '.text-fs-2', style: { fontSize: '1rem' } },
            { selectorText: '.p-sp-3', style: { padding: '1.5rem' } }
          ]
        }
      ];

      mockDocument.styleSheets = mockStyleSheets;

      const TestComponent = () => (
        <div data-testid="runtime-test" className="text-fs-2">
          Runtime Test
        </div>
      );

      render(<TestComponent />);
      const element = screen.getByTestId('runtime-test');

      expect(() => {
        validator.validateRuntimeCSS(element);
      }).not.toThrow();
    });
  });

  describe('CSS Variable Integration', () => {
    it('should get CSS variables correctly', () => {
      vi.mocked(mockWindow.getComputedStyle).mockReturnValue(createMockComputedStyle({
        getPropertyValue: vi.fn(() => '1rem')
      }));

      const value = getCSSVariable('--fs-2');
      expect(value).toBe('1rem');
    });

    it('should create design system classes', () => {
      const classes = createDesignSystemClasses(['fs-2', 'sp-3']);
      expect(classes).toContain('text-fs-2');
      expect(classes).toContain('p-sp-3');
    });

    it('should handle missing CSS variables gracefully', () => {
      vi.mocked(mockWindow.getComputedStyle).mockReturnValue(createMockComputedStyle({
        getPropertyValue: vi.fn(() => '')
      }));

      const value = getCSSVariable('--non-existent');
      expect(value).toBe('');
    });
  });
});
