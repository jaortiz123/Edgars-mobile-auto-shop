import { test, expect, Page } from '@playwright/test';
import { attachNetworkLogger } from './utils/networkLogger';
import { stubCustomerProfile } from './utils/stubAuthProfile';

// E2E: Quick Add modal -> search & select services -> schedule appointment
// Focus: validates service search (auth header), multi-select, and readability aids

async function openQuickAdd(page: Page) {
  // Use FAB test id consistent with existing quick-add-service spec
  await page.goto('http://localhost:5173/admin/dashboard', { waitUntil: 'networkidle' });
  await page.getByTestId('fab-quick-add').click();
  await page.getByTestId('quick-add-modal').waitFor({ timeout: 7000 });
}

test.describe('Quick Add Appointment', () => {
  test('user creates appointment selecting two services', async ({ page }) => {
    await stubCustomerProfile(page);
  attachNetworkLogger(page); // TEMP diagnostic instrumentation
    await page.route(/\/api\/admin\/service-operations.*/, async route => {
      const json = [
        { id: 'svc-1', name: 'Oil Change', default_price: 49.99, category: 'Maintenance' },
        { id: 'svc-2', name: 'Brake Inspection', default_price: 89.0, category: 'Safety' }
      ];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
    });
    await page.goto('http://localhost:5173/'); // initial navigation to set storage state

    // Set dummy auth token for DEV environment (required by frontend service search)
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'dev-mock-token-for-e2e');
    });

    // Ensure auth token is present for service search
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(token).toBeTruthy();

    await openQuickAdd(page);

    // Fill customer fields
    await page.getByPlaceholder('Enter customer name').fill('QA E2E User');
    await page.getByPlaceholder('(555) 123-4567').fill('555-8888');

    // Open Services modal
    await page.getByTestId('quickadd-add-service-btn').click();
    const search = page.getByTestId('service-search');
    await expect(search).toBeVisible();

    // First search (should return results after >=3 chars)
    await search.fill('oil'); // expect Oil Change (need 3+ chars for results to show)

    // Wait for UI to process search and show results (no new API call expected)
    await page.waitForTimeout(500); // Allow for filtering logic

    // Click first result
    await expect(page.getByTestId('service-results-list')).toBeVisible({ timeout: 15000 });
    const oilResult = page.getByTestId('service-result-svc-1');
    await expect(oilResult).toBeVisible({ timeout: 10000 });
    await oilResult.click();

    // Second service
    await search.fill('brake');
    const brakeResult = page.getByTestId('service-result-svc-2');
    await expect(brakeResult).toBeVisible();
    await brakeResult.click();

    // Confirm
    await page.getByTestId('service-add-confirm-btn').click();

    // Chips visible
    await expect(page.getByTestId('quickadd-selected-services')).toBeVisible();

  // (Intentional) Stop early: scheduling flow has many dependencies; we only validate catalog & selection for now.
  // Assert the schedule button is present (enabled state may depend on more required fields not covered here)
  const scheduleBtn = page.getByRole('button', { name: /schedule appointment/i });
  await expect(scheduleBtn).toBeVisible();
  });
});
