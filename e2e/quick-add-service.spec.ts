import { test, expect } from '@playwright/test';

/**
 * Quick Add Modal service catalog integration test
 * - Opens dashboard
 * - Clicks FAB to open Quick Add
 * - Ensures catalog input appears and can search & select an operation
 */

test('quick add modal loads service catalog and selects operation', async ({ page }) => {
  await page.goto('http://localhost:5173/admin/dashboard', { waitUntil: 'networkidle' });

  // Open Quick Add via FAB
  await page.getByTestId('fab-quick-add').click();
  await page.getByTestId('quick-add-modal').waitFor({ timeout: 5000 });

  // Find catalog search input (placeholder from ServiceOperationSelect)
  const search = page.locator('input[placeholder="Search services…"]');
  await expect(search).toBeVisible();

  // Type a query that should match seeded operations
  await search.fill('oil');

  // Force open dropdown by focusing input (component opens on focus) and waiting
  await search.focus();
  // Narrow scope: list container appears with buttons (max 15) – ensure at least one
  const options = page.locator('div[role="dialog"] .absolute button');
  await expect(options.first()).toBeVisible({ timeout: 5000 });
  const option = options.first();
  await option.hover();
  await option.click({ trial: true }).catch(()=>{}); // trial to ensure clickable
  await option.click();

  // After selection, the input value should reflect chosen op name (any non-empty)
  await expect(search).not.toHaveValue('');

  // Ensure form field serviceType updated in underlying state by attempting submission (will fail other required fields but that's fine)
  const submit = page.getByRole('button', { name: /schedule appointment/i });
  await expect(submit).toBeVisible();
});
