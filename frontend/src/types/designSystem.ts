// Sprint 1A Robustness: Design System Type Definitions
// Type-safe design tokens for Visual Hierarchy & Typography

/**
 * Typography Scale Tokens
 * Based on 1.25 modular scale (Major Third)
 */
export type TypographyScale =
  | 'fs-0'  // 12px - Captions, fine print
  | 'fs-1'  // 14px - Small text, labels
  | 'fs-2'  // 16px - Body text (base)
  | 'fs-3'  // 20px - Small headings, lead text
  | 'fs-4'  // 24px - Medium headings
  | 'fs-5'  // 32px - Large headings
  | 'fs-6'; // 40px - Hero headings

/**
 * Line Height Tokens
 */
export type LineHeight =
  | 'tight'    // 1.25 - Headings
  | 'normal'   // 1.5 - Body text
  | 'relaxed'; // 1.75 - Large text blocks

/**
 * Font Weight Tokens
 */
export type FontWeight =
  | 'normal'    // 400
  | 'medium'    // 500
  | 'semibold'  // 600
  | 'bold';     // 700

/**
 * Spacing Scale Tokens
 * Based on 8px base unit system
 */
export type SpacingScale =
  | 'sp-0'  // 0
  | 'sp-1'  // 8px
  | 'sp-2'  // 16px
  | 'sp-3'  // 24px
  | 'sp-4'  // 32px
  | 'sp-5'  // 40px
  | 'sp-6'  // 48px
  | 'sp-8'; // 64px

/**
 * Typography Utilities Class Names
 */
export type TypographyUtility =
  | `text-${TypographyScale}`
  | `text-h${1 | 2 | 3 | 4 | 5 | 6}`
  | 'text-body'
  | 'text-body-sm'
  | 'text-lead'
  | 'text-caption'
  | `font-${FontWeight}`
  | `leading-${LineHeight}`;

/**
 * Spacing Utilities Class Names
 */
export type SpacingUtility =
  | `m-${SpacingScale}`
  | `mt-${SpacingScale}`
  | `mb-${SpacingScale}`
  | `ml-${SpacingScale}`
  | `mr-${SpacingScale}`
  | `mx-${SpacingScale}`
  | `my-${SpacingScale}`
  | `p-${SpacingScale}`
  | `pt-${SpacingScale}`
  | `pb-${SpacingScale}`
  | `pl-${SpacingScale}`
  | `pr-${SpacingScale}`
  | `px-${SpacingScale}`
  | `py-${SpacingScale}`;

/**
 * Combined Design System Utilities
 */
export type DesignSystemUtility = TypographyUtility | SpacingUtility;

/**
 * Design Token Values with Fallbacks
 */
export const DESIGN_TOKENS = {
  typography: {
    'fs-0': { value: '0.75rem', fallback: '12px' },
    'fs-1': { value: '0.875rem', fallback: '14px' },
    'fs-2': { value: '1rem', fallback: '16px' },
    'fs-3': { value: '1.25rem', fallback: '20px' },
    'fs-4': { value: '1.5rem', fallback: '24px' },
    'fs-5': { value: '2rem', fallback: '32px' },
    'fs-6': { value: '2.5rem', fallback: '40px' },
  },
  spacing: {
    'sp-0': { value: '0', fallback: '0' },
    'sp-1': { value: '0.5rem', fallback: '8px' },
    'sp-2': { value: '1rem', fallback: '16px' },
    'sp-3': { value: '1.5rem', fallback: '24px' },
    'sp-4': { value: '2rem', fallback: '32px' },
    'sp-5': { value: '2.5rem', fallback: '40px' },
    'sp-6': { value: '3rem', fallback: '48px' },
    'sp-8': { value: '4rem', fallback: '64px' },
  },
  lineHeight: {
    'tight': { value: '1.25', fallback: '1.25' },
    'normal': { value: '1.5', fallback: '1.5' },
    'relaxed': { value: '1.75', fallback: '1.75' },
  },
  fontWeight: {
    'normal': { value: '400', fallback: '400' },
    'medium': { value: '500', fallback: '500' },
    'semibold': { value: '600', fallback: '600' },
    'bold': { value: '700', fallback: '700' },
  }
} as const;

/**
 * CSS Variable Names
 */
export const CSS_VARIABLES = {
  typography: {
    'fs-0': '--fs-0',
    'fs-1': '--fs-1',
    'fs-2': '--fs-2',
    'fs-3': '--fs-3',
    'fs-4': '--fs-4',
    'fs-5': '--fs-5',
    'fs-6': '--fs-6',
  },
  spacing: {
    'sp-0': '--sp-0',
    'sp-1': '--sp-1',
    'sp-2': '--sp-2',
    'sp-3': '--sp-3',
    'sp-4': '--sp-4',
    'sp-5': '--sp-5',
    'sp-6': '--sp-6',
    'sp-8': '--sp-8',
  },
  lineHeight: {
    'tight': '--lh-tight',
    'normal': '--lh-normal',
    'relaxed': '--lh-relaxed',
  },
  fontWeight: {
    'normal': '--fw-normal',
    'medium': '--fw-medium',
    'semibold': '--fw-semibold',
    'bold': '--fw-bold',
  }
} as const;

/**
 * Accessibility Requirements
 */
export const ACCESSIBILITY_REQUIREMENTS = {
  minimumContrast: {
    normal: 4.5,    // WCAG AA for normal text
    large: 3,       // WCAG AA for large text (18pt+ or 14pt+ bold)
    enhanced: 7     // WCAG AAA
  },
  minimumTouchTarget: {
    width: 44,      // 44px minimum touch target
    height: 44
  },
  focusIndicator: {
    minWidth: 2,    // 2px minimum focus indicator
    minOffset: 1    // 1px minimum offset
  }
} as const;

/**
 * Performance Thresholds
 */
export const PERFORMANCE_THRESHOLDS = {
  css: {
    maxUtilityClasses: 1000,
    maxVariables: 100,
    maxNestingDepth: 4
  },
  render: {
    maxPaintTime: 16,        // 16ms for 60fps
    maxLayoutTime: 8,        // 8ms layout threshold
    maxStyleRecalc: 4,       // 4ms style recalculation
    maxStyleRecalcTime: 4,   // Alias for maxStyleRecalc
    maxScriptTime: 5         // 5ms script execution threshold
  }
} as const;
