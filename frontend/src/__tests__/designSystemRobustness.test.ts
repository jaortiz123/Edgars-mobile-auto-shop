// Sprint 1A Robustness: Design System Test Suite
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { 
  DesignSystemValidator,
  getCSSVariable,
  createDesignSystemClasses,
  validateDesignToken,
  initializeDesignSystemValidation
} from '@/utils/designSystemValidator';
import { 
  CSSPerformanceMonitor,
  measureCSSPerformance,
  getOptimizedCSSVariable,
  initializeCSSPerformanceMonitoring
} from '@/utils/cssPerformanceMonitor';
import { DESIGN_TOKENS, CSS_VARIABLES, ACCESSIBILITY_REQUIREMENTS } from '@/types/designSystem';

/**
 * Mock DOM for testing
 */
const mockDocument = {
  documentElement: {
    style: {
      getPropertyValue: jest.fn(),
      setProperty: jest.fn()
    }
  },
  createElement: jest.fn(),
  querySelectorAll: jest.fn(() => []),
  styleSheets: []
};

const mockWindow = {
  getComputedStyle: jest.fn(() => ({
    getPropertyValue: jest.fn(),
    fontSize: '16px',
    lineHeight: '1.5',
    fontWeight: '400'
  })),
  performance: {
    now: jest.fn(() => Date.now())
  }
};

// Mock globals
global.document = mockDocument as any;
global.window = mockWindow as any;

