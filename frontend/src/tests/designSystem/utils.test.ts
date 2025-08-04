// Design System Utility Tests (Node Environment)
// P1-T-013: Separated from components for proper environment isolation

import { test, expect, describe } from 'vitest';
import { DesignSystemValidator } from '@/utils/designSystemValidator';

// Mock style tokens and utilities for testing
const mockDesignTokens = {
  typography: {
    'fs-1': '0.875rem',
    'fs-2': '1rem', 
    'fs-3': '1.125rem',
    'fs-4': '1.25rem',
  },
  spacing: {
    'sp-1': '0.25rem',
    'sp-2': '0.5rem',
    'sp-3': '0.75rem',
    'sp-4': '1rem',
  }
};

// Utility functions that don't require DOM
function validateTypographyScale(scale: string): boolean {
  return Object.keys(mockDesignTokens.typography).includes(scale);
}

function validateSpacingScale(spacing: string): boolean {
  return Object.keys(mockDesignTokens.spacing).includes(spacing);
}

function getTypographyValue(scale: string): string | null {
  return mockDesignTokens.typography[scale as keyof typeof mockDesignTokens.typography] || null;
}

function getSpacingValue(spacing: string): string | null {
  return mockDesignTokens.spacing[spacing as keyof typeof mockDesignTokens.spacing] || null;
}

function generateCSSClassName(prefix: string, scale: string): string {
  return `${prefix}-${scale}`;
}

describe('Design System Utils (Node)', () => {
  test('validates typography scale tokens', () => {
    expect(validateTypographyScale('fs-1')).toBe(true);
    expect(validateTypographyScale('fs-2')).toBe(true);
    expect(validateTypographyScale('fs-5')).toBe(false);
    expect(validateTypographyScale('invalid')).toBe(false);
  });

  test('validates spacing scale tokens', () => {
    expect(validateSpacingScale('sp-1')).toBe(true);
    expect(validateSpacingScale('sp-4')).toBe(true);
    expect(validateSpacingScale('sp-5')).toBe(false);
    expect(validateSpacingScale('invalid')).toBe(false);
  });

  test('retrieves correct typography values', () => {
    expect(getTypographyValue('fs-1')).toBe('0.875rem');
    expect(getTypographyValue('fs-4')).toBe('1.25rem');
    expect(getTypographyValue('invalid')).toBeNull();
  });

  test('retrieves correct spacing values', () => {
    expect(getSpacingValue('sp-1')).toBe('0.25rem');
    expect(getSpacingValue('sp-4')).toBe('1rem');
    expect(getSpacingValue('invalid')).toBeNull();
  });

  test('generates correct CSS class names', () => {
    expect(generateCSSClassName('text', 'fs-2')).toBe('text-fs-2');
    expect(generateCSSClassName('p', 'sp-3')).toBe('p-sp-3');
    expect(generateCSSClassName('m', 'sp-1')).toBe('m-sp-1');
  });

  test('validates design token consistency', () => {
    const typographyKeys = Object.keys(mockDesignTokens.typography);
    const spacingKeys = Object.keys(mockDesignTokens.spacing);

    // All typography keys should follow fs-{number} pattern
    typographyKeys.forEach(key => {
      expect(key).toMatch(/^fs-\d+$/);
    });

    // All spacing keys should follow sp-{number} pattern  
    spacingKeys.forEach(key => {
      expect(key).toMatch(/^sp-\d+$/);
    });
  });

  test('validates token value format', () => {
    const typographyValues = Object.values(mockDesignTokens.typography);
    const spacingValues = Object.values(mockDesignTokens.spacing);

    // All values should be in rem units
    [...typographyValues, ...spacingValues].forEach(value => {
      expect(value).toMatch(/^\d+(\.\d+)?rem$/);
    });
  });

  test('design system validator handles environment gracefully', () => {
    // The validator should be importable and functional
    const validator = DesignSystemValidator.getInstance();
    expect(validator).toBeDefined();
    expect(typeof validator.validateCSSVariable).toBe('function');
  });

  test('validates scale progression logic', () => {
    const scales = ['fs-1', 'fs-2', 'fs-3', 'fs-4'];
    const values = scales.map(scale => parseFloat(getTypographyValue(scale)!));
    
    // Each scale should be larger than the previous
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  test('calculates relative scale ratios', () => {
    const fs1 = parseFloat(getTypographyValue('fs-1')!);
    const fs2 = parseFloat(getTypographyValue('fs-2')!);
    const fs3 = parseFloat(getTypographyValue('fs-3')!);
    
    // Validate that there's a consistent scaling pattern
    const ratio1to2 = fs2 / fs1;
    const ratio2to3 = fs3 / fs2;
    
    expect(ratio1to2).toBeGreaterThan(1);
    expect(ratio2to3).toBeGreaterThan(1);
    
    // The ratios should be reasonable (not too large)
    expect(ratio1to2).toBeLessThan(2);
    expect(ratio2to3).toBeLessThan(2);
  });
});
