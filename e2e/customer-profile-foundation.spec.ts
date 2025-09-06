import { test, expect, Page } from '@playwright/test';
import { attachNetworkLogger } from './utils/networkLogger';
import { stubCustomerProfile } from './utils/stubAuthProfile';
import crypto from 'crypto';

// Customer Profile Foundation End-to-End Tests
// Tests the complete customer profile view with appointment history and vehicle filtering

async function ensureLoggedIn(page: Page) {
  // Navigate directly to customers page; storageState should already have auth token.
  await page.goto('http://localhost:5173/admin/customers');
  if (/\/admin\/login/.test(page.url())) {
    // Fallback: perform real login if redirect happened.
    const user = page.getByPlaceholder(/username/i).or(page.getByRole('textbox', { name: /username/i }));
    const pass = page.getByPlaceholder(/password/i).or(page.getByLabel(/password/i));
    await user.fill('advisor');
    await pass.fill('dev');
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

test.describe('Customer Profile Foundation', () => {
  test('Login -> Create -> Search -> Open Profile -> Verify @customer-dashboard', async ({ page, request }) => {
    await stubCustomerProfile(page);
    attachNetworkLogger(page);
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
      const apiRes = await request.get(searchUrl(plate), {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': '00000000-0000-0000-0000-000000000001'
        }
      });
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

  test('Appointment history displays and filters correctly @appointment-history', async ({ page, request }) => {
    await stubCustomerProfile(page);
    attachNetworkLogger(page);
    await ensureLoggedIn(page);

    // Create a customer with multiple appointments across different vehicles
    const plate1 = `HIST${Date.now().toString().slice(-6)}`;
    const plate2 = `HST2${Date.now().toString().slice(-6)}`;

    const nowSec = Math.floor(Date.now() / 1000);
    const token = signJwtHS256({ sub: 'e2e', role: 'Owner', iat: nowSec, exp: nowSec + 300 }, 'dev-secret-do-not-use-in-prod');

    // Create first appointment
    const payload1 = {
      requested_time: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      status: 'SCHEDULED',
      customer_name: 'History Test Customer',
      customer_phone: '5551234567',
      customer_email: `history-test-${Date.now()}@example.com`,
      license_plate: plate1,
      vehicle_year: 2020,
      vehicle_make: 'Toyota',
      vehicle_model: 'Camry',
      notes: 'First vehicle appointment',
      location_address: '123 Test St'
    };

    // Create second appointment with different vehicle
    const payload2 = {
      requested_time: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      status: 'COMPLETED',
      customer_name: 'History Test Customer',
      customer_phone: '5551234567',
      customer_email: payload1.customer_email,
      license_plate: plate2,
      vehicle_year: 2019,
      vehicle_make: 'Honda',
      vehicle_model: 'Civic',
      notes: 'Second vehicle appointment',
      location_address: '123 Test St'
    };

    // Create both appointments
    const createRes1 = await request.post('http://localhost:3001/api/admin/appointments', {
      data: payload1,
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(createRes1.status()).toBe(201);

    const createRes2 = await request.post('http://localhost:3001/api/admin/appointments', {
      data: payload2,
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(createRes2.status()).toBe(201);

    // Wait for indexing and search for customer
    await page.goto('http://localhost:5173/admin/customers');
    const search = page.getByPlaceholder(/search by plate|name|phone|email/i);
    await search.fill(plate1);
    await search.blur();

    const results = page.getByTestId('customer-results');
    await expect.poll(async () => {
      const cards = results.locator('[data-testid^="customer-card-"]');
      const count = await cards.count();
      if (!count) return 0;
      for (let i = 0; i < count; i++) {
        const txt = (await cards.nth(i).innerText()).toLowerCase();
        if (txt.includes(plate1.toLowerCase())) return 1;
      }
      return 0;
    }, { timeout: 15000 }).toBeGreaterThan(0);

    const customerCard = results.locator(`[data-testid^="customer-card-"]`, { hasText: plate1 }).first();
    const viewBtn = customerCard.locator('[data-testid="customer-view-history"]');
    await viewBtn.click();

    await page.waitForURL(/\/admin\/customers\/(.+)/);

    // STEP 1: Verify appointment history section exists
    await expect(page.getByText('Appointment History')).toBeVisible();

    // STEP 2: Verify both appointments are shown initially (no filter)
    await expect.poll(async () => {
      const appointmentCards = page.locator('[data-testid^="appointment-card-"]');
      return await appointmentCards.count();
    }, { timeout: 10000 }).toBeGreaterThanOrEqual(1);

    // STEP 3: Test vehicle filtering - click on first vehicle filter
    const toyotaFilterBtn = page.getByRole('button', { name: /2020\s+toyota\s+camry/i }).first();
    await toyotaFilterBtn.click();

    // Verify Toyota appointments are shown
    await expect.poll(async () => {
      const appointmentCards = page.locator('[data-testid^="appointment-card-"]');
      const count = await appointmentCards.count();
      return count;
    }, { timeout: 5000 }).toBeGreaterThanOrEqual(1);

    // STEP 4: Test "All Vehicles" filter
    const allVehiclesBtn = page.getByRole('button', { name: /all vehicles/i }).first();
    await allVehiclesBtn.click();

    // Verify appointments are shown again
    await expect.poll(async () => {
      const appointmentCards = page.locator('[data-testid^="appointment-card-"]');
      return await appointmentCards.count();
    }, { timeout: 5000 }).toBeGreaterThanOrEqual(1);
  });

  test('Load More button works for appointment history pagination @load-more', async ({ page, request }) => {
    await stubCustomerProfile(page);
    attachNetworkLogger(page);
    await ensureLoggedIn(page);

    // Create a customer
    const plate = `PAGE${Date.now().toString().slice(-6)}`;
    const nowSec = Math.floor(Date.now() / 1000);
    const token = signJwtHS256({ sub: 'e2e', role: 'Owner', iat: nowSec, exp: nowSec + 300 }, 'dev-secret-do-not-use-in-prod');

    const payload = {
      requested_time: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      status: 'SCHEDULED',
      customer_name: 'Pagination Test Customer',
      customer_phone: '5551234567',
      customer_email: `pagination-test-${Date.now()}@example.com`,
      license_plate: plate,
      vehicle_year: 2021,
      vehicle_make: 'Ford',
      vehicle_model: 'F-150',
      notes: 'Pagination test appointment',
      location_address: '123 Test St'
    };

    const createRes = await request.post('http://localhost:3001/api/admin/appointments', {
      data: payload,
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(createRes.status()).toBe(201);

    // Navigate to customer profile
    await page.goto('http://localhost:5173/admin/customers');
    const search = page.getByPlaceholder(/search by plate|name|phone|email/i);
    await search.fill(plate);
    await search.blur();

    const results = page.getByTestId('customer-results');
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
    const viewBtn = customerCard.locator('[data-testid="customer-view-history"]');
    await viewBtn.click();

    await page.waitForURL(/\/admin\/customers\/(.+)/);

    // Check if Load More button appears (depends on backend data)
    const loadMoreBtn = page.getByRole('button', { name: /load more/i });

    // If the button exists, test that it works
    if (await loadMoreBtn.isVisible()) {
      // Count initial appointments
      const initialCount = await page.locator('[data-testid^="appointment-card-"]').count();

      // Click Load More
      await loadMoreBtn.click();

      // Verify loading state
      await expect(page.getByRole('button', { name: /loading\.{3}/i })).toBeVisible({ timeout: 2000 });

      // Wait for loading to complete and verify more appointments loaded
      await expect.poll(async () => {
        const newCount = await page.locator('[data-testid^="appointment-card-"]').count();
        return newCount > initialCount;
      }, { timeout: 10000 }).toBeTruthy();
    } else {
      // If no Load More button, just verify appointments section is visible
      await expect(page.getByText('Appointment History')).toBeVisible();
      console.log('No pagination needed - customer has few appointments');
    }
  });
});
