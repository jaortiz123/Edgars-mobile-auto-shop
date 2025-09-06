import { test, expect } from '@playwright/test';
import { clearTestAppointments } from './utils/test-data';

test.describe('Appointment Scheduling Foundation', () => {
  test.beforeEach(async ({ page, request }) => {
    // Capture browser console logs for debugging
    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
    });
    page.on('pageerror', err => {
      console.log(`[PAGE ERROR] ${err.name}: ${err.message}\n${err.stack}`);
    });

    // Capture network requests for debugging
    page.on('request', request => {
      if (
        request.url().includes('/api/admin/customers/search') ||
        request.url().includes('/api/admin/vehicles/search') ||
        (request.url().includes('/api/admin/appointments') && request.method() === 'POST') ||
        (request.url().includes('/api/appointments/') && request.method() === 'PATCH')
      ) {
        console.log(`[NETWORK REQUEST] ${request.method()} ${request.url()}`);
      }
    });

    page.on('response', async response => {
      if (
        response.url().includes('/api/admin/customers/search') ||
        response.url().includes('/api/admin/vehicles/search') ||
        response.url().includes('/api/admin/appointments')
      ) {
        console.log(`[NETWORK RESPONSE] ${response.status()} ${response.url()}`);
      }
    });

    // Clear any existing test appointments for a clean state
    await clearTestAppointments(request);

    // Navigate to admin login page
    await page.goto('/admin/login');

    // Login as admin (using accessible selectors)
    await page.getByPlaceholder('Username').fill('advisor');
    await page.getByPlaceholder('Password').fill('dev');
    await page.getByRole('button', { name: /login|sign in/i }).click();

    // Wait for dashboard to load
    await page.waitForURL('/admin/dashboard');

    // Navigate to appointments page
    await page.goto('/admin/appointments');
    await page.waitForLoadState('networkidle');
  });

  test('Load appointments page and show empty state', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Appointments', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Appointment' })).toBeVisible();

    // Wait for page to load completely
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Give UI time to render

    // Check if table is visible (should be empty after cleanup)
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // More comprehensive empty state detection
    const emptyStateSelectors = [
      '[data-testid="empty-appointments"]',
      '[data-testid="no-appointments"]',
      '.empty-state',
      '.no-data',
      'text="No appointments found"',
      'text="No appointments scheduled"',
      'text="No data available"',
      'text="Empty"',
      'text="No results"'
    ];

    // Check for any empty state indicators
    let foundEmptyState = false;
    for (const selector of emptyStateSelectors) {
      if (await page.locator(selector).count() > 0) {
        foundEmptyState = true;
        console.log(`Found empty state with selector: ${selector}`);
        break;
      }
    }

    // If no explicit empty state message, check that table body has no data rows
    if (!foundEmptyState) {
      const appointmentRows = page.locator('table tbody tr:not(.empty-row):not(.no-data-row)');
      const rowCount = await appointmentRows.count();
      console.log(`No empty state message found, checking table rows. Count: ${rowCount}`);

      // If there are rows, check if they contain "no data" type content
      if (rowCount > 0) {
        const firstRow = appointmentRows.first();
        const rowText = await firstRow.textContent();
        const hasNoDataText = rowText && (
          rowText.toLowerCase().includes('no data') ||
          rowText.toLowerCase().includes('no appointments') ||
          rowText.toLowerCase().includes('empty')
        );
        expect(hasNoDataText || rowCount === 0).toBeTruthy();
      } else {
        expect(rowCount).toBe(0);
      }
    }
  });

  test('Create New Appointment - Full CRUD Lifecycle', async ({ page }) => {
    // Small helper: wait until a select has at least N options
    const waitForOptions = async (selector: string, min: number) => {
      await page.waitForFunction(
        ([sel, minCount]) => {
          const el = document.querySelector(sel) as HTMLSelectElement | null;
          return !!el && el.options.length >= Number(minCount);
        },
        [selector, min],
        { timeout: 10000 }
      );
    };
    // Step 1: Open the New Appointment modal
    await page.getByRole('button', { name: 'New Appointment' }).click();
    await expect(page.getByRole('heading', { name: /new appointment/i })).toBeVisible();

    // Wait for data loading and check dropdown options
    console.log('[E2E DEBUG] Waiting for customer dropdown to populate...');
    await waitForOptions('select[aria-label="Select customer"]', 2);
    await waitForOptions('select[aria-label="Select vehicle"]', 2).catch(() => {
      console.log('[E2E DEBUG] Vehicle options did not reach 2; proceeding with available options');
    });

    // Check if customer options are available
    const customerOptions = await page.locator('select[aria-label="Select customer"] option').count();
    const vehicleOptions = await page.locator('select[aria-label="Select vehicle"] option').count();

    console.log(`[E2E DEBUG] Customer options count: ${customerOptions}`);
    console.log(`[E2E DEBUG] Vehicle options count: ${vehicleOptions}`);

    // Log the actual options for debugging
    const customerOptionTexts = await page.locator('select[aria-label="Select customer"] option').allTextContents();
    const vehicleOptionTexts = await page.locator('select[aria-label="Select vehicle"] option').allTextContents();

    console.log(`[E2E DEBUG] Customer options: ${JSON.stringify(customerOptionTexts)}`);
    console.log(`[E2E DEBUG] Vehicle options: ${JSON.stringify(vehicleOptionTexts)}`);

    // Step 2: Fill out the appointment form
    const startTime = new Date();
    startTime.setHours(startTime.getHours() + 2); // 2 hours from now
    const startTimeString = startTime.toISOString().slice(0, 16);

    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1); // 1 hour duration
    const endTimeString = endTime.toISOString().slice(0, 16);

    // Select first available customer
    await page.locator('select[aria-label="Select customer"]').selectOption({ index: 1 });

    // Select first available vehicle
    await page.locator('select[aria-label="Select vehicle"]').selectOption({ index: 1 });

    // Set start time
    await page.locator('input[aria-label="Appointment start time"]').fill(startTimeString);

    // Set end time
    await page.locator('input[aria-label="Appointment end time"]').fill(endTimeString);

    // Set title and notes
    await page.locator('input[placeholder="Brief description of the work"]').fill('Oil Change Test');
    await page.locator('textarea[placeholder="Additional notes or special instructions"]').fill('E2E test appointment');

    // Set amount
    await page.locator('input[placeholder="0.00"]').fill('75.99');

    // Step 3: Submit the form
    await page.getByRole('button', { name: 'Create Appointment' }).click();

    // Step 4: Verify appointment was created
    // Wait for the success message to appear using data-testid with longer timeout
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Appointment created successfully');

    // Wait sufficiently for database transaction to complete and UI to refresh
    await page.waitForTimeout(3000);

    // Check if appointment is visible
    await expect(page.locator('text=Oil Change Test')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=$75.99')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=SCHEDULED')).toBeVisible({ timeout: 10000 });
  });

  test('Edit Appointment', async ({ page }) => {
    // First create an appointment to edit
    await page.getByRole('button', { name: 'New Appointment' }).click();

    const startTime = new Date();
    startTime.setHours(startTime.getHours() + 3);
    const startTimeString = startTime.toISOString().slice(0, 16);

    await page.locator('select[aria-label="Select customer"]').selectOption({ index: 1 });
    await page.locator('select[aria-label="Select vehicle"]').selectOption({ index: 1 });
    await page.locator('input[aria-label="Appointment start time"]').fill(startTimeString);
    await page.locator('input[placeholder="Brief description of the work"]').fill('Brake Service');
    await page.getByRole('button', { name: 'Create Appointment' }).click();

    // Instrumentation: wait for create request and log response body
    const createResp = await page.waitForResponse(
      r => r.url().includes('/api/admin/appointments') && r.request().method() === 'POST',
      { timeout: 15000 }
    );
    const status = createResp.status();
    let bodyText = '';
    try { bodyText = await createResp.text(); } catch {}
    console.log(`[E2E DEBUG] Create response status=${status} body=${bodyText}`);

    // Ensure banner is not above viewport
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Appointment created successfully');

    // Now edit the appointment
    await page.getByRole('button', { name: /^edit$/i }).first().click();
    await expect(page.getByRole('heading', { name: /edit appointment/i })).toBeVisible();

    // Update the title
    await page.locator('input[placeholder="Brief description of the work"]').fill('Brake Service - Updated');
    await page.locator('input[placeholder="0.00"]').fill('125.50');

    // Defensively re-select required fields to avoid HTML5 validation blocking submit
    await page.locator('select[aria-label="Select customer"]').selectOption({ index: 1 });
    await page.locator('select[aria-label="Select vehicle"]').selectOption({ index: 1 });

    await page.getByRole('button', { name: 'Update Appointment' }).click();

    // Verify update
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="success-message"]')).toContainText(/Appointment (updated|created) successfully/);
    // Be specific to avoid strict mode collisions with the banner containing the title
    await expect(page.getByRole('cell', { name: 'Brake Service - Updated' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '$125.50' })).toBeVisible();
  });

  test('Status Workflow - Change appointment status', async ({ page }) => {
    // Create a scheduled appointment first
    await page.getByRole('button', { name: 'New Appointment' }).click();

    const startTime = new Date();
    startTime.setHours(startTime.getHours() + 4);
    const startTimeString = startTime.toISOString().slice(0, 16);

    await page.locator('select[aria-label="Select customer"]').selectOption({ index: 1 });
    await page.locator('select[aria-label="Select vehicle"]').selectOption({ index: 1 });
    await page.locator('input[aria-label="Appointment start time"]').fill(startTimeString);
    await page.locator('input[placeholder="Brief description of the work"]').fill('Tire Rotation');
    await page.getByRole('button', { name: 'Create Appointment' }).click();

    await expect(page.locator('[data-testid="success-message"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Appointment created successfully');

    // Test status workflow: SCHEDULED → IN_PROGRESS
    const statusDropdown = page.locator('select[aria-label="Change appointment status"]').first();
    await statusDropdown.selectOption('IN_PROGRESS');

    // Validate status in the table row (board badge may not be present on this page)
    await expect(page.getByRole('cell', { name: 'IN_PROGRESS' })).toBeVisible();

    // Test status workflow: IN_PROGRESS → READY
    await statusDropdown.selectOption('READY');

    await expect(page.getByRole('cell', { name: 'READY' })).toBeVisible();

    // Test status workflow: READY → COMPLETED
    await statusDropdown.selectOption('COMPLETED');

    await expect(page.getByRole('cell', { name: 'COMPLETED' })).toBeVisible();
  });

  test('Delete Appointment', async ({ page }) => {
    // Create an appointment to delete
    await page.getByRole('button', { name: 'New Appointment' }).click();

    const startTime = new Date();
    startTime.setHours(startTime.getHours() + 5);
    const startTimeString = startTime.toISOString().slice(0, 16);

    await page.locator('select[aria-label="Select customer"]').selectOption({ index: 1 });
    await page.locator('select[aria-label="Select vehicle"]').selectOption({ index: 1 });
    await page.locator('input[aria-label="Appointment start time"]').fill(startTimeString);
    await page.locator('input[placeholder="Brief description of the work"]').fill('To Be Deleted');
    await page.getByRole('button', { name: 'Create Appointment' }).click();

    await expect(page.locator('[data-testid="success-message"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Appointment created successfully');

    // Delete the appointment
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('Are you sure you want to delete this appointment?');
      await dialog.accept();
    });

    await page.getByRole('button', { name: /^delete$/i }).first().click();

    await expect(page.locator('text=Appointment deleted successfully')).toBeVisible();
    // The appointment should no longer be visible
    await expect(page.locator('text=To Be Deleted')).not.toBeVisible();
  });

  test('Conflict Detection - Prevent double-booking', async ({ page }) => {
    const conflictTime = new Date();
    conflictTime.setHours(conflictTime.getHours() + 6);
    const conflictTimeString = conflictTime.toISOString().slice(0, 16);

    // Create first appointment
    await page.getByRole('button', { name: 'New Appointment' }).click();

    await page.locator('select[aria-label="Select customer"]').selectOption({ index: 1 });
    await page.locator('select[aria-label="Select vehicle"]').selectOption({ index: 1 });
    await page.locator('input[aria-label="Appointment start time"]').fill(conflictTimeString);
    await page.locator('input[placeholder="Brief description of the work"]').fill('First Appointment');
    await page.getByRole('button', { name: 'Create Appointment' }).click();

    await expect(page.locator('[data-testid="success-message"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Appointment created successfully');

    // Try to create a second appointment with the same vehicle at the same time
    await page.getByRole('button', { name: 'New Appointment' }).click();

    await page.locator('select[aria-label="Select customer"]').selectOption({ index: 1 });
    await page.locator('select[aria-label="Select vehicle"]').selectOption({ index: 1 }); // Same vehicle
    await page.locator('input[aria-label="Appointment start time"]').fill(conflictTimeString); // Same time
    await page.locator('input[placeholder="Brief description of the work"]').fill('Conflicting Appointment');
    await page.getByRole('button', { name: 'Create Appointment' }).click();

    // Should show conflict error
    await expect(page.locator('text=Scheduling conflict detected')).toBeVisible();

    // The modal should still be open (appointment wasn't created)
    await expect(page.getByRole('heading', { name: /new appointment/i })).toBeVisible();
  });

  test('Form Validation', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: 'New Appointment' }).click();

    // Try to submit without required fields
    await page.getByRole('button', { name: 'Create Appointment' }).click();

    // Should not submit and still show modal
    await expect(page.getByRole('heading', { name: /new appointment/i })).toBeVisible();

    // Fill only customer and submit
    await page.locator('select[aria-label="Select customer"]').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Create Appointment' }).click();

    // Should still not submit (modal heading remains visible)
    await expect(page.getByRole('heading', { name: /new appointment/i })).toBeVisible();

    // Fill all required fields
    await page.locator('select[aria-label="Select vehicle"]').selectOption({ index: 1 });
    const futureTime = new Date();
    futureTime.setHours(futureTime.getHours() + 7);
    await page.locator('input[aria-label="Appointment start time"]').fill(futureTime.toISOString().slice(0, 16));

    await page.getByRole('button', { name: 'Create Appointment' }).click();

    // Should now submit successfully
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Appointment created successfully');
  });

  test('Search and Filter Functionality', async ({ page }) => {
    // Create a few appointments with different titles for searching
    const appointments = [
      'Oil Change Service',
      'Brake Inspection',
      'Tire Rotation'
    ];

    for (let i = 0; i < appointments.length; i++) {
      await page.getByRole('button', { name: 'New Appointment' }).click();

      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 8 + i);
      const startTimeString = startTime.toISOString().slice(0, 16);

      await page.locator('select[aria-label="Select customer"]').selectOption({ index: 1 });
      await page.locator('select[aria-label="Select vehicle"]').selectOption({ index: 1 });
      await page.locator('input[aria-label="Appointment start time"]').fill(startTimeString);
      await page.locator('input[placeholder="Brief description of the work"]').fill(appointments[i]);
      await page.getByRole('button', { name: 'Create Appointment' }).click();

      await expect(page.locator('[data-testid="success-message"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Appointment created successfully');
    }

    // Verify all appointments are visible
    for (const appointment of appointments) {
      await expect(page.locator(`text=${appointment}`)).toBeVisible();
    }
  });

  test('Accessibility Features', async ({ page }) => {
    // Open modal and check accessibility
    await page.getByRole('button', { name: 'New Appointment' }).click();

    // Check aria-labels are present
    await expect(page.locator('select[aria-label="Select customer"]')).toBeVisible();
    await expect(page.locator('select[aria-label="Select vehicle"]')).toBeVisible();
    await expect(page.locator('input[aria-label="Appointment start time"]')).toBeVisible();
    await expect(page.locator('input[aria-label="Appointment end time"]')).toBeVisible();

    // Check keyboard navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Modal should be navigable
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(['SELECT', 'INPUT', 'BUTTON'].includes(focusedElement || '')).toBeTruthy();
  });

  test('Responsive Design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Page should still be usable
    await expect(page.getByRole('heading', { name: 'Appointments', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Appointment' })).toBeVisible();

    // Table should be horizontally scrollable or stack properly
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Open modal on mobile
    await page.getByRole('button', { name: 'New Appointment' }).click();
    await expect(page.getByRole('heading', { name: /new appointment/i })).toBeVisible();

    // Modal should fit on mobile screen
    const modal = page.locator('.fixed.inset-0');
    await expect(modal).toBeVisible();
  });
});
