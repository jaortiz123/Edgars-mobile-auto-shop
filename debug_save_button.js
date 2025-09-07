// Quick debugging script to test save button state
import { test, expect } from '@playwright/test';
import { stubCustomerProfile } from './e2e/utils/stubAuthProfile';
import { waitForBoardReady } from './e2e/utils/waitForBoardReady';

test('Debug Save Button State', async ({ page }) => {
  await stubCustomerProfile(page);
  // Navigate to dashboard (auth token in storageState)
  await page.goto('/admin/dashboard');

  // Unified readiness with network stability
  const firstCard = await waitForBoardReady(page);
  if (!firstCard) {
    test.skip(true, 'No appointment cards available for drawer test');
    return;
  }
  await firstCard.click();

  // Wait for drawer to open
  await page.waitForSelector('[data-testid="appointment-drawer"]', { timeout: 5000 });

  // Switch to Services tab
  const servicesTab = page.locator('button', { hasText: 'Services' });
  await servicesTab.click();

  // Wait for services to load
  await page.waitForTimeout(1000);

  // Check initial save button state
  const saveBtn = page.locator('[data-testid="drawer-save"]');
  console.log('Initial save button disabled:', await saveBtn.getAttribute('disabled'));

  // Find first service with edit button
  const firstService = page.locator('[data-testid^="service-item-"]').first();
  const editBtn = firstService.locator('[data-testid^="edit-service-"]');

  if (await editBtn.count()) {
    console.log('Found edit button, clicking...');
    await editBtn.click();

    // Check save button state after entering edit mode
    console.log('Save button disabled after edit click:', await saveBtn.getAttribute('disabled'));

    // Find hours input and change value
    const hoursInput = firstService.locator('input[aria-label="Hours"]');
    if (await hoursInput.count()) {
      console.log('Found hours input, changing value...');

      // Clear and set new value
      await hoursInput.clear();
      await hoursInput.fill('9');

      // Force trigger change event
      await hoursInput.dispatchEvent('change');
      await page.waitForTimeout(100);

      console.log('Save button disabled after hours change:', await saveBtn.getAttribute('disabled'));

      // Exit edit mode
      await editBtn.click();
      await page.waitForTimeout(100);

      console.log('Save button disabled after exit edit:', await saveBtn.getAttribute('disabled'));
    }
  }
});
