import { test, expect } from '@playwright/test';
import { attachNetworkLogger } from './utils/networkLogger';
import { stubCustomerProfile } from './utils/stubAuthProfile';

/**
 * Quick Add Modal service catalog integration test
 * Flow updated to reflect ServiceCatalogModal-based UX (no inline search inside QuickAddModal):
 * 1. Open dashboard & stub backend endpoints
 * 2. Open Quick Add modal
 * 3. Click "Add Services" to open ServiceCatalogModal
 * 4. Search within catalog, expand groups, select a service row
 * 5. Assert selection reflected in catalog (selected-count) AND in QuickAdd chip list
 * 6. Close catalog and verify persistence
 */

test('quick add modal loads service catalog and selects operation', async ({ page }) => {
  await stubCustomerProfile(page);
  attachNetworkLogger(page); // TEMP diagnostic instrumentation
  // Capture console output for diagnostics
  page.on('console', msg => {
    // eslint-disable-next-line no-console
    console.log(`[BROWSER][${msg.type()}]`, msg.text());
  });
  // Additional focused diagnostics for API / network issues
  page.on('response', resp => {
    const url = resp.url();
    if (/\/api\//.test(url)) {
      // eslint-disable-next-line no-console
      console.log('[API][response]', resp.status(), url);
    }
  });
  page.on('requestfailed', req => {
    if (/\/api\//.test(req.url())) {
      // eslint-disable-next-line no-console
      console.log('[API][failed]', req.url(), req.failure()?.errorText);
    }
  });
  // Fully stub initial dashboard data endpoints to isolate frontend logic from backend/CORS
  await page.route(/\/api\/admin\/appointments\/board.*/, async route => {
    await route.fulfill({
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
  await page.route(/\/api\/admin\/dashboard\/stats.*/, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalAppointments: 2,
        completedAppointments: 1,
        unpaidTotal: 0,
        revenue: 0,
        recent: []
      })
    });
  });
  await page.route(/\/api\/admin\/appointments(?!\/board).*/, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { appointments: [] } })
    });
  });
  // Stub service operations endpoint to ensure options appear even if auth missing
  await page.route(/\/api\/admin\/service-operations$/, async route => {
    // IMPORTANT: ServiceCatalogModal filters out services where is_active is falsy.
    // Previous stub omitted is_active so everything was filtered -> "No services match".
    const json = [
      { id: 'op-oil', internal_code: 'OIL', name: 'Oil Change', category: 'MAINTENANCE', subcategory: null, skill_level: 1, default_hours: 1, base_labor_rate: 49.99, keywords: ['oil'], is_active: true, display_order: 1 },
      { id: 'op-brake', internal_code: 'BRK', name: 'Brake Service', category: 'SAFETY', subcategory: null, skill_level: 2, default_hours: 2, base_labor_rate: 199.0, keywords: ['brake'], is_active: true, display_order: 2 }
    ];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
  });
  await page.goto('http://localhost:5173/admin/dashboard', { waitUntil: 'networkidle' });

  // Open Quick Add via FAB
  await page.getByTestId('fab-quick-add').click();
  await page.getByTestId('quick-add-modal').waitFor({ timeout: 7000 });

  // Open Service Catalog Modal
  await page.getByTestId('quickadd-add-service-btn').click();

  // Wait for catalog search input (data-testid defined in ServiceCatalogModal.tsx)
  const catalogSearch = page.getByTestId('service-search');
  await expect(catalogSearch).toBeVisible();
  await catalogSearch.fill('oil');

  // Brief wait to allow auto-expansion logic to run (microtasks + fetch) before assertions
  await page.waitForTimeout(150); // small deterministic pause vs large arbitrary sleep

  // Expand all groups so filtered results render service rows
  const expandAll = page.getByRole('button', { name: /expand all/i });
  if (await expandAll.isVisible()) {
    await expandAll.click();
  }

  // Wait for and select the Oil Change service row
  const oilRow = page.getByTestId('service-row-op-oil');
  if (!(await oilRow.isVisible({ timeout: 500 }).catch(()=>false))) {
    // Capture diagnostics before hard failing
    const noMatchText = page.locator('text=No services match');
    if (await noMatchText.isVisible().catch(()=>false)) {
      // eslint-disable-next-line no-console
      console.log('[DIAG] Still seeing "No services match" after stub; dumping input placeholders');
      const inputs = await page.locator('input').all();
      for (const inp of inputs) { try { console.log('[INPUT]', await inp.getAttribute('placeholder')); } catch {} }
    }
  }
  await expect(oilRow).toBeVisible({ timeout: 4000 });
  await oilRow.click();

  // Selected count should increment to 1 inside catalog
  await expect(page.getByTestId('selected-count')).toHaveText(/1 selected/);

  // Close catalog
  await page.getByRole('button', { name: /^close$/i }).first().click(); // first Close (header) OR fallback below
  // If still open (selector visible), click any remaining Close button in footer
  if (await catalogSearch.isVisible().catch(()=>false)) {
    const footerClose = page.getByRole('button', { name: /^close$/i }).last();
    if (await footerClose.isVisible()) await footerClose.click();
  }

  // Verify chip list in Quick Add now contains Oil Change
  const chipList = page.getByTestId('quickadd-selected-services');
  await expect(chipList).toBeVisible();
  await expect(chipList).toContainText(/oil change/i);

  // Schedule button visible (may be disabled pending required fields)
  await expect(page.getByRole('button', { name: /schedule appointment/i })).toBeVisible();
});
