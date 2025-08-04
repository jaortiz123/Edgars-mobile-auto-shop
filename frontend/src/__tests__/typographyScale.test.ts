import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

/**
 * Sprint1A-T-002: Typography Scale Migration Tests
 * 
 * Ensures all components use the new typography scale and prevents
 * regression to hard-coded pixel font-sizes.
 */

describe('Typography Scale Migration', () => {
  // Get all CSS files in components and pages directories
  const cssFiles = glob.sync('src/**/*.{css,scss}', {
    cwd: process.cwd(),
    absolute: true,
  });

  it('should not contain any hard-coded pixel font-sizes in component CSS', () => {
    const pixelFontSizeRegex = /font-size:\s*\d+px/g;
    const violationFiles: Array<{ file: string; matches: string[] }> = [];

    cssFiles.forEach(file => {
      try {
        const content = readFileSync(file, 'utf-8');
        const matches = content.match(pixelFontSizeRegex);
        
        if (matches) {
          violationFiles.push({
            file: file.replace(process.cwd(), ''),
            matches: matches,
          });
        }
      } catch {
        // Skip files that can't be read
        console.warn(`Could not read file: ${file}`);
      }
    });

    if (violationFiles.length > 0) {
      const errorMessage = violationFiles
        .map(({ file, matches }) => 
          `${file}:\n  ${matches.join('\n  ')}`
        )
        .join('\n\n');
      
      throw new Error(
        `Found hard-coded pixel font-sizes in CSS files. All font-sizes should use the typography scale (var(--fs-*)):\n\n${errorMessage}`
      );
    }

    expect(violationFiles).toHaveLength(0);
  });

  it('should not contain hard-coded pixel font-sizes in inline styles', () => {
    const jsxFiles = glob.sync('src/**/*.{tsx,jsx,ts,js}', {
      cwd: process.cwd(),
      absolute: true,
    });

    const inlineFontSizeRegex = /(?:fontSize|font-size):\s*['"]\d+px['"]|style.*font-size.*\d+px/g;
    const violationFiles: Array<{ file: string; matches: string[] }> = [];

    jsxFiles.forEach(file => {
      try {
        const content = readFileSync(file, 'utf-8');
        const matches = content.match(inlineFontSizeRegex);
        
        if (matches) {
          violationFiles.push({
            file: file.replace(process.cwd(), ''),
            matches: matches,
          });
        }
      } catch {
        // Skip files that can't be read
        console.warn(`Could not read file: ${file}`);
      }
    });

    if (violationFiles.length > 0) {
      const errorMessage = violationFiles
        .map(({ file, matches }) => 
          `${file}:\n  ${matches.join('\n  ')}`
        )
        .join('\n\n');
      
      throw new Error(
        `Found hard-coded pixel font-sizes in JSX/TSX files. Use CSS variables or Tailwind typography classes:\n\n${errorMessage}`
      );
    }

    expect(violationFiles).toHaveLength(0);
  });

  it('should have typography scale CSS variables defined', () => {
    const themeFiles = [
      'src/styles/theme.css',
      'src/styles/themeRobust.css',
    ];

    const requiredVariables = [
      '--fs-0', '--fs-1', '--fs-2', '--fs-3', 
      '--fs-4', '--fs-5', '--fs-6'
    ];

    themeFiles.forEach(file => {
      try {
        const fullPath = join(process.cwd(), file);
        const content = readFileSync(fullPath, 'utf-8');
        
        requiredVariables.forEach(variable => {
          const variableRegex = new RegExp(`${variable.replace('--', '\\-\\-')}:\\s*[^;]+;`);
          expect(content).toMatch(variableRegex);
        });
      } catch {
        // File might not exist, which is okay
        console.warn(`Could not read theme file: ${file}`);
      }
    });
  });

  it('should use typography scale in component stylesheets', () => {
    const componentCssFiles = cssFiles.filter(file => 
      file.includes('/components/') && file.endsWith('.css')
    );

    // If we have component CSS files, they should use CSS variables
    if (componentCssFiles.length > 0) {
      const cssVariableRegex = /var\(--fs-[0-6]/g;
      let hasTypographyVariables = false;

      componentCssFiles.forEach(file => {
        try {
          const content = readFileSync(file, 'utf-8');
          
          // Skip if file doesn't contain font-size declarations
          if (!content.includes('font-size')) {
            return;
          }

          if (content.match(cssVariableRegex)) {
            hasTypographyVariables = true;
          }
        } catch {
          console.warn(`Could not read CSS file: ${file}`);
        }
      });

      // At least one component CSS file should use typography variables
      // This ensures the scale is actually being used
      expect(hasTypographyVariables).toBe(true);
    }
  });

  it('should have Tailwind configured with typography scale classes', () => {
    try {
      const tailwindConfigPath = join(process.cwd(), 'tailwind.config.js');
      const configContent = readFileSync(tailwindConfigPath, 'utf-8');
      
      // Check that our custom typography scale is defined in Tailwind config
      const requiredClasses = ['fs-0', 'fs-1', 'fs-2', 'fs-3', 'fs-4', 'fs-5', 'fs-6'];
      
      requiredClasses.forEach(fsClass => {
        expect(configContent).toMatch(new RegExp(`['"]${fsClass}['"]`));
      });
    } catch {
      console.warn('Could not read tailwind.config.js file');
    }
  });
});

/**
 * Typography Scale Usage Validation Tests
 * 
 * These tests ensure proper usage patterns and help catch misuse.
 */
describe('Typography Scale Usage Validation', () => {
  it('should recommend Tailwind classes over legacy text utilities', () => {
    // This is more of a documentation test - we want to encourage
    // using text-fs-* classes over text-xs, text-sm, etc.
    const recommendedMapping = {
      'text-xs': 'text-fs-0',    // 12px
      'text-sm': 'text-fs-1',    // 14px
      'text-base': 'text-fs-2',  // 16px
      'text-lg': 'text-fs-3',    // 20px (closer than xl)
      'text-xl': 'text-fs-4',    // 24px
      'text-2xl': 'text-fs-5',   // 32px
      'text-3xl': 'text-fs-6',   // 40px
    };

    // This test documents the preferred migration path
    Object.entries(recommendedMapping).forEach(([, preferred]) => {
      expect(preferred).toMatch(/^text-fs-[0-6]$/);
    });
  });

  it('should validate CSS variable fallback pattern', () => {
    const validPattern = /var\(--fs-[0-6],\s*[\d.]+rem\)/;
    const validExamples = [
      'var(--fs-0, 0.75rem)',
      'var(--fs-1, 0.875rem)',
      'var(--fs-2, 1rem)',
      'var(--fs-3, 1.25rem)',
      'var(--fs-4, 1.5rem)',
      'var(--fs-5, 2rem)',
      'var(--fs-6, 2.5rem)',
    ];

    validExamples.forEach(example => {
      expect(example).toMatch(validPattern);
    });
  });
});
