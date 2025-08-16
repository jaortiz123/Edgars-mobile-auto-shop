import { test, expect, Page } from '@playwright/test';

function buildFakeJwt(role: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 60 * 60; // 1h
  const payload = Buffer.from(JSON.stringify({ sub: 'user-advisor-1', email: 'advisor@example.com', exp })).toString('base64url');
  const signature = 'testsignature';
  return `${header}.${payload}.${signature}`;
}

async function loginAsAdvisor(page: Page) {
  await page.route('**/customers/profile', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, body: JSON.stringify({ email: 'advisor@example.com', role: 'Advisor' }) });
    }
    return route.continue();
  });
  await page.addInitScript(token => {
    localStorage.setItem('auth_token', token as string);
  }, buildFakeJwt('Advisor'));
  await page.goto('/');
}

test.describe('Admin Templates visibility (Advisor)', () => {
  test('action buttons hidden for non-owner', async ({ page }) => {
    await loginAsAdvisor(page);

    // Intercept BEFORE navigation so initial fetch is stubbed
    await page.route(/\/admin\/message-templates(?:\?.*)?$/, route => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, body: JSON.stringify({ message_templates: [{ id: 'row1', slug: 'demo', label: 'Demo', channel: 'sms', category: 'General', body: 'Hi', variables: [], is_active: true }] }) });
      }
      return route.continue();
    });

    await page.goto('/admin/templates');

    // Ensure create button absent
    await expect(page.getByTestId('create-template-btn')).toHaveCount(0);

    // Wait for table or empty state
  await page.waitForTimeout(150);
  // Row slug cell visible (choose monospace slug cell)
  const slugCell = page.locator('td.font-mono', { hasText: 'demo' }).first();
  await expect(slugCell).toBeVisible({ timeout: 2000 });

    // Ensure no edit/delete action cells
    await expect(page.locator('[data-testid^="edit-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="delete-"]')).toHaveCount(0);
  });
});
