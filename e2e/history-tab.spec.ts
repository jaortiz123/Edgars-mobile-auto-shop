import { test, expect } from '@playwright/test';
import { stubCustomerProfile } from './utils/stubAuthProfile';

// End-to-end verification of the Customer History tab within the Appointment Drawer.
// This covers: login -> dashboard -> open first appointment -> switch to History tab -> assert history loads without auth errors.
// Fails clearly if 403 or network error occurs.

test.describe('Appointment Drawer History Tab', () => {
  test('loads history data without 403 (pre-seeded advisor token)', async ({ page }) => {
    // Temporary: skip on very narrow mobile viewports until dedicated mobile interaction path is added
    const vp = page.viewportSize();
    if (vp && vp.width < 600) {
      test.skip(true, 'Mobile layout requires bespoke navigation adjustments – skipping for now');
    }
  // 1. Stub profile endpoint early to avoid CORS noise / auth init failures
  await stubCustomerProfile(page);
  // 2. With storageState applied globally (advisor token), just prime origin to load state into context
  await page.goto('http://localhost:5173/');

    // Capture history-related console logs for diagnostics
    const historyLogs: string[] = [];
    page.on('console', msg => { const txt = msg.text(); if (/history/i.test(txt)) historyLogs.push(txt); });

  // 4. Navigate to dashboard (token should already reside in localStorage via storageState)
  await page.goto('http://localhost:5173/admin/dashboard');

    // 4. Wait for first card (data-first-card) and open deterministically
    const firstCard = page.locator('[data-first-card="1"]');
    await firstCard.waitFor({ state: 'visible', timeout: 20000 });
    // Derive id from its data-testid attribute
    const cardTestId = await firstCard.getAttribute('data-testid');
    expect(cardTestId).toBeTruthy();
    const firstAptId = cardTestId!.replace('apt-card-','');
    const openBtn = firstCard.locator('[data-testid^="apt-card-open-"]');
    if (await openBtn.count()) {
      await Promise.all([
        page.waitForResponse(r => r.url().includes(`/api/appointments/${firstAptId}`) && r.request().method()==='GET', { timeout: 8000 }).catch(()=>null),
        openBtn.first().click()
      ]);
    } else {
      await Promise.all([
        page.waitForResponse(r => r.url().includes(`/api/appointments/${firstAptId}`) && r.request().method()==='GET', { timeout: 8000 }).catch(()=>null),
        firstCard.click()
      ]);
    }

    // Collect responses for diagnostics
    const responses: { url: string; status: number }[] = [];
    page.on('response', r => { if (r.url().includes('/api/')) responses.push({ url: r.url(), status: r.status() }); });

    // Deterministically wait for drawer and enforce numeric customer id to avoid silent fallback cascade
    const drawerEl = page.getByTestId('drawer-open');
    await drawerEl.waitFor({ timeout: 10000 });
    const customerId = await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="drawer-open"]');
      const cid = el?.getAttribute('data-customer-id') || '';
      if (!cid) return null; // keep waiting
      // Fail fast if fallback synthetic id surfaces
      if (!/^\d+$/.test(cid)) {
        // Throw inside page context to bubble up
        throw new Error(`Non-numeric customer id encountered: ${cid}`);
      }
      return cid;
    }, { timeout: 12000 });
    const resolvedCustomerId = (await customerId.jsonValue()) as string;
    expect(/^\d+$/.test(resolvedCustomerId), `numeric customer id resolved (responses: ${responses.map(r=>r.status+':'+r.url).join(', ')})`).toBeTruthy();

    // Drawer should open
    const drawer = page.getByTestId('drawer-open');
    await expect(drawer).toBeVisible();

    // 6. Switch to History tab
    // Attach request listeners for diagnostics before clicking History
    const historyRequests: { method: string; url: string; auth?: string }[] = [];
    page.on('request', r => {
      if (r.url().includes('/customers/') && r.url().includes('/history')) {
        // Capture (truncated) Authorization header for diagnostics
        try {
          const auth = r.headers()['authorization'];
          historyRequests.push({ method: r.method(), url: r.url(), auth: auth ? `${auth.slice(0,25)}…` : undefined });
        } catch {
          historyRequests.push({ method: r.method(), url: r.url() });
        }
      }
    });

    const historyTab = page.getByRole('tab', { name: /history/i });
    // Debug: log derived customer id and token presence before history fetch
    await page.evaluate(() => {
      const cid = document.querySelector('[data-testid="drawer-open"]')?.getAttribute('data-customer-id');
      // eslint-disable-next-line no-console
      console.log('[e2e][debug] pre-history click', { customerId: cid, tokenPresent: !!(localStorage.getItem('auth_token') || localStorage.getItem('token')) });
    });
    await historyTab.click();

  // Wait for history network call referencing this customer id
  // Loosen pattern: just inclusion of customers/{id}/history path anywhere in URL
  const historyNetwork = await page.waitForResponse(r => r.url().includes(`/customers/${resolvedCustomerId}/history`) && r.request().method() === 'GET', { timeout: 8000 }).catch(() => null);

  if (!historyNetwork) {
    // eslint-disable-next-line no-console
    console.log('[e2e][debug] history network response not captured; observed requests:', historyRequests);
  } else {
    try {
      const req = historyNetwork.request();
      // eslint-disable-next-line no-console
      console.log('[e2e][debug] history response status', historyNetwork.status(), 'auth hdr present?', !!req.headers()['authorization']);
    } catch { /* ignore */ }
  }

  // 7. Assert that no auth error is displayed (retry logic would produce banner)
  const errorBanner = drawer.getByText(/failed to load customer history/i);
  await expect(errorBanner, 'history fetch should succeed with valid token').toHaveCount(0);

    // 8. Either appointments render or empty state appears (both are acceptable success states)
    const emptyState = drawer.getByText(/no appointment history/i);
    const yearGroupHeader = drawer.getByRole('button', { name: /\d{4}/ }).first();

    await Promise.race([
      emptyState.waitFor({ timeout: 10000 }).catch(() => {}),
      yearGroupHeader.waitFor({ timeout: 10000 }).catch(() => {})
    ]);

    // If neither appeared, capture diagnostics
    const emptyVisible = await emptyState.isVisible();
    const yearVisible = await yearGroupHeader.isVisible();
    expect(emptyVisible || yearVisible, 'either empty state or at least one year group should be visible').toBeTruthy();

    // 9. If UI did not issue the history fetch automatically, perform a direct fetch inside the page using stored token
    if (!historyNetwork) {
      // eslint-disable-next-line no-console
      console.log('DEBUG historyRequests observed:', historyRequests);
      await page.evaluate(() => {
        // eslint-disable-next-line no-console
        console.log('DEBUG localStorage keys', Object.keys(localStorage));
        // eslint-disable-next-line no-console
        console.log('DEBUG auth_token present?', !!localStorage.getItem('auth_token'));
      });
    }
  expect(historyNetwork, `history network response captured via UI flow. Seen requests: ${historyRequests.map(r=>`${r.method} ${r.url}${r.auth?` auth=${r.auth}`:''}`).join(', ')}`).not.toBeNull();
    if (historyNetwork) expect(historyNetwork.status(), 'history endpoint status').toBe(200);

    // Attach history logs if any
    if (historyLogs.length) {
      // eslint-disable-next-line no-console
      console.log('History debug logs:', historyLogs.join('\n'));
    }
  });
});
