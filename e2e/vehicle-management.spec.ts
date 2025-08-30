import { test, expect, Page } from '@playwright/test';
import { stubCustomerProfile } from './utils/stubAuthProfile';
import crypto from 'crypto';

// Vehicle Management UI E2E Tests
// Tests the complete CRUD functionality for vehicles in the Customer Profile Foundation

async function ensureLoggedIn(page: Page) {
  // Navigate directly to customers page; storageState should already have auth token.
  await page.goto('http://localhost:5173/admin/customers');
  if (/\/admin\/login/.test(page.url())) {
    // Fallback: perform real login if redirect happened.
    const user = page.getByRole('textbox', { name: /username/i }).or(page.getByPlaceholder(/username/i));
    const pass = page.getByLabel(/password/i).or(page.getByRole('textbox', { name: /password/i })).or(page.getByPlaceholder(/password/i));
    await user.fill('advisor');
    await pass.fill('password');
    const loginBtn = page.getByRole('button', { name: /login|log in|sign in/i });
    await loginBtn.click();
    await page.waitForURL(/\/admin\//, { timeout: 15000 });
  }
}

// Helper to mint JWT for API operations
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

// Helper to create a test customer with vehicle
async function createTestCustomerWithVehicle(request: any) {
  const timestamp = Date.now().toString().slice(-6);
  const plate = `VMS${timestamp}`;
  const nowSec = Math.floor(Date.now() / 1000);
  const token = signJwtHS256({ sub: 'e2e', role: 'Owner', iat: nowSec, exp: nowSec + 300 }, 'dev-secret-do-not-use-in-prod');

  const payload = {
    requested_time: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    status: 'SCHEDULED',
    customer_name: `Vehicle Mgmt Test ${timestamp}`,
    customer_phone: '5551234567',
    customer_email: `vehicle-test-${timestamp}@example.com`,
    license_plate: plate,
    vehicle_year: 2020,
    vehicle_make: 'Honda',
    vehicle_model: 'Civic',
    notes: 'E2E Vehicle Management Test',
    location_address: '123 Test St'
  };

  const createRes = await request.post('http://localhost:3001/api/admin/appointments', {
    data: payload,
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(createRes.status()).toBe(201);

  return { plate, customerName: payload.customer_name };
}

// Helper to navigate to customer profile
async function navigateToCustomerProfile(page: Page, plate: string) {
  await page.goto('http://localhost:5173/admin/customers');

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
  const viewBtn = customerCard.locator('[data-testid="customer-view-history"]');
  await viewBtn.click();

  await page.waitForURL(/\/admin\/customers\/(.+)/);
}

test.describe('Vehicle Management UI', () => {
  test('Complete vehicle CRUD flow: Add -> Edit -> Delete @vehicle-management', async ({ page, request }) => {
    await stubCustomerProfile(page);
    await ensureLoggedIn(page);

    // Create a test customer with initial vehicle
    const { plate, customerName } = await createTestCustomerWithVehicle(request);

    // Navigate to customer profile
    await navigateToCustomerProfile(page, plate);

    // Verify we're on the customer profile page
    const heading = page.getByTestId('customer-profile-name');
    await expect(heading).toHaveText(new RegExp(customerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

    // STEP 1: Verify initial vehicle is displayed
    const vehicleCard = page.locator('[data-testid^="vehicle-card-"]').first();
    await expect(vehicleCard).toBeVisible();
    await expect(vehicleCard).toContainText('2020 Honda Civic');
    await expect(vehicleCard).toContainText(plate);

    // STEP 2: Add a new vehicle
    const addVehicleBtn = page.getByTestId('add-vehicle-button');
    await expect(addVehicleBtn).toBeVisible();
    await addVehicleBtn.click();

    // Fill out the Add Vehicle modal
    await expect(page.getByText('Add New Vehicle')).toBeVisible();

    const newPlate = `NEW${Date.now().toString().slice(-6)}`;
    await page.getByLabel('Make *').fill('Toyota');
    await page.getByLabel('Model *').fill('Camry');
    await page.getByLabel('Year *').fill('2023');
    await page.getByLabel('License Plate').fill(newPlate);
    await page.getByLabel('VIN (Vehicle Identification Number)').fill('1HGBH41JXMN109186');
    await page.getByLabel('Notes').fill('E2E test vehicle - newly added');

    // Submit the form
    await page.getByRole('button', { name: 'Add Vehicle' }).click();

    // Wait for modal to close and verify new vehicle appears
    await expect(page.getByText('Add New Vehicle')).not.toBeVisible();

    // Verify new vehicle card appears
    await expect.poll(async () => {
      const cards = page.locator('[data-testid^="vehicle-card-"]');
      const count = await cards.count();
      let found = false;
      for (let i = 0; i < count; i++) {
        const txt = await cards.nth(i).innerText();
        if (txt.includes('2023 Toyota Camry') && txt.includes(newPlate)) {
          found = true;
          break;
        }
      }
      return found;
    }, { timeout: 10000 }).toBeTruthy();

    // STEP 3: Edit the newly added vehicle
    const newVehicleCard = page.locator('[data-testid^="vehicle-card-"]', { hasText: '2023 Toyota Camry' });
    const editBtn = newVehicleCard.getByTestId(/edit-vehicle-/);
    await editBtn.click();

    // Verify edit modal opens with existing data
    await expect(page.getByText('Edit Vehicle')).toBeVisible();
    await expect(page.locator('input[value="Toyota"]')).toBeVisible();
    await expect(page.locator('input[value="Camry"]')).toBeVisible();
    await expect(page.locator('input[value="2023"]')).toBeVisible();

    // Modify the vehicle data
    await page.getByLabel('Model *').fill('Prius');
    await page.getByLabel('Notes').fill('E2E test vehicle - edited to Prius');

    // Save changes
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Wait for modal to close
    await expect(page.getByText('Edit Vehicle')).not.toBeVisible();

    // Verify the vehicle card shows updated information
    await expect.poll(async () => {
      const cards = page.locator('[data-testid^="vehicle-card-"]');
      const count = await cards.count();
      let found = false;
      for (let i = 0; i < count; i++) {
        const txt = await cards.nth(i).innerText();
        if (txt.includes('2023 Toyota Prius') && txt.includes(newPlate)) {
          found = true;
          break;
        }
      }
      return found;
    }, { timeout: 10000 }).toBeTruthy();

    // STEP 4: Delete the edited vehicle
    const editedVehicleCard = page.locator('[data-testid^="vehicle-card-"]', { hasText: '2023 Toyota Prius' });
    const deleteBtn = editedVehicleCard.getByTestId(/delete-vehicle-/);
    await deleteBtn.click();

    // Verify delete confirmation modal
    await expect(page.getByText('Delete Vehicle')).toBeVisible();
    await expect(page.getByText('2023 Toyota Prius')).toBeVisible();
    await expect(page.getByText('This action cannot be undone')).toBeVisible();

    // Confirm deletion
    await page.getByRole('button', { name: 'Delete Vehicle' }).click();

    // Wait for modal to close
    await expect(page.getByText('Delete Vehicle')).not.toBeVisible();

    // Verify the vehicle card is removed
    await expect.poll(async () => {
      const cards = page.locator('[data-testid^="vehicle-card-"]');
      const count = await cards.count();
      let found = false;
      for (let i = 0; i < count; i++) {
        const txt = await cards.nth(i).innerText();
        if (txt.includes('2023 Toyota Prius')) {
          found = true;
          break;
        }
      }
      return !found; // Should NOT find the deleted vehicle
    }, { timeout: 10000 }).toBeTruthy();

    // STEP 5: Verify original vehicle is still present
    await expect(page.locator('[data-testid^="vehicle-card-"]', { hasText: '2020 Honda Civic' })).toBeVisible();
  });

  test('Vehicle form validation works correctly @vehicle-validation', async ({ page, request }) => {
    await stubCustomerProfile(page);
    await ensureLoggedIn(page);

    // Create a test customer
    const { plate } = await createTestCustomerWithVehicle(request);

    // Navigate to customer profile
    await navigateToCustomerProfile(page, plate);

    // Open Add Vehicle modal
    const addVehicleBtn = page.getByTestId('add-vehicle-button');
    await addVehicleBtn.click();

    // Try to submit with empty required fields
    await page.getByRole('button', { name: 'Add Vehicle' }).click();

    // Verify validation errors appear
    await expect(page.getByText('Make is required')).toBeVisible();
    await expect(page.getByText('Model is required')).toBeVisible();

    // Fill in minimum required fields
    await page.getByLabel('Make *').fill('Ford');
    await page.getByLabel('Model *').fill('F-150');

    // Submit should now work
    await page.getByRole('button', { name: 'Add Vehicle' }).click();

    // Modal should close
    await expect(page.getByText('Add New Vehicle')).not.toBeVisible();

    // Verify vehicle was added
    await expect(page.locator('[data-testid^="vehicle-card-"]', { hasText: 'Ford F-150' })).toBeVisible();
  });

  test('Vehicle filtering works correctly @vehicle-filtering', async ({ page, request }) => {
    await stubCustomerProfile(page);
    await ensureLoggedIn(page);

    // Create a test customer
    const { plate } = await createTestCustomerWithVehicle(request);

    // Navigate to customer profile
    await navigateToCustomerProfile(page, plate);

    // Add a second vehicle
    const addVehicleBtn = page.getByTestId('add-vehicle-button');
    await addVehicleBtn.click();

    await page.getByLabel('Make *').fill('BMW');
    await page.getByLabel('Model *').fill('X5');
    await page.getByLabel('Year *').fill('2021');
    await page.getByRole('button', { name: 'Add Vehicle' }).click();

    // Wait for modal to close
    await expect(page.getByText('Add New Vehicle')).not.toBeVisible();

    // Verify both vehicles are visible initially
    await expect(page.locator('[data-testid^="vehicle-card-"]', { hasText: '2020 Honda Civic' })).toBeVisible();
    await expect(page.locator('[data-testid^="vehicle-card-"]', { hasText: '2021 BMW X5' })).toBeVisible();

    // Click on a specific vehicle filter button
    const bmwFilterBtn = page.locator('button:has-text("2021 BMW X5")');
    await bmwFilterBtn.click();

    // Verify only the BMW is visible
    await expect(page.locator('[data-testid^="vehicle-card-"]', { hasText: '2021 BMW X5' })).toBeVisible();
    await expect(page.locator('[data-testid^="vehicle-card-"]', { hasText: '2020 Honda Civic' })).not.toBeVisible();

    // Click "All Vehicles" to show both again
    const allVehiclesBtn = page.locator('button:has-text("All Vehicles")');
    await allVehiclesBtn.click();

    // Verify both vehicles are visible again
    await expect(page.locator('[data-testid^="vehicle-card-"]', { hasText: '2020 Honda Civic' })).toBeVisible();
    await expect(page.locator('[data-testid^="vehicle-card-"]', { hasText: '2021 BMW X5' })).toBeVisible();
  });
});
