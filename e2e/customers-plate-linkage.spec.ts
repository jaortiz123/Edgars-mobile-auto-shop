// @ts-nocheck
import { test, expect } from '@playwright/test';
import { stubCustomerProfile } from './utils/stubAuthProfile';
const crypto = require('crypto');

function base64url(input: any) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwtHS256(payload: Record<string, any>, secret: string) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${data}.${signature}`;
}

test('appointment creation links vehicle by plate and is searchable on Customers page', async ({ page, request }) => {
  await stubCustomerProfile(page);
  const plate = `PLT${Date.now().toString().slice(-6)}`; // unique-ish

  // Create an appointment via backend API (DEV_NO_AUTH assumed true locally)
  const start = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const payload = {
    requested_time: start,
    status: 'SCHEDULED',
    customer_name: 'Plate Link Test',
    customer_phone: '5550001234',
    customer_email: `plate-link-${Date.now()}@example.com`,
    license_plate: plate,
    vehicle_year: 2020,
    vehicle_make: 'TestMake',
    vehicle_model: 'TestModel',
    notes: 'E2E linkage test',
    location_address: '123 Test St',
  };

  // Build an Owner token matching backend default JWT secret
  const secret = 'dev-secret-do-not-use-in-prod';
  const nowSec = Math.floor(Date.now() / 1000);
  const token = signJwtHS256({ sub: 'e2e', role: 'Owner', iat: nowSec, exp: nowSec + 300 }, secret);

  const res = await request.post('http://localhost:3001/api/admin/appointments', {
    data: payload,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status(), 'create appointment status').toBe(201);
  const body = await res.json();
  const createdId = body?.data?.id || body?.data?.appointment?.id;
  expect(createdId, 'created appointment id').toBeTruthy();

  // Open Customers page and search by plate
  await page.goto('http://localhost:5173/admin/customers');
  const input = page.getByPlaceholder(/search by plate|name|phone|email/i);
  await input.fill(plate);
  // Debounce + network confirmation
  await page.waitForTimeout(300);
  await page.waitForResponse(r => r.url().includes('/api/admin/customers/search') && r.request().method()==='GET', { timeout: 15000 }).catch(()=>{});
  await input.blur();

  const list = page.getByTestId('customer-results');
  // On mobile the container may remain visually hidden but still contain cards; proceed without strict visibility.

  // Adaptation: UI now renders CustomerCard components (grid) not per-vehicle buttons.
  const resultsGrid = page.getByTestId('customers-results-grid');
  // Don't require visible on mobile; rely on poll below to confirm presence.
  // Poll for any customer card containing the plate text (case-insensitive)
  await expect.poll(async () => {
    const cards = resultsGrid.locator('[data-testid^="customer-card-"]');
    const count = await cards.count();
    if (!count) return 0;
    for (let i = 0; i < count; i++) {
      const txt = (await cards.nth(i).innerText()).toLowerCase();
      if (txt.includes(plate.toLowerCase())) return 1;
    }
    return 0;
  }, { timeout: 25000 }).toBeGreaterThan(0);
  // Additional backend verification for diagnostics
  const diag = await page.evaluate(async (p) => {
    try {
      const r = await fetch(`/api/admin/customers/search?q=${encodeURIComponent(p)}`);
      const j = await r.json();
      return { status: r.status, count: (j.data && j.data.items || []).length };
    } catch (e:any) { return { fetchError: String(e) }; }
  }, plate);
  console.log('DEBUG plate linkage final diagnostics', { plate, diag });
});
