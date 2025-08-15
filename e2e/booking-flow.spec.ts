import { test, expect } from '@playwright/test';

test('user can navigate booking flow', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.getByRole('link', { name: /book now/i }).click();
  await expect(page).toHaveURL(/\/booking/);
  // New UI presents a grid of service cards with data-testid=service-card-<id>
  const firstServiceCard = page.locator('[data-testid^="service-card-"]').first();
  await firstServiceCard.waitFor({ timeout: 15000 });
  await firstServiceCard.click();

  // Fill the booking form (labels updated in Booking.tsx)
  await page.getByLabel('Full Name *').fill('John Doe');
  await page.getByLabel('Phone Number').fill('1234567890');
  await page.getByLabel('Email Address').fill('john@example.com');
  await page.getByLabel('Service Address *').fill('123 Main St');
  await page.getByLabel('Preferred Date *').fill('2025-12-25');
  await page.getByLabel('Preferred Time *').fill('10:00');
  await page.getByRole('button', { name: /confirm booking/i }).click();
  await expect(page).toHaveURL(/\/confirmation/);
});
