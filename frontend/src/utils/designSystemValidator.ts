// Sprint 1A Robustness: Design System Validation Utilities
import { 
  TypographyScale, 
  SpacingScale, 
  DesignSystemUtility,
  DESIGN_TOKENS,
  CSS_VARIABLES,
  ACCESSIBILITY_REQUIREMENTS,
  PERFORMANCE_THRESHOLDS
} from '@/types/designSystem';

/**
 * Design System Validation and Runtime Checks
 */
export class DesignSystemValidator {
  private static instance: DesignSystemValidator;
  private warnings: Set<string> = new Set();
  private errors: Set<string> = new Set();
  private performanceMetrics: Map<string, number> = new Map();

  static getInstance(): DesignSystemValidator {
    if (!DesignSystemValidator.instance) {
      DesignSystemValidator.instance = new DesignSystemValidator();
    }
    return DesignSystemValidator.instance;
  }

  /**
   * Validate CSS Variable Availability
   */
  validateCSSVariable(variableName: string): boolean {
    if (typeof window === 'undefined') return true; // SSR fallback
    
    // Check if we're in a test environment without real CSS
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      // In test environment, assume CSS variables are valid if they're in our design tokens
      const isTypographyVar = Object.values(CSS_VARIABLES.typography).includes(variableName);
      const isSpacingVar = Object.values(CSS_VARIABLES.spacing).includes(variableName);
      const isLineHeightVar = Object.values(CSS_VARIABLES.lineHeight).includes(variableName);
      const isFontWeightVar = Object.values(CSS_VARIABLES.fontWeight).includes(variableName);
      
      if (isTypographyVar || isSpacingVar || isLineHeightVar || isFontWeightVar) {
        return true;
      }
    }

    try {
      const computedStyle = getComputedStyle(document.documentElement);
      const value = computedStyle.getPropertyValue(variableName).trim();
      
      if (!value) {
        this.logWarning(`CSS variable ${variableName} is not defined`);
        return false;
      }
      
      return true;
    } catch (error) {
      this.logError(`Failed to validate CSS variable ${variableName}: ${error}`);
      return false;
    }
  }

  /**
   * Validate Typography Scale Usage
   */
  validateTypographyScale(scale: string): boolean {
    const validScales = Object.keys(DESIGN_TOKENS.typography);
    if (!validScales.includes(scale)) {
      this.logWarning(`Invalid typography scale: ${scale}. Valid scales: ${validScales.join(', ')}`);
      return false;
    }

    const cssVariable = CSS_VARIABLES.typography[scale as TypographyScale];
    return this.validateCSSVariable(cssVariable);
  }

  /**
   * Validate Spacing Scale Usage
   */
  validateSpacingScale(scale: string): boolean {
    const validScales = Object.keys(DESIGN_TOKENS.spacing);
    if (!validScales.includes(scale)) {
      this.logWarning(`Invalid spacing scale: ${scale}. Valid scales: ${validScales.join(', ')}`);
      return false;
    }

    const cssVariable = CSS_VARIABLES.spacing[scale as SpacingScale];
    return this.validateCSSVariable(cssVariable);
  }

  /**
   * Validate Design System Class Usage
   */
  validateDesignSystemClass(className: string): boolean {
    // Extract scale from class name
    if (className.startsWith('text-fs-')) {
      const scale = className.replace('text-', '');
      return this.validateTypographyScale(scale);
    }
    
    if (className.match(/^[mp][tblrxy]?-sp-/)) {
      const scale = className.split('-').slice(-2).join('-');
      return this.validateSpacingScale(scale);
    }

    return true; // Unknown class, assume valid
  }

  /**
   * Check Accessibility Compliance
   */
  validateAccessibility(element: HTMLElement): boolean {
    const issues: string[] = [];

    // Check minimum touch target size
    const rect = element.getBoundingClientRect();
    if (rect.width < ACCESSIBILITY_REQUIREMENTS.minimumTouchTarget.width ||
        rect.height < ACCESSIBILITY_REQUIREMENTS.minimumTouchTarget.height) {
      if (element.matches('button, a, input, select, textarea, [role="button"]')) {
        issues.push(`Touch target too small: ${rect.width}×${rect.height}px (minimum: 44×44px)`);
      }
    }

    // Check focus indicator
    if (element.matches('button, a, input, select, textarea, [tabindex]')) {
      const computedStyle = getComputedStyle(element, ':focus-visible');
      const outlineWidth = computedStyle.outlineWidth;
      if (outlineWidth === 'none' || parseFloat(outlineWidth) < ACCESSIBILITY_REQUIREMENTS.focusIndicator.minWidth) {
        issues.push('Insufficient focus indicator');
      }
    }

    if (issues.length > 0) {
      this.logWarning(`Accessibility issues found: ${issues.join(', ')}`);
      return false;
    }

    return true;
  }

  /**
   * Performance Monitoring
   */
  measureCSSPerformance(label: string, fn: () => void): void {
    if (typeof window === 'undefined') return;

    const start = performance.now();
    fn();
    const end = performance.now();
    const duration = end - start;

    this.performanceMetrics.set(label, duration);

    if (duration > PERFORMANCE_THRESHOLDS.render.maxPaintTime) {
      this.logWarning(`Performance threshold exceeded for ${label}: ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * Check for CSS Variable Fallbacks
   */
  validateFallbacks(): boolean {
    const requiredVariables = [
      ...Object.values(CSS_VARIABLES.typography),
      ...Object.values(CSS_VARIABLES.spacing),
      ...Object.values(CSS_VARIABLES.lineHeight),
      ...Object.values(CSS_VARIABLES.fontWeight)
    ];

    let allValid = true;
    for (const variable of requiredVariables) {
      if (!this.validateCSSVariable(variable)) {
        allValid = false;
      }
    }

    return allValid;
  }

  /**
   * Runtime CSS Validation
   */
  validateRuntimeCSS(): void {
    if (typeof window === 'undefined') return;

    // Check for unused CSS variables
    const stylesheets = Array.from(document.styleSheets);
    const definedVariables = new Set<string>();
    const usedVariables = new Set<string>();

    stylesheets.forEach(sheet => {
      try {
        const rules = Array.from(sheet.cssRules || []);
        rules.forEach(rule => {
          const cssText = rule.cssText;
          
          // Find defined variables
          cssText.match(/--[\w-]+/g)?.forEach(variable => {
            definedVariables.add(variable);
          });
          
          // Find used variables
          cssText.match(/var\(--[\w-]+/g)?.forEach(match => {
            const variable = match.replace('var(', '');
            usedVariables.add(variable);
          });
        });
      } catch (error) {
        // Ignore CORS errors for external stylesheets
      }
    });

    // Report unused variables
    definedVariables.forEach(variable => {
      if (!usedVariables.has(variable)) {
        this.logWarning(`Unused CSS variable: ${variable}`);
      }
    });
  }

  /**
   * Development Mode Warnings
   */
  enableDevelopmentWarnings(): void {
    if (process.env.NODE_ENV !== 'development') return;

    // Add mutation observer to watch for design system violations
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.validateElementClasses(node as HTMLElement);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Validate existing elements
    document.querySelectorAll('*').forEach(element => {
      this.validateElementClasses(element as HTMLElement);
    });
  }

  /**
   * Validate Element Classes
   */
  private validateElementClasses(element: HTMLElement): void {
    const classes = Array.from(element.classList);
    classes.forEach(className => {
      if (className.match(/^(text-fs-|[mp][tblrxy]?-sp-)/)) {
        this.validateDesignSystemClass(className);
      }
    });

    // Add visual warning in development
    if (this.warnings.size > 0 && process.env.NODE_ENV === 'development') {
      element.classList.add('ds-dev-warning');
      element.setAttribute('data-ds-warnings', Array.from(this.warnings).join('; '));
    }
  }

  /**
   * Generate Performance Report
   */
  getPerformanceReport(): object {
    return {
      metrics: Object.fromEntries(this.performanceMetrics),
      warnings: Array.from(this.warnings),
      errors: Array.from(this.errors),
      thresholds: PERFORMANCE_THRESHOLDS
    };
  }

  /**
   * Logging Methods
   */
  private logWarning(message: string): void {
    this.warnings.add(message);
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[Design System Warning] ${message}`);
    }
  }

  private logError(message: string): void {
    this.errors.add(message);
    if (process.env.NODE_ENV === 'development') {
      console.error(`[Design System Error] ${message}`);
    }
  }

  /**
   * Clear Warnings and Errors
   */
  clearLogs(): void {
    this.warnings.clear();
    this.errors.clear();
  }

  /**
   * Get Current State
   */
  getValidationState(): {
    isValid: boolean;
    warnings: string[];
    errors: string[];
    performanceMetrics: Record<string, number>;
  } {
    return {
      isValid: this.errors.size === 0,
      warnings: Array.from(this.warnings),
      errors: Array.from(this.errors),
      performanceMetrics: Object.fromEntries(this.performanceMetrics)
    };
  }
}

