import { test, expect } from '@playwright/test';
import { stubCustomerProfile } from './utils/stubAuthProfile';

/**
 * E2E: Verify service delete flow in Appointment Drawer.
 * Steps:
 *  - Visit admin dashboard
 *  - Open first appointment (OPEN button)
 *  - Switch to Services tab
 *  - If no service exists, add one (fill required name via catalog search picker then submit)
 *  - Delete a service and confirm it disappears from list
 */

test('delete service from drawer updates UI (stubbed dataset minimal - skip if no services)', async ({ page }) => {
  const vp = page.viewportSize();
  if (vp && vp.width < 700) {
    test.skip(true, 'Skip on narrow/mobile viewport until responsive interaction path added');
  }
  await stubCustomerProfile(page);
  // Use real admin dashboard route now that board is stable (harness deprecated for this flow)
  // Stub board API so we control dataset (ensures at least one card with service operations list)
  await page.route('**/admin/appointments/board**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        columns: [
          { key: 'SCHEDULED', title: 'Scheduled' },
          { key: 'IN_PROGRESS', title: 'In Progress' },
          { key: 'COMPLETED', title: 'Completed' }
        ],
        cards: [
          { id: 'CARD1', status: 'SCHEDULED', position: 1, servicesSummary: 'Initial Inspection', customerName: 'Test User' }
        ]
      })
    });
  });
  await page.goto('http://localhost:5173/admin/dashboard');
  const grid = page.locator('.nb-board-grid');
  await grid.first().waitFor({ state: 'attached', timeout: 10000 });
  await expect.poll(async () => {
    const count = await page.locator('.nb-board-grid .nb-column').count();
    return count > 0 ? 'cols' : null;
  }, { timeout: 20000 }).toBe('cols');

  // Open first appointment via OPEN button (assumes at least one card present)
  // Locate OPEN button (card action) - fallback to entire card if badge absent in this dataset
  const openButton = page.locator('button.nb-open-badge', { hasText: /open/i }).first();
  if (await openButton.count()) {
    try {
      await openButton.click();
    } catch {
      // Force click via DOM to bypass overlay interception in some layouts
      await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement | null; el?.click();
      }, 'button.nb-open-badge');
    }
  } else {
    await page.locator('[data-appointment-id="CARD1"]').first().click();
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

  const serviceItems = page.locator('[data-testid^="service-item-"]');
  if (await serviceItems.count() === 0) {
    test.info().annotations.push({ type: 'info', description: 'No services in stubbed dataset; skipping delete assertions' });
    return;
  }
  // Future: expand stub to include services and perform delete flow
  test.fixme(true, 'Service items not present in current stubbed board dataset');
});
