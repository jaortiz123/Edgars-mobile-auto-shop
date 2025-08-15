import { test, expect, Page } from '@playwright/test';

// Assumptions:
// - Backend test DB seeded with at least one appointment in SCHEDULED and a target column (e.g., IN_PROGRESS) exists.
// - Board cards have data attributes or can be selected via column containers.
// - Move endpoint: PATCH /admin/appointments/:id/move intercepted below.

async function locateFirstCard(page: Page) {
  const first = page.locator('.nb-board-grid .nb-column').first().locator('[data-appointment-id]').first();
  await first.waitFor({ state: 'visible' });
  return first;
}

function columnByKey(page: Page, key: string) {
  return page.locator(`.nb-board-grid .nb-column[data-status-key="${key}"]`);
}

test.describe('Board drag-and-drop optimistic move', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page.locator('.nb-board-grid')).toBeVisible();
    await page.locator('[data-first-apt-id]').first().waitFor();
  });

  test('success: card moves immediately then persists via network call', async ({ page }) => {
    // Capture initial card + source column
    const sourceColumn = page.locator('.nb-board-grid .nb-column').first();
    const card = await locateFirstCard(page);
    const cardId = await card.getAttribute('data-appointment-id');
    expect(cardId).toBeTruthy();

    // Determine a different target column (second column)
    const targetColumn = page.locator('.nb-board-grid .nb-column').nth(1);

    // Intercept move call and let it pass through (assert later)
    let requestSeen = false;
    await page.route(/\/admin\/appointments\/.*\/move$/, route => {
      requestSeen = true;
      route.continue();
    });

    // Drag & drop simulation (fallback: dispatch pointer events)
    await card.dispatchEvent('dragstart');
    await targetColumn.dispatchEvent('dragover');
    await targetColumn.dispatchEvent('drop');

    // Optimistic expectation: card appears in target column quickly
    await expect(targetColumn.locator(`[data-appointment-id="${cardId}"]`)).toBeVisible({ timeout: 500 });

    // Wait for network request to occur
    await expect.poll(() => requestSeen).toBeTruthy();
  });
});
