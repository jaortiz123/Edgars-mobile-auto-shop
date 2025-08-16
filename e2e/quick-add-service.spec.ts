import { test, expect } from '@playwright/test';
import { stubCustomerProfile } from './utils/stubAuthProfile';

/**
 * Quick Add Modal service catalog integration test
 * - Opens dashboard
 * - Clicks FAB to open Quick Add
 * - Ensures catalog input appears and can search & select an operation
 */

test('quick add modal loads service catalog and selects operation', async ({ page }) => {
  await stubCustomerProfile(page);
  // Stub service operations endpoint to ensure options appear even if auth missing
  await page.route(/\/api\/admin\/service-operations$/, async route => {
    const json = {
      service_operations: [
        { id: 'op-oil', name: 'Oil Change', category: 'Maintenance', default_hours: 1, default_price: 49.99, keywords: ['oil'] },
        { id: 'op-brake', name: 'Brake Service', category: 'Safety', default_hours: 2, default_price: 199.0, keywords: ['brake'] }
      ]
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
  });
  await page.goto('http://localhost:5173/admin/dashboard', { waitUntil: 'networkidle' });

  // Open Quick Add via FAB
  await page.getByTestId('fab-quick-add').click();
  await page.getByTestId('quick-add-modal').waitFor({ timeout: 7000 });

  const search = page.locator('input[placeholder="Search services…"]');
  await expect(search).toBeVisible();
  await search.focus();
  await search.fill('oil');

  // Poll for service operation options rendered with data-testid prefix
  const optionsLocator = page.locator('[data-testid^="service-op-option-"]');
  await expect.poll(async () => await optionsLocator.count(), { timeout: 8000 }).toBeGreaterThan(0);
  const first = optionsLocator.first();
  await first.scrollIntoViewIfNeeded();
  await first.click();

  // Assert selection reflected (input value includes 'Oil' case-insensitive)
  await expect.poll(async () => (await search.inputValue()).toLowerCase()).toMatch(/oil/);

  // Confirm schedule button present (may remain disabled due to required fields)
  const submit = page.getByRole('button', { name: /schedule appointment/i });
  await expect(submit).toBeVisible();
});
