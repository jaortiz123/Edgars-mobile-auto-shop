import { test, expect, Page } from '@playwright/test';

function buildFakeJwt(role: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 60 * 60; // 1h expiry
  const payload = Buffer.from(JSON.stringify({ sub: 'owner-user-1', email: 'owner@example.com', exp })).toString('base64url');
  const signature = 'testsignature';
  return `${header}.${payload}.${signature}`;
}

async function loginAsOwner(page: Page) {
  // Intercept profile fetch used by Auth initialization (if any) and return Owner role
  await page.route('**/customers/profile', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, body: JSON.stringify({ email: 'owner@example.com', role: 'Owner' }) });
    }
    return route.continue();
  });
  await page.addInitScript(token => {
    localStorage.setItem('auth_token', token as string);
  }, buildFakeJwt('Owner'));
  await page.goto('/');
}

/**
 * Zero-state expectations for analytics dashboard when no template usage events exist.
 * We assert:
 *  - Authenticated Owner can reach /admin/analytics (no redirect to /login)
 *  - Page skeleton renders: heading "Messaging Analytics" OR a zero data indicator
 *  - No unhandled error messages are visible
 */

test.describe('Analytics Dashboard - zero state', () => {
  test('owner sees empty analytics dashboard with zero totals', async ({ page }) => {
    await loginAsOwner(page);

    // Intercept analytics API to force an empty response shape (mirrors backend when no events)
    await page.route('**/api/admin/analytics/templates*', route => {
      if (route.request().method() === 'GET') {
        const url = new URL(route.request().url());
        const now = new Date().toISOString();
        const from = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
        return route.fulfill({
          status: 200,
            body: JSON.stringify({
              range: { from, to: now, granularity: 'day' },
              filters: { channel: 'all', limit: 50 },
              totals: { events: 0, uniqueTemplates: 0, uniqueUsers: 0, uniqueCustomers: 0, byChannel: {} },
              trend: Array.from({ length: 8 }, (_, i) => ({ bucketStart: new Date(Date.now() - (7 - i) * 24 * 3600 * 1000).toISOString().slice(0,10), count: 0 })),
              channelTrend: [],
              templates: [],
              usageSummary: { topTemplates: [], topUsers: [] },
              meta: { generatedAt: now, cache: { hit: false }, version: 1 }
            })
        });
      }
      return route.continue();
    });

    await page.goto('/admin/analytics');

    // Wait for the page to be fully loaded before checking visibility
    await page.waitForLoadState('networkidle');

    // Add debugging for mobile viewport issues
    await page.waitForTimeout(1000); // Give React time to settle

    // Expect heading or zero-state indicator
    const heading = page.getByRole('heading', { name: /Messaging Analytics/i });
    const zeroState = page.getByTestId('analytics-empty'); // based on component conditional

    await expect(heading.or(zeroState)).toBeVisible();

    // Ensure no generic error block
    const errorBlock = page.locator('[data-testid="analytics-error"]');
    await expect(errorBlock).toHaveCount(0);

    // If totals are rendered, assert zero events text if present
    const maybeTotals = page.locator('[data-testid="analytics-totals"]');
    if (await maybeTotals.count()) {
      await expect(maybeTotals).toContainText(/0\b/);
    }
  });
});
