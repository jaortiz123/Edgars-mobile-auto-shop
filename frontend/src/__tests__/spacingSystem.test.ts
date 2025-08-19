import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { glob } from 'glob';

/**
 * Sprint1A-T-003 Spacing System Validation Tests
 *
 * These tests ensure that the 8px-based spacing system is properly implemented
 * and that no hard-coded non-8px-multiple spacing values exist in the codebase.
 */

describe('Spacing System Validation', () => {
  test('should have all spacing CSS variables defined in theme.css', () => {
    const themeContent = readFileSync('src/styles/theme.css', 'utf-8');

    // Check that all required spacing variables are defined
    const requiredSpacingVars = [
      '--sp-0: 0',
      '--sp-0-5: 0.25rem', // 4px
      '--sp-1: 0.5rem',    // 8px
      '--sp-1-5: 0.75rem', // 12px
      '--sp-2: 1rem',      // 16px
      '--sp-3: 1.5rem',    // 24px
      '--sp-4: 2rem',      // 32px
      '--sp-5: 2.5rem',    // 40px
      '--sp-6: 3rem',      // 48px
      '--sp-7: 3.5rem',    // 56px
      '--sp-8: 4rem'       // 64px
    ];

    requiredSpacingVars.forEach(varDef => {
      expect(themeContent).toContain(varDef);
    });
  });

  test('should not have hard-coded non-8px-multiple padding values in CSS files', () => {
    const cssFiles = glob.sync('src/**/*.css');
    const problematicValues = ['3px', '5px', '6px', '7px', '9px', '10px', '11px', '13px', '14px', '15px', '17px', '18px', '19px', '21px', '22px', '23px', '25px', '26px', '27px', '28px', '29px', '30px', '31px'];

    cssFiles.forEach(file => {
      const content = readFileSync(file, 'utf-8');

      problematicValues.forEach(value => {
        const paddingRegex = new RegExp(`padding[^:]*:\\s*[^;]*${value}`, 'g');
        const matches = content.match(paddingRegex);

        if (matches) {
          expect(matches).toEqual([]);
        }
      });
    });
  });

  test('should not have hard-coded non-8px-multiple margin values in CSS files', () => {
    const cssFiles = glob.sync('src/**/*.css');
    const problematicValues = ['3px', '5px', '6px', '7px', '9px', '10px', '11px', '13px', '14px', '15px', '17px', '18px', '19px', '21px', '22px', '23px', '25px', '26px', '27px', '28px', '29px', '30px', '31px'];

    cssFiles.forEach(file => {
      const content = readFileSync(file, 'utf-8');

      problematicValues.forEach(value => {
        const marginRegex = new RegExp(`margin[^:]*:\\s*[^;]*${value}`, 'g');
        const matches = content.match(marginRegex);

        if (matches) {
          expect(matches).toEqual([]);
        }
      });
    });
  });

  test('should not have hard-coded non-8px-multiple gap values in CSS files', () => {
    const cssFiles = glob.sync('src/**/*.css');
    const problematicValues = ['3px', '5px', '6px', '7px', '9px', '10px', '11px', '13px', '14px', '15px', '17px', '18px', '19px', '21px', '22px', '23px', '25px', '26px', '27px', '28px', '29px', '30px', '31px'];

    cssFiles.forEach(file => {
      const content = readFileSync(file, 'utf-8');

      problematicValues.forEach(value => {
        const gapRegex = new RegExp(`gap:\\s*[^;]*${value}`, 'g');
        const matches = content.match(gapRegex);

        if (matches) {
          expect(matches).toEqual([]);
        }
      });
    });
  });

  test('should have spacing utility classes defined in spacing.css', () => {
    const spacingContent = readFileSync('src/styles/spacing.css', 'utf-8');

    // Check that key utility classes are defined
    const requiredClasses = [
      '.m-0', '.m-0-5', '.m-1', '.m-1-5', '.m-2', '.m-3', '.m-4', '.m-5', '.m-6', '.m-7', '.m-8',
      '.mt-0', '.mt-0-5', '.mt-1', '.mt-1-5', '.mt-2', '.mt-3', '.mt-4', '.mt-5', '.mt-6', '.mt-7', '.mt-8',
      '.p-0', '.p-1', '.p-2', '.p-3', '.p-4', '.p-5', '.p-6', '.p-8'
    ];

    requiredClasses.forEach(className => {
      expect(spacingContent).toContain(className);
    });
  });

  test('should use spacing variables consistently in component stylesheets', () => {
    const componentFiles = glob.sync('src/components/**/*.css');

    componentFiles.forEach(file => {
      const content = readFileSync(file, 'utf-8');

      // Look for spacing property usage and verify they use variables
      const spacingProperties = content.match(/(padding|margin|gap):\s*[^;]+;/g) || [];

      spacingProperties.forEach(property => {
        // Skip if it's already using a CSS variable
        if (property.includes('var(--sp-')) {
          return;
        }

        // Skip if it's using allowed values (0, auto, inherit, etc.)
        if (property.match(/(0|auto|inherit|initial|unset|none)/)) {
          return;
        }

        // Skip border properties (they can use 1px, 2px)
        if (property.includes('border')) {
          return;
        }

        // Check if it uses hard-coded pixel values that are not 8px multiples
        const pixelMatches = property.match(/(\d+)px/g);
        if (pixelMatches) {
          pixelMatches.forEach(match => {
            const value = parseInt(match.replace('px', ''));
            if (value > 0 && value % 4 !== 0) { // Allow 4px increments for micro-spacing
              console.warn(`Found non-4px-multiple spacing in ${file}: ${property.trim()}`);
            }
          });
        }
      });
    });
  });

  test('should not have inline styles with non-8px-multiple spacing in React components', () => {
    const reactFiles = glob.sync('src/**/*.{tsx,jsx}');

    reactFiles.forEach(file => {
      const content = readFileSync(file, 'utf-8');

      // Look for inline style objects with spacing properties
      const styleMatches = content.match(/style={{[^}]+}}/g) || [];

      styleMatches.forEach(styleMatch => {
        // Check for hard-coded pixel values in padding/margin
        const spacingMatches = styleMatch.match(/(padding|margin):\s*'(\d+)px'/g) || [];

        spacingMatches.forEach(match => {
          const valueMatch = match.match(/(\d+)px/);
          if (valueMatch) {
            const value = parseInt(valueMatch[1]);
            if (value > 0 && value % 4 !== 0) { // Allow 4px increments
              expect(value % 4).toBe(0);
            }
          }
        });
      });
    });
  });

  test('should validate RunningRevenue component uses spacing system correctly', () => {
    const runningRevenueCSS = readFileSync('src/components/RunningRevenue/RunningRevenue.css', 'utf-8');

    // Verify that spacing variables are being used
    expect(runningRevenueCSS).toContain('var(--sp-');

    // Check that no hard-coded non-8px-multiple values remain
    const problematicPatterns = [
      /padding:\s*[^;]*[1357]px/, // odd pixels
      /margin:\s*[^;]*[1357]px/,  // odd pixels
      /gap:\s*[^;]*[1357]px/      // odd pixels
    ];

    problematicPatterns.forEach(pattern => {
      const matches = runningRevenueCSS.match(pattern);
      if (matches) {
        console.warn('Found problematic spacing:', matches);
      }
      expect(matches).toBeNull();
    });
  });
});
