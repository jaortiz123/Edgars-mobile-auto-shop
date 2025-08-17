import { test, expect } from '@playwright/test';
import { stubCustomerProfile } from './utils/stubAuthProfile';

// Slim E2E: Focus solely on UI payment action; all setup through API.
// Goal: <10s runtime, no board navigation or drawer usage.

test.describe('Slim Invoice Payment', () => {
  test('user pays invoice -> status badge shows PAID', async ({ page }) => {
  await stubCustomerProfile(page);
  // Navigate first to ensure origin and storageState applied (avoids SecurityError on localStorage)
  await page.goto('http://localhost:5173/');
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    if (!token) throw new Error('Missing auth token');
    const nowIso = new Date().toISOString();

    // Create completed appointment
    const apptResp = await page.request.post('http://localhost:3001/api/admin/appointments', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { status: 'COMPLETED', start: nowIso }
    });
    const apptJson = await apptResp.json();
    const apptId = apptJson.data?.appointment?.id || apptJson.data?.id || apptJson.id;
    if (!apptId) throw new Error('No appointment id returned');

    // Add service (ensures non-zero invoice)
    const svcResp = await page.request.post(`http://localhost:3001/api/appointments/${apptId}/services`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name: 'Slim Spec Service', estimated_price: 55 }
    });
    if (!svcResp.ok()) throw new Error('Service seed failed');

    // Generate invoice
    const invResp = await page.request.post(`http://localhost:3001/api/admin/appointments/${apptId}/invoice`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!invResp.ok()) throw new Error('Invoice generation failed');
    const invJson = await invResp.json();
    const invoiceId = invJson.data?.id || invJson.data?.invoice?.id || invJson.id;
    if (!invoiceId) throw new Error('No invoice id');

    // Go directly to invoice page
    await page.goto(`http://localhost:5173/admin/invoices/${invoiceId}`);
    await expect(page.getByTestId('invoice-status-badge')).toBeVisible();

    // Determine amount due
    const detailResp = await page.request.get(`http://localhost:3001/api/admin/invoices/${invoiceId}`);
    const detailJson = await detailResp.json();
    const amountDueCents = detailJson.data?.invoice?.amount_due_cents ?? 0;
    expect(amountDueCents).toBeGreaterThan(0);
    const amountDue = (amountDueCents / 100).toFixed(2);

    // UI Payment
    const payBtn = page.getByTestId('record-payment-btn');
    await expect(payBtn).toBeVisible();
    await payBtn.click();
    const modal = page.getByTestId('record-payment-modal');
    await expect(modal).toBeVisible();
    await page.getByTestId('payment-amount-input').fill(amountDue);
    await page.getByTestId('payment-submit-btn').click();

    // Assertions
    await expect(modal).toBeHidden();
    await expect(page.getByTestId('invoice-status-badge').getByText('PAID')).toBeVisible();
    await expect(payBtn).toBeDisabled();
  });
});
