import { test, expect, Page } from '@playwright/test';
import { stubCustomerProfile } from './utils/stubAuthProfile';

// Utility that loads full StatusBoard with toggles to isolate culprit of render loop.
async function expectBoardVisible(page: Page) {
  const grid = page.locator('.nb-board-grid');
  await expect(grid).toBeVisible({ timeout: 8000 });
  const columns = await page.locator('.nb-board-grid .nb-column').count();
  expect(columns).toBeGreaterThan(0);
}

const base = 'http://localhost:5173/e2e/board?full=1';

// Matrix of disabling components. We'll progressively enable pieces to find breaking combo.
// Order matters: start most stripped (disable all) then turn features back on.
const scenarios = [
  { name: 'full=1 + no dnd + no modal + no filter', qs: '&sb_nodnd=1&sb_nomodal=1&sb_nofilter=1' },
  { name: 'enable filters only', qs: '&sb_nodnd=1&sb_nomodal=1' },
  { name: 'enable modal only', qs: '&sb_nodnd=1&sb_nofilter=1' },
  { name: 'enable dnd only', qs: '&sb_nomodal=1&sb_nofilter=1' },
  { name: 'enable filters + modal', qs: '&sb_nodnd=1' },
  { name: 'enable filters + dnd', qs: '&sb_nomodal=1' },
  { name: 'enable modal + dnd', qs: '&sb_nofilter=1' },
  { name: 'all enabled (expected to currently loop)', qs: '' },
];

for (const s of scenarios) {
  test(`StatusBoard isolation: ${s.name}`, async ({ page }) => {
    await stubCustomerProfile(page);
    const url = base + s.qs;
    await page.goto(url);
    // Detect loop by harness error boundary
    const harnessError = page.locator('[data-harness-error]');
    // Wait a short period to allow mount
    await page.waitForTimeout(500);
    if (await harnessError.isVisible().catch(()=>false)) {
      const msg = await harnessError.textContent();
      test.info().annotations.push({ type: 'harness-error', description: msg || 'Unknown error' });
      // In loop scenario we don't expect grid visible
      if (!s.name.includes('all enabled')) {
        throw new Error(`Unexpected error in scenario: ${s.name}: ${msg}`);
      }
      return; // Accept failure only in last scenario (known broken state)
    }
    await expectBoardVisible(page);
  });
}
