import { test, expect, Page } from '@playwright/test';
import { stubCustomerProfile } from './utils/stubAuthProfile';
// DEPRECATED: Board isolation harness no longer needed after selector refactor.
// Test converted to a single smoke assertion on real dashboard (kept filename for history).

// Utility that loads full StatusBoard with toggles to isolate culprit of render loop.
async function expectBoardVisible(page: Page) {
  const grid = page.locator('.nb-board-grid');
  await grid.first().waitFor({ state: 'attached', timeout: 10000 });
  // Allow time for population; poll column count (>=1) OR visibility
  await expect.poll(async () => {
    const count = await page.locator('.nb-board-grid .nb-column').count();
    const vis = await grid.isVisible().catch(()=>false);
    return count > 0 || vis ? 'ready' : null;
  }, { timeout: 20000 }).toBe('ready');
}

// Old harness base (retained for reference)
// const base = 'http://localhost:5173/e2e/board?full=1';
const DASHBOARD = 'http://localhost:5173/admin/dashboard';

// Matrix of disabling components. We'll progressively enable pieces to find breaking combo.
// Order matters: start most stripped (disable all) then turn features back on.
test('StatusBoard smoke: dashboard renders board grid', async ({ page }) => {
  await stubCustomerProfile(page);
  // Capture console output for diagnostics (Firefox NetworkError investigation)
  page.on('console', msg => {
    // eslint-disable-next-line no-console
    console.log(`[BROWSER][${msg.type()}]`, msg.text());
  });
  // === TEMPORARY DIAGNOSTIC NETWORK LOGGING (remove after root cause identified) ===
  const reqStart = new Map<string, number>();
  function now() { return Date.now(); }
  page.on('request', req => {
    const url = req.url();
    if (url.includes('/api/')) {
      reqStart.set(req.url()+req.method(), now());
      // eslint-disable-next-line no-console
      console.log(`[API REQ] ${req.method()} ${url}`);
    }
  });
  page.on('response', async resp => {
    const req = resp.request();
    const url = req.url();
    if (url.includes('/api/')) {
      const key = req.url()+req.method();
      const started = reqStart.get(key);
      const dur = started ? (now() - started) : undefined;
      // eslint-disable-next-line no-console
      console.log(`[API RES] ${resp.status()} ${req.method()} ${url}${dur!==undefined ? ` (${dur}ms)` : ''}`);
    }
  });
  page.on('requestfailed', req => {
    const url = req.url();
    if (url.includes('/api/')) {
      const key = req.url()+req.method();
      const started = reqStart.get(key);
      const dur = started ? (now() - started) : undefined;
      // eslint-disable-next-line no-console
      console.log(`[API FAIL] ${req.failure()?.errorText || 'unknown-error'} ${req.method()} ${url}${dur!==undefined ? ` (${dur}ms)` : ''}`);
    }
  });
  // ============================================================================
  // Stub board API with a minimal deterministic dataset to avoid backend dependency timing
  await page.route('**/admin/appointments/board**', route => {
  // eslint-disable-next-line no-console
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        columns: [
          { key: 'SCHEDULED', title: 'Scheduled' },
          { key: 'IN_PROGRESS', title: 'In Progress' },
          { key: 'COMPLETED', title: 'Completed' }
        ],
        cards: [
          { id: 'APT1', status: 'SCHEDULED', position: 1, servicesSummary: 'Oil Change', customerName: 'Alpha' },
          { id: 'APT2', status: 'IN_PROGRESS', position: 1, servicesSummary: 'Brakes', customerName: 'Beta' }
        ]
      })
    });
  });
  await page.goto(DASHBOARD);
  // Inject console log summarizing DOM state for diagnostics
  await page.waitForTimeout(500);
  await expectBoardVisible(page);
});
