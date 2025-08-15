import { test, expect } from '@playwright/test';

/**
 * E2E: Verify service delete flow in Appointment Drawer.
 * Steps:
 *  - Visit admin dashboard
 *  - Open first appointment (OPEN button)
 *  - Switch to Services tab
 *  - If no service exists, add one (fill required name via catalog search picker then submit)
 *  - Delete a service and confirm it disappears from list
 */

test('delete service from drawer updates UI', async ({ page }) => {
  await page.goto('http://localhost:5173/admin/dashboard', { waitUntil: 'networkidle' });

  // Open first appointment via OPEN button (assumes at least one card present)
  const openButton = page.locator('button.nb-open-badge', { hasText: 'OPEN' }).first();
  await openButton.waitFor({ timeout: 10000 });
  try {
    await openButton.click({ timeout: 5000 });
  } catch {
    // Mobile layout overlay intercepting: attempt scroll + force
    await openButton.scrollIntoViewIfNeeded();
    await page.evaluate(el => (el as HTMLElement).click(), await openButton.elementHandle());
  }

  // Wait for drawer
  await page.getByTestId('drawer-open').waitFor({ timeout: 10000 });

  // Go to Services tab
  const servicesTab = page.getByRole('tab', { name: /services/i });
  await servicesTab.click();

  // If empty state, add a service
  const emptyState = page.getByTestId('services-empty-state');
  if (await emptyState.isVisible().catch(() => false)) {
    await page.getByTestId('add-service-button').click();
    // Select first operation from catalog
  const searchInput = page.locator('input[placeholder="Search services…"]');
  await searchInput.fill('oil');
  // Wait for at least one stable option
  const firstOption = page.locator('[data-testid^="service-op-option-"]').first();
  await firstOption.waitFor({ timeout: 5000 });
  await firstOption.click();
    // Submit
    await page.getByTestId('add-service-submit-button').click();
  }

  // Wait for at least one service item
  const serviceItems = page.locator('[data-testid^="service-item-"]');
  await expect(serviceItems.first()).toBeVisible({ timeout: 10000 });

  // Record ID attribute (data-testid contains id suffix)
  const firstTestId = await serviceItems.first().getAttribute('data-testid');
  if (!firstTestId) throw new Error('No service test id found');
  const idSuffix = firstTestId.replace('service-item-', '');

  // Set dialog handler BEFORE triggering delete
  page.once('dialog', async d => { await d.accept(); });
  const deleteButton = page.getByTestId(`delete-service-${idSuffix}`);
  await deleteButton.click();

  const deletedItem = page.getByTestId(`service-item-${idSuffix}`);
  await expect(deletedItem).toHaveCount(0, { timeout: 10000 });
});
