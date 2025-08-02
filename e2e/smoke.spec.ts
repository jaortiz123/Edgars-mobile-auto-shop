import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await expect(page.getByRole('heading', { name: /reliable mobile auto repair/i })).toBeVisible();
});

test('admin login and board columns visible', async ({ page }) => {
  // Navigate to admin login
  await page.goto('http://localhost:5173/admin/login');
  
  // Fill in admin credentials (using defaults from the app)
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[name="password"]', 'admin123');
  
  // Submit login form
  await page.click('button[type="submit"]');
  
  // Wait for redirect to admin dashboard
  await page.waitForURL('**/admin/dashboard');
  
  // Navigate to or verify board view is accessible
  // Look for board columns - these should be visible for the core smoke test
  await expect(page.locator('[data-testid="status-column-SCHEDULED"]').or(
    page.locator('[data-column="SCHEDULED"]')
  ).or(
    page.getByText('Scheduled').locator('..').locator('[data-testid*="column"]')
  ).or(
    page.getByRole('region', { name: /scheduled/i })
  )).toBeVisible({ timeout: 10000 });
  
  await expect(page.locator('[data-testid="status-column-IN_PROGRESS"]').or(
    page.locator('[data-column="IN_PROGRESS"]')
  ).or(
    page.getByText('In Progress').locator('..').locator('[data-testid*="column"]')
  ).or(
    page.getByRole('region', { name: /in progress/i })
  )).toBeVisible({ timeout: 10000 });
  
  await expect(page.locator('[data-testid="status-column-COMPLETED"]').or(
    page.locator('[data-column="COMPLETED"]')
  ).or(
    page.getByText('Completed').locator('..').locator('[data-testid*="column"]')
  ).or(
    page.getByRole('region', { name: /completed/i })
  )).toBeVisible({ timeout: 10000 });
});
