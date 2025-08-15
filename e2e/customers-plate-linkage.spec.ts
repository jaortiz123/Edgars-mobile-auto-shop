// @ts-nocheck
import { test, expect } from '@playwright/test';
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

  const list = page.getByTestId('customer-results');
  await expect(list).toBeVisible();
  await expect(list).toContainText(plate);

  // Select first result and verify visits appear
  const firstBtn = list.locator('button').filter({ hasText: plate }).first();
  await firstBtn.click();
  const visits = page.getByTestId('customer-visits');
  await expect(visits).toBeVisible();
  await expect(visits).toContainText(/scheduled|in progress|ready|completed|no[- ]show|canceled/i);
});
