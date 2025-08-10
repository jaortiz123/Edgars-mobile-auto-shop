import { test, expect } from '@playwright/test';

test.describe('Cross-Browser Smoke Tests (Frontend Only)', () => {
  test('homepage loads across browsers', async ({ page }) => {
    await page.goto('http://localhost:5173');
  await expect(page.getByRole('link', { name: /book mobile service now/i })).toBeVisible();
  });

  test('admin interface renders basic UI elements', async ({ page }) => {
    // Navigate to admin login page
    await page.goto('http://localhost:5173/admin/login');
    
    // Check that the login form is present
  await expect(page.getByPlaceholder('Username')).toBeVisible();
  await expect(page.getByPlaceholder('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
  });

  test('public pages navigation works', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Check main navigation links are present
    await expect(page.getByRole('link', { name: /services/i }).or(
      page.getByText('Services')
    )).toBeVisible();
    
    await expect(page.getByRole('link', { name: /about/i }).or(
      page.getByText('About')
    )).toBeVisible();
    
    // Test that the page is interactive
    await expect(page.locator('body')).toBeVisible();
  });
});
