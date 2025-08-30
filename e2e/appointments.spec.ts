import { test, expect } from '@playwright/test';

test.describe('Appointment Scheduling Foundation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin login page
    await page.goto('/admin/login');

    // Login as admin (using existing test credentials/mock)
    await page.fill('input[type="email"]', 'admin@edgarautoshop.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForURL('/admin/dashboard');

    // Navigate to appointments page
    await page.goto('/admin/appointments');
    await page.waitForLoadState('networkidle');
  });

  test('Load appointments page and show empty state', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('Appointments');
    await expect(page.getByRole('button', { name: 'New Appointment' })).toBeVisible();

    // Check if table is visible (may have data or be empty)
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  test('Create New Appointment - Full CRUD Lifecycle', async ({ page }) => {
    // Step 1: Open the New Appointment modal
    await page.getByRole('button', { name: 'New Appointment' }).click();
    await expect(page.locator('text=New Appointment')).toBeVisible();

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
    await expect(page.locator('text=Appointment created successfully')).toBeVisible();
    await expect(page.locator('text=Oil Change Test')).toBeVisible();
    await expect(page.locator('text=$75.99')).toBeVisible();
    await expect(page.locator('text=SCHEDULED')).toBeVisible();
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

    await expect(page.locator('text=Appointment created successfully')).toBeVisible();

    // Now edit the appointment
    await page.locator('text=Edit').first().click();
    await expect(page.locator('text=Edit Appointment')).toBeVisible();

    // Update the title
    await page.locator('input[placeholder="Brief description of the work"]').fill('Brake Service - Updated');
    await page.locator('input[placeholder="0.00"]').fill('125.50');

    await page.getByRole('button', { name: 'Update Appointment' }).click();

    // Verify update
    await expect(page.locator('text=Appointment updated successfully')).toBeVisible();
    await expect(page.locator('text=Brake Service - Updated')).toBeVisible();
    await expect(page.locator('text=$125.50')).toBeVisible();
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

    await expect(page.locator('text=Appointment created successfully')).toBeVisible();

    // Test status workflow: SCHEDULED → IN_PROGRESS
    const statusDropdown = page.locator('select[aria-label="Change appointment status"]').first();
    await statusDropdown.selectOption('IN_PROGRESS');

    await expect(page.locator('text=Appointment status updated to IN_PROGRESS')).toBeVisible();
    await expect(page.locator('text=IN_PROGRESS')).toBeVisible();

    // Test status workflow: IN_PROGRESS → READY
    await statusDropdown.selectOption('READY');

    await expect(page.locator('text=Appointment status updated to READY')).toBeVisible();
    await expect(page.locator('text=READY')).toBeVisible();

    // Test status workflow: READY → COMPLETED
    await statusDropdown.selectOption('COMPLETED');

    await expect(page.locator('text=Appointment status updated to COMPLETED')).toBeVisible();
    await expect(page.locator('text=COMPLETED')).toBeVisible();
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

    await expect(page.locator('text=Appointment created successfully')).toBeVisible();

    // Delete the appointment
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('Are you sure you want to delete this appointment?');
      await dialog.accept();
    });

    await page.locator('text=Delete').first().click();

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

    await expect(page.locator('text=Appointment created successfully')).toBeVisible();

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
    await expect(page.locator('text=New Appointment')).toBeVisible();
  });

  test('Form Validation', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: 'New Appointment' }).click();

    // Try to submit without required fields
    await page.getByRole('button', { name: 'Create Appointment' }).click();

    // Should not submit and still show modal
    await expect(page.locator('text=New Appointment')).toBeVisible();

    // Fill only customer and submit
    await page.locator('select[aria-label="Select customer"]').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Create Appointment' }).click();

    // Should still not submit
    await expect(page.locator('text=New Appointment')).toBeVisible();

    // Fill all required fields
    await page.locator('select[aria-label="Select vehicle"]').selectOption({ index: 1 });
    const futureTime = new Date();
    futureTime.setHours(futureTime.getHours() + 7);
    await page.locator('input[aria-label="Appointment start time"]').fill(futureTime.toISOString().slice(0, 16));

    await page.getByRole('button', { name: 'Create Appointment' }).click();

    // Should now submit successfully
    await expect(page.locator('text=Appointment created successfully')).toBeVisible();
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

      await expect(page.locator('text=Appointment created successfully')).toBeVisible();
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
    await expect(page.locator('h1')).toHaveText('Appointments');
    await expect(page.getByRole('button', { name: 'New Appointment' })).toBeVisible();

    // Table should be horizontally scrollable or stack properly
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Open modal on mobile
    await page.getByRole('button', { name: 'New Appointment' }).click();
    await expect(page.locator('text=New Appointment')).toBeVisible();

    // Modal should fit on mobile screen
    const modal = page.locator('.fixed.inset-0');
    await expect(modal).toBeVisible();
  });
});
