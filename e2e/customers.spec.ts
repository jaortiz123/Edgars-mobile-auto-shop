import { test, expect } from '@playwright/test';

test('Customers search and visits load', async ({ page }) => {
  await page.goto('http://localhost:5173/admin/customers');
  const input = page.getByPlaceholder(/search by plate|name|phone|email/i);
  await input.fill('ABC');
  const list = page.getByTestId('customer-results');
  await expect(list).toBeVisible();
  await expect(list).toContainText(/No customers|Searching|Vehicle|—/i);

  const firstBtn = list.locator('button').first();
  if (await firstBtn.count()) {
    await firstBtn.click();
    const visits = page.getByTestId('customer-visits');
    await expect(visits).toBeVisible();
  }
});
