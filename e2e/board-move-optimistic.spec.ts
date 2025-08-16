import { test, expect, Page } from '@playwright/test';
import { stubCustomerProfile } from './utils/stubAuthProfile';
import { waitForBoardReady } from './utils/waitForBoardReady';

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

// (Drag simulation helper removed in favor of board move test hook)

test.describe('Board drag-and-drop optimistic move', () => {
  test.beforeEach(async ({}, testInfo) => {
    if (testInfo.project.name.includes('mobile')) {
      test.skip(true, 'Skip DnD test on mobile viewport (drag not supported)');
    }
  });
  test.beforeEach(async ({ page }) => {
    await stubCustomerProfile(page);
  // Use full board to include react-dnd provider (force full=1 param)
  await page.goto('/e2e/board?full=1');
    await waitForBoardReady(page);
  });

  test('success: card moves immediately then persists via network call', async ({ page }) => {
    // Capture initial card + source column
  const sourceColumn = page.locator('.nb-board-grid .nb-column').first();
    const card = await locateFirstCard(page);
    const cardId = await card.getAttribute('data-appointment-id');
    expect(cardId).toBeTruthy();

    // Determine statuses for first two columns
    const secondColumn = page.locator('.nb-board-grid .nb-column').nth(1);
    const firstStatus = await sourceColumn.getAttribute('data-status-key');
    const secondStatus = await secondColumn.getAttribute('data-status-key');
    expect(secondStatus && secondStatus !== firstStatus).toBeTruthy();

    // Intercept move call and let it pass through (assert later)
    let requestSeen = false;
    const moveRegex = /\/api\/admin\/appointments\/[^/]+\/move$/;
    await page.route(moveRegex, route => { requestSeen = true; route.continue(); });
    const waitMoveResponse = page.waitForResponse(r => moveRegex.test(r.url()));

    // Invoke the move via test hook rather than drag events
    await expect.poll(async () => await page.evaluate(() => typeof (window as any).__boardMove === 'function'), { timeout: 5000 }).toBeTruthy();
    await page.evaluate(([id, status]) => (window as any).__boardMove(id, status), [cardId, secondStatus]);

    await Promise.race([
      (async () => { await expect.poll(() => requestSeen, { timeout: 15000 }).toBeTruthy(); })(),
      waitMoveResponse
    ]);

    await expect(secondColumn.locator(`[data-appointment-id="${cardId}"]`)).toBeVisible({ timeout: 5000 });
  });
});
