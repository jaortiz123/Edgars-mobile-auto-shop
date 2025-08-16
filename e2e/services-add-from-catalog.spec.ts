import { test, expect } from '@playwright/test';
import { stubCustomerProfile } from './utils/stubAuthProfile';
import { waitForBoardReady } from './utils/waitForBoardReady';

// Assumes global storageState auth already handled in global-setup.
// Goal: verify user can stage a service from catalog search.

test.describe('Services Tab - Add From Catalog (staged)', () => {
  test('stages catalog service then persists it, inline edits hours, and delete flows', async ({ page }) => {
    await stubCustomerProfile(page);
    // Navigate to dashboard (auth token in storageState)
    await page.goto('/admin/dashboard');

    // Unified readiness
    const firstCard = await waitForBoardReady(page);

    // Open drawer by clicking first card (dedicated open button preferred)
    const openBtn = firstCard.locator('[data-testid^="apt-card-open-"]');
    let opened = false;
    if (await openBtn.count()) {
      try { await openBtn.first().click(); opened = true; } catch { /* retry with force */ await openBtn.first().click({ force: true }); opened = true; }
    } else {
      try { await firstCard.click(); opened = true; } catch { await firstCard.click({ force: true }); opened = true; }
    }
    if (!opened) throw new Error('Failed to trigger drawer open');

    // Wait for drawer root (either empty state variant or populated variant)
    const drawer = page.locator('[data-testid="drawer-open"], [data-testid="drawer-root"], [data-testid^="drawer"]');
    await drawer.first().waitFor({ state: 'visible', timeout: 15000 }).catch(()=>{});

    // Go to Services tab
    await page.getByRole('tab', { name: 'Services' }).click();

    // Ensure services root present (either data-testid or legacy data-testid-root)
    const servicesRoot = page.locator('[data-testid="services-tab-root"], [data-testid-root="services-tab-root"]');
    await expect(servicesRoot.first()).toBeVisible({ timeout: 10000 });

    // Type search query (choose a token likely in catalog: 'brake' or 'oil')
    const searchInput = page.locator('[data-testid="svc-catalog-search"]');
    await searchInput.fill('oil');

    // Wait for results list
    const results = page.locator('[data-testid="svc-catalog-results"] li');
    await expect(results.first()).toBeVisible();

    // Capture the target service name text BEFORE clicking
    const firstName = await results.first().locator('span.font-medium').innerText();

    // Click first result to stage it
    await results.first().click();

    // Search may or may not auto-clear depending on implementation version; if not empty after slight delay, clear manually
    await page.waitForTimeout(150);
    if ((await searchInput.inputValue()) !== '') {
      await searchInput.fill('');
    }

  // Result list should disappear (search cleared) – allow small delay
  await page.waitForTimeout(100);
  // New staged service should appear in list with staged marker (or already visible if list persisted)
  const stagedItem = page.locator('[data-testid="services-list"] [data-staged="1"]');
  await expect(stagedItem).toBeVisible();

    // Validate the staged service displays the name captured and prefilled hours/price
    await expect(stagedItem.locator('[data-testid^="service-name-"]')).toContainText(firstName.substring(0, 4));
    const hoursOrPrice = stagedItem.locator('[data-testid^="service-hours-"], [data-testid^="service-price-"]');
    await expect(hoursOrPrice.first()).toBeVisible();

    await expect(stagedItem).toHaveAttribute('data-staged', '1');

    // Click unified save button
    const saveBtn = page.locator('[data-testid="drawer-save"]');
    await expect(saveBtn).toBeVisible();
    await Promise.all([
      page.waitForResponse(r => /\/api\/appointments\/.+\/services$/.test(r.url()) && r.request().method()==='POST'),
      saveBtn.click()
    ]);
    await page.waitForTimeout(400);
    await expect(page.locator('[data-testid="services-list"] [data-staged="1"]')).toHaveCount(0);

    // INLINE EDIT hours of first saved service
    const firstSaved = page.locator('[data-testid^="service-item-"]').first();
    const editBtn = firstSaved.locator('[data-testid^="edit-service-"]');
    await editBtn.click();
    const hoursInput = firstSaved.locator('input[aria-label="Hours"]');
    if (await hoursInput.count()) {
      await hoursInput.fill('9');
      await editBtn.click();
      const saveChangesBtn = page.locator('[data-testid="drawer-save"]');
      await expect(saveChangesBtn).toBeVisible();
      await Promise.all([
        page.waitForResponse(r => /\/api\/appointments\/.+\/services\/.+/.test(r.url()) && r.request().method()==='PATCH'),
        saveChangesBtn.click()
      ]);
      await page.waitForTimeout(200);
      await expect(firstSaved.locator('[data-testid^="service-hours-"]')).toContainText('9h');
      await expect(page.locator('[data-testid="drawer-save"]')).toBeDisabled();
    }

    // MARK FOR DELETION (saved service)
    const savedServiceItem = page.locator('[data-testid^="service-item-"]').first();
    const deleteBtn = savedServiceItem.locator('[data-testid^="delete-service-"]');
    await deleteBtn.click();
    await expect(deleteBtn).toHaveText(/Undo/);
    const unifiedSaveAfterDelete = page.locator('[data-testid="drawer-save"]');
    await expect(unifiedSaveAfterDelete).toBeVisible();
    await Promise.all([
      page.waitForResponse(r => /\/api\/appointments\/.+\/services\/.+/.test(r.url()) && r.request().method()==='DELETE'),
      unifiedSaveAfterDelete.click()
    ]);
    await page.waitForTimeout(250);
    await expect(page.locator('[data-testid="drawer-save"]')).toBeDisabled();

    // STAGE THEN REMOVE IMMEDIATELY (staged service delete)
    await searchInput.fill('oil');
    const results2 = page.locator('[data-testid="svc-catalog-results"] li');
    await expect(results2.first()).toBeVisible();
    await results2.first().click();
    const newStaged = page.locator('[data-testid="services-list"] [data-staged="1"]');
    await expect(newStaged).toHaveCount(1);
    const stagedDeleteBtn = newStaged.locator('[data-testid^="delete-service-"]');
    await stagedDeleteBtn.click();
    await expect(page.locator('[data-testid="services-list"] [data-staged="1"]')).toHaveCount(0);
  });
});