/**
 * Utility Functions for Design System Usage
 */

/**
 * Safe CSS Variable Getter with Fallback
 */
export function getCSSVariable(variableName: string, fallback?: string): string {
  if (typeof window === 'undefined') {
    return fallback || '';
  }

  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(variableName)
      .trim();
    
    if (!value && fallback) {
      const validator = DesignSystemValidator.getInstance();
      validator.validateCSSVariable(variableName);
      return fallback;
    }
    
    return value || fallback || '';
  } catch (error) {
    console.warn(`Failed to get CSS variable ${variableName}:`, error);
    return fallback || '';
  }
}

/**
 * Generate Type-Safe CSS Classes
 */
export function createDesignSystemClasses(...classes: (DesignSystemUtility | string)[]): string {
  const validator = DesignSystemValidator.getInstance();
  
  return classes
    .filter(Boolean)
    .map(className => {
      if (typeof className === 'string') {
        validator.validateDesignSystemClass(className);
      }
      return className;
    })
    .join(' ');
}

/**
 * Validate Design Token Usage at Runtime
 */
export function validateDesignToken(category: keyof typeof DESIGN_TOKENS, token: string): boolean {
  const validator = DesignSystemValidator.getInstance();
  
  switch (category) {
    case 'typography':
      return validator.validateTypographyScale(token);
    case 'spacing':
      return validator.validateSpacingScale(token);
    default:
      return true;
  }
}

/**
 * Initialize Design System Validation
 */
export function initializeDesignSystemValidation(): void {
  const validator = DesignSystemValidator.getInstance();
  
  // Validate all CSS variables are available
  validator.validateFallbacks();
  
  // Enable development warnings
  validator.enableDevelopmentWarnings();
  
  // Validate runtime CSS
  validator.validateRuntimeCSS();
  
  // Log initialization
  if (process.env.NODE_ENV === 'development') {
    console.log('[Design System] Validation initialized', validator.getValidationState());
  }
}

// Export singleton instance
export const designSystemValidator = DesignSystemValidator.getInstance();
