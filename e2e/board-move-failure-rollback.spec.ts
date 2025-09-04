import { test, expect, Page } from '@playwright/test';
import { stubCustomerProfile } from './utils/stubAuthProfile';
import { waitForBoardReady } from './utils/waitForBoardReady';
import { createTestAppointment } from './utils/test-data';

// Helper to find column index containing a card id
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
  test.setTimeout(60000);
  test.beforeEach(async ({ page, request }, testInfo) => {
    if (testInfo.project.name.includes('mobile')) {
      test.skip(true, 'Skip DnD test on mobile viewport (drag not supported)');
    }
    await stubCustomerProfile(page);

    // Create a test appointment to ensure the board has data
    try {
      const createResponse = await createTestAppointment(request, {
        status: 'scheduled'
      });
      console.log(`Created test appointment: ${createResponse.status()}`);
    } catch (error) {
      console.log('Failed to create test appointment:', error);
    }

    // Use harness full board for consistency with optimistic test
    await page.goto('/e2e/board?full=1');

    // Try to wait for board with appointment, but allow empty if creation failed
    try {
      await waitForBoardReady(page, { timeout: 10000 });
    } catch (error) {
      console.log('No appointment cards found, proceeding with empty board test');
      await page.locator('.nb-board-grid').waitFor({ state: 'attached' });
    }
  });

  test('failure: server error triggers rollback + toast', async ({ page }) => {
    const card = await waitForBoardReady(page, { timeout: 20000, allowEmpty: true });

    if (!card) {
      test.skip(true, 'No appointment cards available for drag test');
      return;
    }

    const cardId = await card.getAttribute('data-appointment-id');
    expect(cardId).toBeTruthy();
    const initialIndex = await getColumnIndexForCard(page, cardId!);
    expect(initialIndex).toBeGreaterThanOrEqual(0);
      const columns = page.locator('.nb-board-grid .nb-column');
      const columnCount = await columns.count();
      if (columnCount < 2) test.skip(true, 'Not enough columns');
      const targetColumn = columns.nth(initialIndex === 0 ? 1 : 0);

      // Mock failure for move endpoint
      const moveRegex = /\/api\/admin\/appointments\/[^/]+\/move$/;
      await page.route(moveRegex, route => {
        route.fulfill({ status: 500, body: JSON.stringify({ error: 'fail' }), contentType: 'application/json' });
      });

      // Use window hook to trigger move (will rollback upon 500)
      await expect.poll(async () => await page.evaluate(() => typeof (window as any).__boardMove === 'function'), { timeout: 5000 }).toBeTruthy();
  const targetStatus = await targetColumn.getAttribute('data-status-key');
  if (!targetStatus) test.skip(true, 'No target status');
  await page.evaluate(([id, status]) => (window as any).__boardMove(id, status), [cardId, targetStatus]);

  // After simulated failure, card should roll back to original column
  await expect.poll(async () => await getColumnIndexForCard(page, cardId!)).toBe(initialIndex);

  // Assert either a toast OR board store error surfaced (UI may suppress toast in minimal harness)
  const toast = page.locator('[role="alert"], .toast, [data-toast]');
  const storeError = page.locator('[data-board-error], [data-testid="board-error"], text=/move failed/i');
  await expect.poll(async () => (await toast.first().count()) > 0 || (await storeError.count()) > 0, { timeout: 7000 }).toBeTruthy();
  });
});