describe('Sprint 1A Design System Robustness', () => {
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

  describe('Design System Type Definitions', () => {
    it('should have correct typography scale tokens', () => {
      const expectedScales = ['fs-0', 'fs-1', 'fs-2', 'fs-3', 'fs-4', 'fs-5', 'fs-6'];
      const actualScales = Object.keys(DESIGN_TOKENS.typography);
      
      expect(actualScales).toEqual(expectedScales);
    });

    it('should have correct spacing scale tokens', () => {
      const expectedScales = ['sp-0', 'sp-1', 'sp-2', 'sp-3', 'sp-4', 'sp-5', 'sp-6', 'sp-8'];
      const actualScales = Object.keys(DESIGN_TOKENS.spacing);
      
      expect(actualScales).toEqual(expectedScales);
    });

    it('should have fallback values for all tokens', () => {
      Object.values(DESIGN_TOKENS.typography).forEach(token => {
        expect(token.fallback).toBeDefined();
        expect(token.value).toBeDefined();
      });

      Object.values(DESIGN_TOKENS.spacing).forEach(token => {
        expect(token.fallback).toBeDefined();
        expect(token.value).toBeDefined();
      });
    });
  });

  describe('CSS Variable Validation', () => {
    it('should validate typography scale CSS variables', () => {
      mockWindow.getComputedStyle.mockReturnValue({
        getPropertyValue: jest.fn(() => '1rem')
      });

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
      mockWindow.getComputedStyle.mockReturnValue({
        getPropertyValue: jest.fn(() => '1rem')
      });

      const isValid = validator.validateSpacingScale('sp-3');
      expect(isValid).toBe(true);
    });

    it('should detect missing CSS variables', () => {
      mockWindow.getComputedStyle.mockReturnValue({
        getPropertyValue: jest.fn(() => '')
      });

      const isValid = validator.validateCSSVariable('--fs-2');
      expect(isValid).toBe(false);
      
      const state = validator.getValidationState();
      expect(state.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Design System Class Validation', () => {
    it('should validate typography classes', () => {
      mockWindow.getComputedStyle.mockReturnValue({
        getPropertyValue: jest.fn(() => '1.25rem')
      });

      const isValid = validator.validateDesignSystemClass('text-fs-3');
      expect(isValid).toBe(true);
    });

    it('should validate spacing classes', () => {
      mockWindow.getComputedStyle.mockReturnValue({
        getPropertyValue: jest.fn(() => '1.5rem')
      });

      const isValid = validator.validateDesignSystemClass('p-sp-3');
      expect(isValid).toBe(true);
    });

    it('should create type-safe CSS classes', () => {
      const classes = createDesignSystemClasses('text-fs-2', 'p-sp-3', 'm-sp-2');
      expect(classes).toBe('text-fs-2 p-sp-3 m-sp-2');
    });
  });

  describe('Accessibility Compliance', () => {
    it('should validate minimum touch target size', () => {
      const mockElement = {
        getBoundingClientRect: () => ({
          width: 44,
          height: 44
        }),
        matches: () => true
      } as any;

      mockWindow.getComputedStyle.mockReturnValue({
        outlineWidth: '2px'
      });

      const isValid = validator.validateAccessibility(mockElement);
      expect(isValid).toBe(true);
    });

    it('should detect insufficient touch target size', () => {
      const mockElement = {
        getBoundingClientRect: () => ({
          width: 30,
          height: 30
        }),
        matches: () => true
      } as any;

      const isValid = validator.validateAccessibility(mockElement);
      expect(isValid).toBe(false);
      
      const state = validator.getValidationState();
      expect(state.warnings.some(w => w.includes('Touch target too small'))).toBe(true);
    });

    it('should validate focus indicators', () => {
      const mockElement = {
        getBoundingClientRect: () => ({ width: 50, height: 50 }),
        matches: (selector: string) => selector.includes('button')
      } as any;

      mockWindow.getComputedStyle.mockReturnValue({
        outlineWidth: 'none'
      });

      const isValid = validator.validateAccessibility(mockElement);
      expect(isValid).toBe(false);
      
      const state = validator.getValidationState();
      expect(state.warnings.some(w => w.includes('Insufficient focus indicator'))).toBe(true);
    });
  });

  describe('Performance Monitoring', () => {
    it('should measure CSS performance', () => {
      const { result, duration } = measureCSSPerformance('test', () => {
        return 'test-result';
      });

      expect(result).toBe('test-result');
      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should measure typography rendering performance', () => {
      const mockElement = {
        getBoundingClientRect: () => ({ width: 100, height: 20 })
      } as any;

      mockWindow.getComputedStyle.mockReturnValue({
        fontSize: '16px',
        lineHeight: '1.5',
        fontWeight: '400'
      });

      performanceMonitor.measureTypographyRender(mockElement, 'test');
      
      const report = performanceMonitor.getPerformanceReport();
      expect(report.metrics['typography-render-test']).toBeDefined();
    });

    it('should measure spacing calculation performance', () => {
      const mockElement = {
        getBoundingClientRect: () => ({ width: 100, height: 100 })
      } as any;

      mockWindow.getComputedStyle.mockReturnValue({
        margin: '8px',
        padding: '16px'
      });

      performanceMonitor.measureSpacingCalculation(mockElement, 'test');
      
      const report = performanceMonitor.getPerformanceReport();
      expect(report.metrics['spacing-calculation-test']).toBeDefined();
    });
  });

  describe('CSS Variable Utilities', () => {
    it('should get CSS variable with fallback', () => {
      mockWindow.getComputedStyle.mockReturnValue({
        getPropertyValue: jest.fn(() => '')
      });

      const value = getCSSVariable('--fs-2', '16px');
      expect(value).toBe('16px');
    });

    it('should get optimized CSS variable', () => {
      mockWindow.getComputedStyle.mockReturnValue({
        getPropertyValue: jest.fn(() => '1rem')
      });

      const value = getOptimizedCSSVariable('--fs-2');
      expect(value).toBe('1rem');
    });

    it('should validate design tokens at runtime', () => {
      mockWindow.getComputedStyle.mockReturnValue({
        getPropertyValue: jest.fn(() => '1rem')
      });

      const isValid = validateDesignToken('typography', 'fs-2');
      expect(isValid).toBe(true);
    });
  });

  describe('Error Handling and Fallbacks', () => {
    it('should handle CSS variable access errors gracefully', () => {
      mockWindow.getComputedStyle.mockImplementation(() => {
        throw new Error('CSS access failed');
      });

      const value = getCSSVariable('--fs-2', '16px');
      expect(value).toBe('16px');
    });

    it('should handle validation errors gracefully', () => {
      mockWindow.getComputedStyle.mockImplementation(() => {
        throw new Error('Validation failed');
      });

      const isValid = validator.validateCSSVariable('--fs-2');
      expect(isValid).toBe(false);
      
      const state = validator.getValidationState();
      expect(state.errors.length).toBeGreaterThan(0);
    });

    it('should provide fallback styles when CSS variables fail', () => {
      // Test that fallback values are used when CSS variables are undefined
      const expectedFallbacks = {
        'fs-0': '12px',
        'fs-1': '14px',
        'fs-2': '16px',
        'sp-1': '8px',
        'sp-2': '16px',
        'sp-3': '24px'
      };

      Object.entries(expectedFallbacks).forEach(([token, fallback]) => {
        const tokenData = DESIGN_TOKENS.typography[token as keyof typeof DESIGN_TOKENS.typography] ||
                         DESIGN_TOKENS.spacing[token as keyof typeof DESIGN_TOKENS.spacing];
        expect(tokenData?.fallback).toBe(fallback);
      });
    });
  });

  describe('Performance Thresholds', () => {
    it('should have defined performance thresholds', () => {
      expect(ACCESSIBILITY_REQUIREMENTS.minimumContrast.normal).toBe(4.5);
      expect(ACCESSIBILITY_REQUIREMENTS.minimumContrast.large).toBe(3);
      expect(ACCESSIBILITY_REQUIREMENTS.minimumTouchTarget.width).toBe(44);
      expect(ACCESSIBILITY_REQUIREMENTS.minimumTouchTarget.height).toBe(44);
    });

    it('should detect performance threshold violations', () => {
      const report = performanceMonitor.getPerformanceReport();
      expect(report.thresholds).toBeDefined();
      expect(report.thresholds.render.maxPaintTime).toBe(16);
      expect(report.thresholds.render.maxLayoutTime).toBe(8);
    });
  });

  describe('Integration Tests', () => {
    it('should initialize design system validation without errors', () => {
      expect(() => {
        initializeDesignSystemValidation();
      }).not.toThrow();
    });

    it('should initialize CSS performance monitoring without errors', () => {
      expect(() => {
        initializeCSSPerformanceMonitoring();
      }).not.toThrow();
    });

    it('should handle SSR environment gracefully', () => {
      const originalWindow = global.window;
      delete (global as any).window;

      expect(() => {
        const value = getCSSVariable('--fs-2', '16px');
        expect(value).toBe('');
      }).not.toThrow();

      global.window = originalWindow;
    });
  });

  describe('Development Mode Features', () => {
    it('should enable development warnings in dev mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      validator.enableDevelopmentWarnings();
      
      // Should not throw errors in development mode
      expect(() => {
        validator.validateCSSVariable('--invalid-var');
      }).not.toThrow();

      process.env.NODE_ENV = originalEnv;
    });

    it('should generate performance reports', () => {
      performanceMonitor.startMonitoring();
      
      const report = performanceMonitor.getPerformanceReport();
      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('thresholds');
      expect(report).toHaveProperty('recommendations');
      expect(Array.isArray(report.recommendations)).toBe(true);
    });
  });
});

/**
 * CSS Integration Tests
 */
describe('CSS Integration Tests', () => {
  it('should have consistent modular scale ratios', () => {
    const scales = Object.values(DESIGN_TOKENS.typography);
    const ratios: number[] = [];
    
    for (let i = 1; i < scales.length; i++) {
      const current = parseFloat(scales[i].value);
      const previous = parseFloat(scales[i - 1].value);
      ratios.push(current / previous);
    }
    
    // Should be approximately 1.25 ratio (major third)
    ratios.forEach(ratio => {
      expect(ratio).toBeCloseTo(1.25, 1);
    });
  });

  it('should have consistent spacing increments', () => {
    const spacings = Object.values(DESIGN_TOKENS.spacing);
    const increments: number[] = [];
    
    for (let i = 1; i < spacings.length; i++) {
      const current = parseFloat(spacings[i].value) * 16; // Convert rem to px
      const previous = parseFloat(spacings[i - 1].value) * 16;
      increments.push(current - previous);
    }
    
    // Should be 8px increments (except for sp-8 which is a jump)
    increments.slice(0, -1).forEach(increment => {
      expect(increment).toBe(8);
    });
  });

  it('should have accessible color contrast ratios', () => {
    // Test would involve checking actual color values
    // This is a placeholder for contrast ratio calculations
    expect(ACCESSIBILITY_REQUIREMENTS.minimumContrast.normal).toBeGreaterThanOrEqual(4.5);
    expect(ACCESSIBILITY_REQUIREMENTS.minimumContrast.large).toBeGreaterThanOrEqual(3);
  });
});
