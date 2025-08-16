import { Page, Locator } from '@playwright/test';

/**
 * Board readiness helper resilient to responsive (hidden) layouts.
 * 1. Waits for grid DOM attachment (not necessarily visible on mobile).
 * 2. Prefers data-board-ready='1' but falls back to first detected card anywhere inside the grid.
 * 3. Returns first appointment card (may be hidden on mobile – caller can decide if visibility needed).
 */
export async function waitForBoardReady(page: Page, opts: { timeout?: number; requireVisibleCard?: boolean } = {}): Promise<Locator> {
  const { timeout = 15000, requireVisibleCard = true } = opts;
  const start = Date.now();
  const grid = page.locator('.nb-board-grid').first();

  // Wait for grid to be attached (do not require visibility – mobile may collapse)
  await grid.waitFor({ state: 'attached', timeout }).catch(() => {});

  const boardReady = page.locator('[data-board-ready="1"]');
  if (await boardReady.count()) {
    const firstAptId = await page.getAttribute('[data-first-apt-id]', 'data-first-apt-id').catch(() => null);
    if (firstAptId) {
      const firstViaAttr = page.locator(`[data-appointment-id="${firstAptId}"]`).first();
      if (await firstViaAttr.count()) return firstViaAttr;
    }
  }

  // Poll for any appointment card
  let card: Locator | null = null;
  while (Date.now() - start < timeout) {
    const candidate = page.locator('.nb-board-grid [data-appointment-id]').first();
    if (await candidate.count()) {
      if (!requireVisibleCard || await candidate.isVisible().catch(() => false)) {
        card = candidate;
        break;
      }
    }
    await page.waitForTimeout(100);
  }
  if (!card) throw new Error('Board readiness: no appointment card detected before timeout');
  return card;
}

export default waitForBoardReady;
