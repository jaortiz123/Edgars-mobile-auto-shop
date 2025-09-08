import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Critical routes for accessibility smoke testing (frontend-only routes)
const publicRoutes = [
  { path: '/', name: 'Landing Page' },
  { path: '/login', name: 'Login Page' },
  { path: '/admin/login', name: 'Admin Login' },
] as const;

// Test each public route for serious/critical accessibility violations
for (const route of publicRoutes) {
  test(`a11y smoke: ${route.name} (${route.path})`, async ({ page }) => {
    try {
      // Navigate to the target route
      await page.goto(`http://localhost:5173${route.path}`);

      // Wait for page to fully load
      await page.waitForLoadState('networkidle');

      // Run axe scan
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();

      // Filter for serious and critical violations only
      const serious = results.violations.filter(v =>
        ['serious', 'critical'].includes(v.impact || '')
      );

      // Log violations for debugging if any exist
      if (serious.length > 0) {
        console.log(`❌ ${route.name} has ${serious.length} serious/critical a11y violations:`);
        serious.forEach(violation => {
          console.log(`  - ${violation.id}: ${violation.description}`);
          console.log(`    Impact: ${violation.impact}`);
          console.log(`    Help: ${violation.help}`);
          console.log(`    Nodes: ${violation.nodes.length}`);
        });
      } else {
        console.log(`✅ ${route.name} passed a11y smoke test`);
      }

      // Fail the test if serious/critical violations found
      expect(serious, `${route.name} has serious/critical accessibility violations:\n${JSON.stringify(serious, null, 2)}`).toHaveLength(0);

    } catch (error) {
      console.error(`Failed to test ${route.name}: ${error}`);
      throw error;
    }
  });
}

// Additional test for focus management and keyboard navigation
test('a11y: keyboard navigation smoke test', async ({ page }) => {
  await page.goto('http://localhost:5173/');

  // Tab through the page and ensure focus is visible
  await page.keyboard.press('Tab');
  const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
  expect(focusedElement).toBeTruthy();

  // Check that focus is visible (this is a basic check)
  const focusStyles = await page.evaluate(() => {
    const element = document.activeElement;
    if (!element) return null;
    const styles = window.getComputedStyle(element);
    return {
      outline: styles.outline,
      outlineWidth: styles.outlineWidth,
      boxShadow: styles.boxShadow,
    };
  });

  // At least one focus indicator should be present
  const hasFocusIndicator = focusStyles && (
    focusStyles.outline !== 'none' ||
    focusStyles.outlineWidth !== '0px' ||
    focusStyles.boxShadow !== 'none'
  );

  expect(hasFocusIndicator, 'Focused element should have visible focus indicator').toBeTruthy();
});

// Test for proper heading hierarchy
test('a11y: heading hierarchy', async ({ page }) => {
  const routes = ['/', '/login'];

  for (const route of routes) {
    await page.goto(`http://localhost:5173${route}`);
    await page.waitForLoadState('networkidle');

    // Get all headings
    const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', elements =>
      elements.map(el => ({
        level: parseInt(el.tagName.charAt(1)),
        text: el.textContent?.trim() || ''
      }))
    );

    // Should have exactly one h1
    const h1Count = headings.filter(h => h.level === 1).length;
    expect(h1Count, `Route ${route} should have exactly one h1 element`).toBe(1);

    // Check hierarchy (no skipping levels)
    for (let i = 1; i < headings.length; i++) {
      const current = headings[i];
      const previous = headings[i - 1];

      if (current.level > previous.level) {
        expect(current.level - previous.level,
          `Heading hierarchy violation at "${current.text}": jumped from h${previous.level} to h${current.level}`
        ).toBeLessThanOrEqual(1);
      }
    }
  }
});

// Test for proper landmarks
test('a11y: landmark structure', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await page.waitForLoadState('networkidle');

  // Check for main landmark
  const mainLandmarks = await page.$$('main, [role="main"]');
  expect(mainLandmarks.length, 'Page should have exactly one main landmark').toBe(1);

  // Check for navigation landmark on pages that should have it
  const navLandmarks = await page.$$('nav, [role="navigation"]');
  expect(navLandmarks.length, 'Page should have at least one navigation landmark').toBeGreaterThanOrEqual(1);
});
