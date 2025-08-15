import { test, expect, Page } from '@playwright/test';

async function locateFirstCard(page: Page) {
  const first = page.locator('.nb-board-grid .nb-column').first().locator('[data-appointment-id]').first();
  await first.waitFor({ state: 'visible' });
  return first;
}

// Helper to get parent column key via closest column element
async function getColumnIndexForCard(page: Page, cardId: string) {
  const columns = page.locator('.nb-board-grid .nb-column');
  const count = await columns.count();
  for (let i = 0; i < count; i++) {
    const col = columns.nth(i);
    if (await col.locator(`[data-appointment-id="${cardId}"]`).count()) return i;
  }
  return -1;
}

test.describe('Board drag-and-drop rollback on failure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page.locator('.nb-board-grid')).toBeVisible();
    await page.locator('[data-first-apt-id]').first().waitFor();
  });

  test('failure: server error triggers rollback + toast', async ({ page }) => {
    const card = await locateFirstCard(page);
    const cardId = await card.getAttribute('data-appointment-id');
    expect(cardId).toBeTruthy();
    const initialIndex = await getColumnIndexForCard(page, cardId!);
    expect(initialIndex).toBeGreaterThanOrEqual(0);

    const targetColumn = page.locator('.nb-board-grid .nb-column').nth(initialIndex === 0 ? 1 : 0);

    // Mock failure for move endpoint
    await page.route(/\/admin\/appointments\/.*\/move$/, route => {
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'fail' }), contentType: 'application/json' });
    });

    // Perform DnD
    await card.dispatchEvent('dragstart');
    await targetColumn.dispatchEvent('dragover');
    await targetColumn.dispatchEvent('drop');

    // Optimistic move: card appears in target quickly
    await expect(targetColumn.locator(`[data-appointment-id="${cardId}"]`)).toBeVisible({ timeout: 500 });

    // After network failure, expect rollback: poll until card returns to original column
    await expect.poll(async () => await getColumnIndexForCard(page, cardId!)).toBe(initialIndex);

    // Toast visible (generic error) - look for substring 'failed' (case-insensitive)
    const toast = page.locator('[role="alert"], .toast, [data-toast]');
    await expect(toast.filter({ hasText: /failed/i })).toBeVisible();
  });
});
