import { test, expect } from '@playwright/test';

test.skip('user can navigate booking flow', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.getByRole('link', { name: /book now/i }).click();
  await expect(page).toHaveURL(/\/booking/);
  await page.getByRole('button', { name: /oil change/i }).click();
  await page.getByLabel('Name').fill('John Doe');
  await page.getByLabel('Phone').fill('1234567890');
  await page.getByLabel('Email').fill('john@example.com');
  await page.getByLabel('Address').fill('123 Main St');
  await page.getByLabel('Date').fill('2025-12-25');
  await page.getByLabel('Time').fill('10:00');
  await page.getByRole('button', { name: /submit/i }).click();
  await expect(page).toHaveURL(/\/confirmation/);
});
