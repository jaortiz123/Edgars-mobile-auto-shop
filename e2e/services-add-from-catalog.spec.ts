import { test, expect } from '@playwright/test';

// Assumes global storageState auth already handled in global-setup.
// Goal: verify user can stage a service from catalog search.

test.describe('Services Tab - Add From Catalog (staged)', () => {
  test('stages catalog service then persists it, inline edits hours, and delete flows', async ({ page }) => {
  // Navigate to dashboard (auth token in storageState)
  await page.goto('/admin/dashboard');

    // Wait for first board card (shared readiness signal from previous increment)
    // Wait for board columns to render
    await page.locator('[data-testid="status-column-scroll"]').first().waitFor({ timeout: 15000 });
    // Locate first card via deterministic marker or fallback pattern
    let firstCard = page.locator('[data-first-card="1"]');
    if (!(await firstCard.count())) {
      firstCard = page.locator('[data-testid^="apt-card-"]').first();
    }
    await firstCard.waitFor({ state: 'visible', timeout: 15000 });

    // Open drawer by clicking first card (wait for possible network)
    // Use explicit open button if available to avoid interfering drag handlers
    const openBtn = firstCard.locator('[data-testid^="apt-card-open-"]');
    if (await openBtn.count()) {
      await Promise.all([
        page.waitForResponse(r => /\/api\/appointments\//.test(r.url()) && r.request().method()==='GET', { timeout: 12000 }).catch(()=>null),
        openBtn.first().click()
      ]);
    } else {
      await Promise.all([
        page.waitForResponse(r => /\/api\/appointments\//.test(r.url()) && r.request().method()==='GET', { timeout: 12000 }).catch(()=>null),
        firstCard.click()
      ]);
    }

    // Drawer should appear (allow extra time)
    const drawer = page.locator('[data-testid="drawer-open"]');
    await drawer.waitFor({ state: 'visible', timeout: 15000 });

    // Go to Services tab
    await page.getByRole('tab', { name: 'Services' }).click();

    // Ensure services root present
    await expect(page.locator('[data-testid="services-tab-root"]')).toBeVisible();

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

    // Search should clear
    await expect(searchInput).toHaveValue('');

    // Result list should disappear (no li nodes) or not be visible
    // Result list should disappear (search cleared) – allow small delay
    await page.waitForTimeout(100);
    await expect(page.locator('[data-testid="svc-catalog-results"]')).toHaveCount(0);

  // New staged service should appear in list with staged marker
  const stagedItem = page.locator('[data-testid="services-list"] [data-staged="1"]');

  // Validate the staged service displays the name captured and prefilled hours/price
  await expect(stagedItem.locator('[data-testid^="service-name-"]')).toContainText(firstName.substring(0, 4));
  // Hours & price (heuristic) should render (allow optional if catalog had no defaults)
  const hoursOrPrice = stagedItem.locator('[data-testid^="service-hours-"], [data-testid^="service-price-"]');
  await expect(hoursOrPrice.first()).toBeVisible();

    // Visual distinction: expect a background style (we used bg-white currently for all; adjust to assert staged marker attr)
    // We'll assert presence of staged marker via dataset attribute approach: add data-staged attribute (implementation may add later).
    // For now: soft assertion skip if attribute missing; ensures test won't falsely fail before attribute introduced.
    // Visual distinction: confirm staged marker present
    await expect(stagedItem).toHaveAttribute('data-staged', '1');

  // Click unified save button
    const saveBtn = page.locator('[data-testid="drawer-save"]');
    await expect(saveBtn).toBeVisible();
    await Promise.all([
      page.waitForResponse(r => /\/api\/appointments\/.+\/services$/.test(r.url()) && r.request().method()==='POST'),
      saveBtn.click()
    ]);
    // After save, staged marker should disappear
    await page.waitForTimeout(400);
    await expect(page.locator('[data-testid="services-list"] [data-staged="1"]')).toHaveCount(0);

    // INLINE EDIT hours of first saved service
    const firstSaved = page.locator('[data-testid^="service-item-"]').first();
    const editBtn = firstSaved.locator('[data-testid^="edit-service-"]');
    await editBtn.click(); // enter edit mode
    // Find hours input (has aria-label Hours)
    const hoursInput = firstSaved.locator('input[aria-label="Hours"]');
    if (await hoursInput.count()) {
      // Capture original hours text before editing (if any)
      const originalHoursText = await firstSaved.locator('[data-testid^="service-hours-"]').innerText().catch(()=>null);
      await hoursInput.fill('9');
      await editBtn.click(); // exit edit mode
      // Save changes
      const saveChangesBtn = page.locator('[data-testid="drawer-save"]');
      await expect(saveChangesBtn).toBeVisible();
      await Promise.all([
        page.waitForResponse(r => /\/api\/appointments\/.+\/services\/.+/.test(r.url()) && r.request().method()==='PATCH'),
        saveChangesBtn.click()
      ]);
      // Verify modified badge removed and hours show 9h (allow refresh time)
      await page.waitForTimeout(200);
      await expect(firstSaved.locator('[data-testid^="service-hours-"]')).toContainText('9h');
      // Ensure save button disappears
      // unified save button remains but should be disabled now
      await expect(page.locator('[data-testid="drawer-save"]')).toBeDisabled();
    }

    // MARK FOR DELETION (saved service)
    const savedServiceItem = page.locator('[data-testid^="service-item-"]').first();
    const deleteBtn = savedServiceItem.locator('[data-testid^="delete-service-"]');
    await deleteBtn.click(); // mark for deletion (should change label to Undo)
    await expect(deleteBtn).toHaveText(/Undo/);
    // Unified save handles deletions
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
    await stagedDeleteBtn.click(); // immediate removal
    await expect(page.locator('[data-testid="services-list"] [data-staged="1"]')).toHaveCount(0);
  });
});
