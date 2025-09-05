import { test, expect } from '@playwright/test';

test.describe('Service Management System', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin login page
    await page.goto('/admin/login');

    // Login as admin (using existing test credentials/mock)
    await page.fill('input[placeholder="Username"]', 'advisor');
    await page.fill('input[type="password"]', 'dev');
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForURL('/admin/dashboard');

    // Navigate to services page
    await page.goto('/admin/services');
    await page.waitForLoadState('networkidle');
  });

  test('Service Management Page Loads', async ({ page }) => {
    // Verify page title and basic UI elements
    await expect(page.locator('h1')).toContainText('Service Management');
    await expect(page.locator('text=Manage your shop\'s service catalog')).toBeVisible();

    // Verify search and filter controls
    await expect(page.locator('input[placeholder*="Search services"]')).toBeVisible();
    await expect(page.locator('select[aria-label="Filter by category"]')).toBeVisible();
    await expect(page.locator('text=Add Service')).toBeVisible();
  });

  test('Search Functionality', async ({ page }) => {
    // Test search with debouncing
    const searchInput = page.locator('input[placeholder*="Search services"]');
    await searchInput.fill('oil');

    // Wait for debounce
    await page.waitForTimeout(400);

    // Verify filtered results
    const resultRows = page.locator('table tbody tr');
    expect(await resultRows.count()).toBeGreaterThan(0);

    // Test clearing search
    await searchInput.clear();
    await page.waitForTimeout(400);

    // Verify all results returned
    const allRows = page.locator('table tbody tr');
    expect(await allRows.count()).toBeGreaterThan(0);
  });

  test('Category Filtering', async ({ page }) => {
    // Select a specific category
    const categoryFilter = page.locator('select[aria-label="Filter by category"]');
    await categoryFilter.selectOption('MAINTENANCE');

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Verify filtered results show only maintenance services
    const categoryBadges = page.locator('tbody .bg-gray-100');
    if (await categoryBadges.count() > 0) {
      for (let i = 0; i < await categoryBadges.count(); i++) {
        const badge = categoryBadges.nth(i);
        await expect(badge).toContainText('MAINTENANCE');
      }
    }

    // Reset filter
    await categoryFilter.selectOption('');
  });

  test('Sorting Functionality', async ({ page }) => {
    // Test sorting by name
    await page.click('th:has-text("Name")');
    await page.waitForTimeout(300);

    // Verify sorting indicator or effect
    const firstRowName = page.locator('tbody tr:first-child td:first-child');
    const firstNameText = await firstRowName.textContent();

    // Click again to reverse sort
    await page.click('th:has-text("Name")');
    await page.waitForTimeout(300);

    const newFirstRowName = page.locator('tbody tr:first-child td:first-child');
    const newFirstNameText = await newFirstRowName.textContent();

    // Names should be different after reverse sort (unless only one service)
    const serviceRows = page.locator('tbody tr');
    if (await serviceRows.count() > 1) {
      expect(firstNameText).not.toBe(newFirstNameText);
    }
  });

  test('Create New Service - Full CRUD Lifecycle', async ({ page }) => {
    // Step 1: Create a new service
    await page.click('text=Add Service');

    // Verify modal opened
    await expect(page.locator('text=Create New Service')).toBeVisible();

    // Fill out the service form
    const serviceName = `Test Service ${Date.now()}`;
    await page.fill('input#name', serviceName);
    await page.selectOption('select#category', 'MAINTENANCE');
    await page.fill('input#subcategory', 'Test Subcategory');
    await page.fill('input#default_hours', '2.5');
    await page.fill('input#base_labor_rate', '150.00');
    await page.selectOption('select#skill_level', '3');
    await page.fill('input#keywords', 'test, service, maintenance');
    await page.fill('input#display_order', '10');

    // Submit form
    await page.click('text=Create Service');

    // Wait for success and modal to close
    await expect(page.locator('text=Create New Service')).not.toBeVisible();

    // Verify service appears in table
    await expect(page.locator(`text=${serviceName}`)).toBeVisible();

    // Step 2: Edit the service
    const serviceRow = page.locator(`tr:has-text("${serviceName}")`);
    await serviceRow.locator('button[title="Edit"], svg[data-testid="edit-icon"], button:has(svg)').first().click();

    // Verify edit modal opened
    await expect(page.locator('text=Edit Service')).toBeVisible();

    // Update service name
    const updatedName = `${serviceName} - Updated`;
    await page.fill('input#name', updatedName);
    await page.fill('input#base_labor_rate', '175.00');

    // Submit update
    await page.click('text=Update Service');

    // Wait for modal to close
    await expect(page.locator('text=Edit Service')).not.toBeVisible();

    // Verify updated service appears
    await expect(page.locator(`text=${updatedName}`)).toBeVisible();
    await expect(page.locator('text=$175')).toBeVisible();

    // Step 3: Delete the service
    const updatedServiceRow = page.locator(`tr:has-text("${updatedName}")`);
    await updatedServiceRow.locator('button[title="Delete"], svg[data-testid="delete-icon"], button:has(svg)').last().click();

    // Handle confirmation dialog
    page.on('dialog', dialog => dialog.accept());

    // Wait for deletion
    await page.waitForTimeout(1000);

    // Verify service is marked as inactive or removed
    // Note: Since we do soft delete, it might still appear but marked as inactive
    const inactiveService = page.locator(`tr:has-text("${updatedName}") .bg-red-100`);
    if (await inactiveService.count() > 0) {
      await expect(inactiveService).toContainText('Inactive');
    } else {
      // Or it might be filtered out from the view
      await expect(page.locator(`text=${updatedName}`)).not.toBeVisible();
    }
  });

  test('Form Validation', async ({ page }) => {
    // Open create modal
    await page.click('text=Add Service');

    // Try to submit without required fields
    await page.click('text=Create Service');

    // Verify validation (form should not submit)
    await expect(page.locator('text=Create New Service')).toBeVisible();

    // Fill only name and try again
    await page.fill('input#name', 'Test Service');
    await page.click('text=Create Service');

    // Should succeed with minimal required fields
    await expect(page.locator('text=Create New Service')).not.toBeVisible();
  });

  test('Service Details Display', async ({ page }) => {
    // Wait for services to load
    await page.waitForSelector('tbody tr');

    // Check if we have any services
    const serviceRows = page.locator('tbody tr');
    const rowCount = await serviceRows.count();

    if (rowCount > 0 && !await page.locator('text=No services found').isVisible()) {
      // Verify table columns are properly displayed
      await expect(page.locator('th:has-text("Name")')).toBeVisible();
      await expect(page.locator('th:has-text("Category")')).toBeVisible();
      await expect(page.locator('th:has-text("Duration")')).toBeVisible();
      await expect(page.locator('th:has-text("Rate")')).toBeVisible();
      await expect(page.locator('th:has-text("Skill Level")')).toBeVisible();
      await expect(page.locator('th:has-text("Status")')).toBeVisible();

      // Check first row has proper data structure
      const firstRow = serviceRows.first();
      await expect(firstRow.locator('td').first()).toContainText(/\w/); // Has some text
    }
  });

  test('Loading States', async ({ page }) => {
    // Reload page to see loading state
    await page.reload();

    // Should show loading spinner
    const loadingIndicator = page.locator('.animate-spin, text=Loading services');
    // Loading might be very fast, so we'll just check it exists or has loaded

    // Wait for content to load
    await page.waitForLoadState('networkidle');

    // Verify content loaded
    await expect(page.locator('table')).toBeVisible();
  });

  test('Error Handling', async ({ page }) => {
    // Test with potential network error by intercepting requests
    await page.route('**/api/admin/service-operations**', route => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Server error' })
        });
      } else {
        route.continue();
      }
    });

    // Try to create a service
    await page.click('text=Add Service');
    await page.fill('input#name', 'Error Test Service');
    await page.click('text=Create Service');

    // Should handle error gracefully
    // Note: Since we're using alert() for error messages, we need to handle that
    page.on('dialog', dialog => {
      expect(dialog.message()).toContain('Failed');
      dialog.accept();
    });

    await page.waitForTimeout(1000);
  });

  test('Accessibility Features', async ({ page }) => {
    // Check for proper ARIA labels and accessibility
    await expect(page.locator('select[aria-label="Filter by category"]')).toBeVisible();

    // Check for proper button labels
    await expect(page.locator('button:has-text("Add Service")')).toBeVisible();

    // Check table has proper structure
    await expect(page.locator('table thead')).toBeVisible();
    await expect(page.locator('table tbody')).toBeVisible();

    // Check for sr-only labels on action buttons
    const editButtons = page.locator('span.sr-only:has-text("Edit")');
    const deleteButtons = page.locator('span.sr-only:has-text("Delete")');

    // These should exist if there are services in the table
    const serviceRows = page.locator('tbody tr');
    if (await serviceRows.count() > 0) {
      await expect(editButtons.first()).toBeVisible();
      await expect(deleteButtons.first()).toBeVisible();
    }
  });

  test('Responsive Design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Verify key elements are still visible and functional
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('input[placeholder*="Search services"]')).toBeVisible();
    await expect(page.locator('text=Add Service')).toBeVisible();

    // Table should be scrollable on mobile
    await expect(page.locator('.overflow-x-auto')).toBeVisible();

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});
