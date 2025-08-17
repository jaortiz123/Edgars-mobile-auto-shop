import { test, expect } from '@playwright/test';
import { stubCustomerProfile } from './utils/stubAuthProfile';

// Clean, deterministic invoice lifecycle: create COMPLETED appt -> generate invoice -> record payment -> assert PAID.
// Relies on: window.__openAppt, data-testid="apt-card-<id>", drawer generate-invoice-btn, invoice detail payment modal test ids.

import type { Page } from '@playwright/test';

async function createCompletedAppointment(page: Page) {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  if (!token) throw new Error('Auth token missing (createCompletedAppointment)');
  const creationIso = new Date().toISOString();
  const resp = await page.request.post('http://localhost:3001/api/admin/appointments', {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { status: 'COMPLETED', start: creationIso, total_amount: 125.00, paid_amount: 0 }
  });
  if (!resp.ok()) {
    const body = await resp.text();
    throw new Error(`Failed to create completed appointment (${resp.status()}): ${body}`);
  }
  const json = await resp.json().catch(() => ({}));
  const apptId = json.data?.id || json.id || json.appointment?.id;
  if (!apptId) return apptId;
  // Seed at least one service so invoice has non-zero total.
  const svcResp = await page.request.post(`http://localhost:3001/api/appointments/${apptId}/services`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { name: 'Brake Inspection', estimated_price: 150.00, estimated_hours: 1.0 }
  });
  if (!svcResp.ok()) {
    const body = await svcResp.text();
    throw new Error(`Failed to seed service (${svcResp.status()}): ${body}`);
  }
  return apptId;
}

test.describe('Invoice Lifecycle (happy path)', () => {
  test('Generate -> Pay -> PAID', async ({ page }, testInfo) => {
    await stubCustomerProfile(page);

    // 1. Navigate once to establish origin & storageState, then create appointment.
    await page.goto('http://localhost:5173/e2e/board?full=1');
    const apptId = await createCompletedAppointment(page);
    if (!apptId) throw new Error('No appointment id returned');

    // 2. Reload board so new card mounts.
    await page.reload();
    const card = page.locator(`[data-testid="apt-card-${apptId}"]`);
    await card.waitFor({ timeout: 10_000 });

    // 3. Open drawer via test hook.
    await page.evaluate((id) => { (window as any).__openAppt && (window as any).__openAppt(id); }, apptId);
    const drawer = page.getByTestId('drawer-open');
    await drawer.waitFor({ state: 'visible', timeout: 15_000 });

    // 4. Generate invoice via UI (preferred). Fallback to API if button missing.
    let invoiceId: string | null = null;
    const genBtn = page.getByTestId('generate-invoice-btn');
    if (await genBtn.isVisible().catch(() => false)) {
      await genBtn.click();
      await expect(page).toHaveURL(/\/admin\/invoices\//, { timeout: 20_000 });
      await page.waitForLoadState('networkidle').catch(()=>{});
      const currentUrl = page.url();
      const m = currentUrl.match(/\/admin\/invoices\/(.+)$/);
      invoiceId = m?.[1] || null;
      testInfo.attach('navigated-invoice-url', { body: currentUrl, contentType: 'text/plain' });
    } else {
      // Fallback API call
      const token = await page.evaluate(() => localStorage.getItem('auth_token'));
      if (!token) throw new Error('Auth token missing for fallback invoice generation');
      const invResp = await page.request.post(`http://localhost:3001/api/admin/appointments/${apptId}/invoice`, { headers: { Authorization: `Bearer ${token}` } });
      const dbg = await invResp.text();
      if (!invResp.ok()) throw new Error(`Invoice generation API failed (${invResp.status()}): ${dbg}`);
      try {
        const invJson = JSON.parse(dbg);
        const inv = invJson.data || invJson.invoice || invJson.data?.invoice;
        invoiceId = inv?.id || inv?.invoice_id || invJson.id;
      } catch {
        // ignore parse error
      }
      if (!invoiceId) throw new Error('Could not parse invoice id from API response');
      await page.goto(`http://localhost:5173/admin/invoices/${invoiceId}`);
      await expect(page).toHaveURL(new RegExp(`/admin/invoices/${invoiceId}`));
    }

    // 5. Wait for invoice detail to load (either skeleton then header or direct header) then record payment.
  const headerLocator = page.getByRole('heading', { name: /Invoice/ });
    // Wait up to 20s for either header or skeleton to appear then resolve header.
    await Promise.race([
      headerLocator.waitFor({ timeout: 20_000 }),
      page.getByTestId('invoice-skeleton').waitFor({ timeout: 20_000 })
    ]).catch(() => {});
    // If skeleton appeared, wait for it to disappear
    if (await page.getByTestId('invoice-skeleton').isVisible().catch(()=>false)) {
      await page.getByTestId('invoice-skeleton').waitFor({ state: 'hidden', timeout: 20_000 }).catch(()=>{});
    }
    const recordBtn = page.getByTestId('record-payment-btn');
    const startWait = Date.now();
    while (Date.now() - startWait < 25_000) {
      if (await recordBtn.isVisible().catch(()=>false)) break;
      await page.waitForTimeout(500);
    }
    if (!(await recordBtn.isVisible().catch(()=>false))) {
      const html = await page.content().catch(()=>'<no content>');
      testInfo.attach('invoice-page-html', { body: html.substring(0, 12_000), contentType: 'text/html' });
      testInfo.attach('final-url', { body: page.url(), contentType: 'text/plain' });
      throw new Error('record-payment-btn not visible after waiting 25s');
    }
    await expect(recordBtn).not.toBeDisabled();
    await recordBtn.click();

    const modal = page.getByTestId('record-payment-modal');
    await expect(modal).toBeVisible();

  // Fetch fresh invoice JSON directly to obtain precise cents due.
  const invUrl = page.url();
  const idMatch = invUrl.match(/\/admin\/invoices\/(.+)$/);
  if (!idMatch) throw new Error('Cannot parse invoice id from URL');
  const invoiceIdForPay = idMatch[1];
  const invApiResp = await page.request.get(`http://localhost:3001/api/admin/invoices/${invoiceIdForPay}`);
  if (!invApiResp.ok()) throw new Error(`Failed to refetch invoice before payment (${invApiResp.status()})`);
  const invJson = await invApiResp.json();
  const amountDueCents = invJson.data?.invoice?.amount_due_cents ?? invJson.invoice?.amount_due_cents;
  if (amountDueCents <= 0) throw new Error('Expected positive amount due after service seeding');
  const amountDueDollars = (amountDueCents / 100);
    const amountInput = page.getByTestId('payment-amount-input');
    await amountInput.fill(amountDueDollars.toFixed(2));
    const submitBtn = page.getByTestId('payment-submit-btn');
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
  await submitBtn.click(); // Method defaults to 'cash' (enum expects lowercase)

    // 6. Assert modal closes & status updates to PAID (button disabled)
    await expect(modal).toBeHidden({ timeout: 15_000 });
  await expect(page.getByTestId('invoice-status-badge').getByText('PAID')).toBeVisible({ timeout: 15_000 });
  await expect(recordBtn).toBeDisabled();
  });
});
