import { test, expect, Page } from '@playwright/test';
import { stubCustomerProfile } from './utils/stubAuthProfile';
import crypto from 'crypto';

// Assumptions:
// - Dev server runs at http://localhost:5173
// - Login form at /admin/login with username/password fields (placeholders or labels containing Username / Password)
// - Successful login redirects or allows navigation to /admin/customers
// - Customer search input has placeholder matching /search by plate|name|phone|email/i
// - Customer result cards container has data-testid="customer-results"
// - Each customer card has a button or link with data-testid="customer-view-full-history" or text 'View Full History'
// - Profile page <h1> has data-testid="customer-profile-name" (added earlier)
// - Known test customer: seed data includes 'Alice Brown'

async function ensureLoggedIn(page: Page) {
  // Navigate directly to customers page; storageState should already have auth token.
  await page.goto('http://localhost:5173/admin/customers');
  if (/\/admin\/login/.test(page.url())) {
    // Fallback: perform real login if redirect happened.
    const user = page.getByRole('textbox', { name: /username/i }).or(page.getByPlaceholder(/username/i));
    const pass = page.getByLabel(/password/i).or(page.getByRole('textbox', { name: /password/i })).or(page.getByPlaceholder(/password/i));
    await user.fill('advisor');
    await pass.fill('password');
    // More permissive button locator
    const loginBtn = page.getByRole('button', { name: /login|log in|sign in/i });
    await loginBtn.click();
    await page.waitForURL(/\/admin\//, { timeout: 15000 });
    // Navigate again to customers list after login
    await page.goto('http://localhost:5173/admin/customers');
  }
}

// Helpers to mint JWT for appointment creation (Owner role needed)
function base64url(input: any) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function signJwtHS256(payload: Record<string, any>, secret: string) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${data}.${signature}`;
}

test.describe('Customer Profile Dashboard end-to-end', () => {
  test('Login -> Create -> Search -> Open Profile -> Verify @customer-dashboard', async ({ page, request }) => {
  await stubCustomerProfile(page);
  await ensureLoggedIn(page);

    // Create an appointment (which implicitly creates customer + vehicle if new)
    const plate = `E2E${Date.now().toString().slice(-6)}`; // short unique plate
    const nowSec = Math.floor(Date.now() / 1000);
    const token = signJwtHS256({ sub: 'e2e', role: 'Owner', iat: nowSec, exp: nowSec + 300 }, 'dev-secret-do-not-use-in-prod');
    const startIso = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const payload = {
      requested_time: startIso,
      status: 'SCHEDULED',
      customer_name: 'E2E Dashboard Cust',
      customer_phone: '5551239999',
      customer_email: `e2e-dash-${Date.now()}@example.com`,
      license_plate: plate,
      vehicle_year: 2022,
      vehicle_make: 'Playwright',
      vehicle_model: 'TestCar',
      notes: 'Dashboard flow auto-created',
      location_address: '123 Test Ln'
    };
    const createRes = await request.post('http://localhost:3001/api/admin/appointments', {
      data: payload,
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(createRes.status(), 'appointment create status').toBe(201);

    // Poll backend search API directly to ensure the new customer/vehicle is indexed & queryable
    const searchUrl = (plateQuery: string) => `http://localhost:3001/api/admin/customers/search?q=${encodeURIComponent(plateQuery)}`;
    let found = false; let lastPayload: any = null;
    for (let attempt = 1; attempt <= 6; attempt++) { // ~3s total (6 * 500ms)
      const apiRes = await request.get(searchUrl(plate));
      const json = await apiRes.json().catch(() => ({}));
      lastPayload = json;
      const items = json?.data?.items || [];
      if (items.some((it: any) => (it.plate || '').toLowerCase().includes(plate.toLowerCase()))) { found = true; break; }
      await new Promise(r => setTimeout(r, 500));
    }
    expect(found, `backend search did not return plate. Last payload: ${JSON.stringify(lastPayload)}`).toBeTruthy();

    // Search for newly created plate
    const search = page.getByPlaceholder(/search by plate|name|phone|email/i);
    await expect(search).toBeVisible();
    await search.fill(plate);
    await search.blur();

    const results = page.getByTestId('customer-results');
    // On some mobile layouts container may start hidden until data load; poll for card presence instead of raw visibility.
  const grid = page.getByTestId('customers-results-grid');
  // Skip hard visibility requirement (mobile layout may hide container offset)
    await expect.poll(async () => {
      const cards = results.locator('[data-testid^="customer-card-"]');
      const count = await cards.count();
      if (!count) return 0;
      for (let i = 0; i < count; i++) {
        const txt = (await cards.nth(i).innerText()).toLowerCase();
        if (txt.includes(plate.toLowerCase())) return 1;
      }
      return 0;
    }, { timeout: 15000 }).toBeGreaterThan(0);
    const customerCard = results.locator(`[data-testid^="customer-card-"]`, { hasText: plate }).first();
    await expect(customerCard).toBeVisible();

    // Click View Full History
    const viewBtn = customerCard.locator('[data-testid="customer-view-history"]');
    await expect(viewBtn).toBeVisible();
    await viewBtn.click();

    await page.waitForURL(/\/admin\/customers\/(.+)/);
    const heading = page.getByTestId('customer-profile-name');
    await expect(heading).toHaveText(/E2E Dashboard Cust/);
  });
});
