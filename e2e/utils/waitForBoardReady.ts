import { Page, Locator, expect } from '@playwright/test';

/**
 * Board readiness helper resilient to responsive (hidden) layouts with proper polling and network stability.
 * 1. Waits for network idle to ensure all API responses are complete
 * 2. Uses expect.poll() for reliable state detection
 * 3. Prefers data-board-ready='1' but falls back to first detected card
 * 4. Returns first appointment card with proper timing guarantees
 * 5. Can optionally handle empty boards gracefully
 */
export async function waitForBoardReady(page: Page, opts: { timeout?: number; requireVisibleCard?: boolean; allowEmpty?: boolean } = {}): Promise<Locator | null> {
  const { timeout = 30000, requireVisibleCard = true, allowEmpty = false } = opts;

  // Wait for network stability first - critical for board state consistency
  await page.waitForLoadState('networkidle', { timeout });

  const grid = page.locator('.nb-board-grid').first();

  // Wait for grid to be attached with proper polling
  await expect.poll(async () => {
    return await grid.count();
  }, { timeout }).toBeGreaterThan(0);

  // Check for board-ready indicator with polling
  let boardReadyIndicator = 0;
  try {
    await expect.poll(async () => {
      const boardReady = page.locator('[data-board-ready="1"]');
      return await boardReady.count();
    }, { timeout: 5000 }).toBeGreaterThan(0);
    boardReadyIndicator = 1;
  } catch {
    // No board-ready indicator found, continue with fallback
  }

  if (boardReadyIndicator > 0) {
    const firstAptId = await page.getAttribute('[data-first-apt-id]', 'data-first-apt-id').catch(() => null);
    if (firstAptId) {
      const firstViaAttr = page.locator(`[data-appointment-id="${firstAptId}"]`).first();
      try {
        await expect.poll(async () => {
          return await firstViaAttr.count();
        }, { timeout: 5000 }).toBeGreaterThan(0);
        return firstViaAttr;
      } catch {
        // Fall through to general card detection
      }
    }
  }

  // Poll for any appointment card using expect.poll for reliability
  let cardFound = false;
  try {
    await expect.poll(async () => {
      const candidate = page.locator('.nb-board-grid [data-appointment-id]').first();
      const count = await candidate.count();
      if (count === 0) return false;

      if (!requireVisibleCard) return true;

      const isVisible = await candidate.isVisible().catch(() => false);
      return isVisible;
    }, {
      timeout,
      intervals: [100, 200, 500] // Gradual backoff for efficiency
    }).toBe(true);
    cardFound = true;
  } catch {
    // No card found within timeout
  }

  if (!cardFound && !allowEmpty) {
    throw new Error('Board readiness: no appointment card detected before timeout');
  }

  if (cardFound) {
    const card = page.locator('.nb-board-grid [data-appointment-id]').first();
    // Add small stabilization delay after detection
    await page.waitForTimeout(200);
    return card;
  }

  return null;
}

export default waitForBoardReady;
