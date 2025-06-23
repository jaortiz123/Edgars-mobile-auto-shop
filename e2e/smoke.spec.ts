import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await expect(page.getByRole('heading', { name: /reliable mobile auto repair/i })).toBeVisible();
});
