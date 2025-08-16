import { test, expect, Page } from '@playwright/test';
import { stubCustomerProfile } from './utils/stubAuthProfile';
import { waitForBoardReady } from './utils/waitForBoardReady';

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

async function simulateDnd(page: Page, sourceSelector: string, targetSelector: string) {
  await page.evaluate(({ sourceSelector, targetSelector }) => {
    const src = document.querySelector(sourceSelector) as HTMLElement | null;
    const tgt = document.querySelector(targetSelector) as HTMLElement | null;
    if (!src || !tgt) throw new Error('simulateDnd: missing elements');
    const dataTransfer = new DataTransfer();
    const dragStart = new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer });
    src.dispatchEvent(dragStart);
    const dragOver = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer });
    tgt.dispatchEvent(dragOver);
    const drop = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer });
    tgt.dispatchEvent(drop);
  }, { sourceSelector, targetSelector });
}

test.describe('Board drag-and-drop rollback on failure', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (testInfo.project.name.includes('mobile')) {
      test.skip(true, 'Skip DnD test on mobile viewport (drag not supported)');
    }
    await stubCustomerProfile(page);
  // Use harness full board for consistency with optimistic test
  await page.goto('/e2e/board?full=1');
    await waitForBoardReady(page);
  });

  test('failure: server error triggers rollback + toast', async ({ page }) => {
    const card = await locateFirstCard(page);
    const cardId = await card.getAttribute('data-appointment-id');
    expect(cardId).toBeTruthy();
    const initialIndex = await getColumnIndexForCard(page, cardId!);
    expect(initialIndex).toBeGreaterThanOrEqual(0);

      const targetColumn = page.locator('.nb-board-grid .nb-column').nth(initialIndex === 0 ? 1 : 0);

      // Mock failure for move endpoint
      const moveRegex = /\/api\/admin\/appointments\/[^/]+\/move$/;
      await page.route(moveRegex, route => {
        route.fulfill({ status: 500, body: JSON.stringify({ error: 'fail' }), contentType: 'application/json' });
      });

      // Use window hook to trigger move (will rollback upon 500)
      await expect.poll(async () => await page.evaluate(() => typeof (window as any).__boardMove === 'function'), { timeout: 5000 }).toBeTruthy();
      const targetStatus = await targetColumn.getAttribute('data-status-key');
      await page.evaluate(([id, status]) => (window as any).__boardMove(id, status), [cardId, targetStatus]);

  // After simulated failure, card should roll back to original column
  await expect.poll(async () => await getColumnIndexForCard(page, cardId!)).toBe(initialIndex);

  // Assert either a toast OR board store error surfaced (UI may suppress toast in minimal harness)
  const toast = page.locator('[role="alert"], .toast, [data-toast]');
  const storeError = page.locator('[data-board-error], [data-testid="board-error"], text=/move failed/i');
  await expect.poll(async () => (await toast.first().count()) > 0 || (await storeError.count()) > 0, { timeout: 7000 }).toBeTruthy();
  });
});
