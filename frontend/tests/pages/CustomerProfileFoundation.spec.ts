import { test, expect } from '@playwright/test';

/**
 * Customer Profile Foundation E2E Tests
 *
 * Tests the foundational customer profile page focusing on:
 * - Stats tiles displaying correctly from API
 * - Vehicles list showing vehicle data
 * - Loading states and skeletons
 * - Empty states handling
 * - ETag caching behavior
 */

test.describe('Customer Profile Foundation Page', () => {
  // Mock customer data for testing
  const mockCustomerProfile = {
    customer: {
      id: '12345',
      full_name: 'John Smith',
      phone: '555-0123',
      email: 'john.smith@example.com',
      created_at: '2023-01-15T10:00:00Z',
      tags: ['VIP'],
      notes: 'Preferred customer',
      sms_consent: true,
    },
    stats: {
      lifetime_spend: 2450.75,
      unpaid_balance: 150.00,
      total_visits: 8,
      last_visit_at: '2024-08-25T14:30:00Z',
      avg_ticket: 306.34,
      last_service_at: '2024-08-20T09:15:00Z',
    },
    vehicles: [
      {
        id: 'v001',
        year: 2020,
        make: 'Toyota',
        model: 'Camry',
        plate: 'ABC123',
        vin: '1HGBH41JXMN109186',
        notes: 'Regular maintenance customer',
      },
      {
        id: 'v002',
        year: 2018,
        make: 'Honda',
        model: 'Civic',
        plate: 'XYZ789',
        vin: '2HGFC2F59JH123456',
        notes: null,
      },
    ],
    appointments: [],
    page: {
      next_cursor: null,
      page_size: 25,
      has_more: false,
    },
  };

  test.beforeEach(async ({ page }) => {
    // Mock the customer profile API
    await page.route('/api/admin/customers/12345/profile*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCustomerProfile),
        headers: {
          'ETag': '"test-etag-12345"',
        },
      });
    });
  });

  test('displays customer profile with stats tiles and vehicles', async ({ page }) => {
    await page.goto('/admin/customers/12345/profile-foundation');

    // Wait for the page to load
    await expect(page.locator('h1')).toContainText('Customer Profile');
    await expect(page.locator('text=John Smith')).toBeVisible();

    // Test Stats Tiles Section
    await expect(page.locator('h2').first()).toContainText('Key Metrics');

    // Verify all stat tiles are displayed with correct values
    await expect(page.locator('[data-testid="stat-lifetime-spend"]')).toContainText('$2,450.75');
    await expect(page.locator('[data-testid="stat-unpaid-balance"]')).toContainText('$150.00');
    await expect(page.locator('[data-testid="stat-total-visits"]')).toContainText('8');
    await expect(page.locator('[data-testid="stat-avg-ticket"]')).toContainText('$306.34');
    await expect(page.locator('[data-testid="stat-last-visit"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-last-service"]')).toBeVisible();

    // Test Vehicles Section
    await expect(page.locator('h2').nth(1)).toContainText('Vehicles');

    // Verify vehicle filter buttons
    await expect(page.locator('text=All Vehicles (2)')).toBeVisible();
    await expect(page.locator('[data-testid="vehicle-filter-v001"]')).toContainText('2020 Toyota Camry');
    await expect(page.locator('[data-testid="vehicle-filter-v002"]')).toContainText('2018 Honda Civic');

    // Verify vehicle cards are displayed
    await expect(page.locator('[data-testid="vehicle-card-v001"]')).toContainText('2020 Toyota Camry');
    await expect(page.locator('[data-testid="vehicle-card-v001"]')).toContainText('ABC123');
    await expect(page.locator('[data-testid="vehicle-card-v001"]')).toContainText('1HGBH41JXMN109186');

    await expect(page.locator('[data-testid="vehicle-card-v002"]')).toContainText('2018 Honda Civic');
    await expect(page.locator('[data-testid="vehicle-card-v002"]')).toContainText('XYZ789');
  });

  test('shows warning styling for unpaid balance', async ({ page }) => {
    await page.goto('/admin/customers/12345/profile-foundation');

    // Wait for stats to load
    await expect(page.locator('[data-testid="stat-unpaid-balance"]')).toBeVisible();

    // Check that unpaid balance has warning styling (should have yellow border/background)
    const unpaidBalanceElement = page.locator('[data-testid="stat-unpaid-balance"]');
    await expect(unpaidBalanceElement).toHaveClass(/border-yellow/);
  });

  test('handles vehicle filtering correctly', async ({ page }) => {
    await page.goto('/admin/customers/12345/profile-foundation');

    // Wait for vehicles to load
    await expect(page.locator('[data-testid="vehicle-card-v001"]')).toBeVisible();
    await expect(page.locator('[data-testid="vehicle-card-v002"]')).toBeVisible();

    // Click on first vehicle filter
    await page.locator('[data-testid="vehicle-filter-v001"]').click();

    // Should show only the Toyota Camry card
    await expect(page.locator('[data-testid="vehicle-card-v001"]')).toBeVisible();
    await expect(page.locator('[data-testid="vehicle-card-v002"]')).not.toBeVisible();

    // Click on "All Vehicles" to reset filter
    await page.locator('text=All Vehicles (2)').click();

    // Should show both vehicle cards again
    await expect(page.locator('[data-testid="vehicle-card-v001"]')).toBeVisible();
    await expect(page.locator('[data-testid="vehicle-card-v002"]')).toBeVisible();
  });

  test('displays loading skeletons while data loads', async ({ page }) => {
    // Delay the API response to test loading state
    await page.route('/api/admin/customers/12345/profile*', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCustomerProfile),
      });
    });

    await page.goto('/admin/customers/12345/profile-foundation');

    // Should show loading skeletons
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(2); // Stats and vehicles skeletons

    // Check that skeleton elements are visible
    const skeletonElements = page.locator('.animate-pulse');
    await expect(skeletonElements.first()).toBeVisible();

    // Wait for data to load and skeletons to disappear
    await expect(page.locator('[data-testid="stat-lifetime-spend"]')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  });

  test('handles empty states correctly', async ({ page }) => {
    // Mock empty customer profile
    const emptyProfile = {
      ...mockCustomerProfile,
      stats: null,
      vehicles: [],
    };

    await page.route('/api/admin/customers/12345/profile*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(emptyProfile),
      });
    });

    await page.goto('/admin/customers/12345/profile-foundation');

    // Should show empty states
    await expect(page.locator('text=No statistics available yet')).toBeVisible();
    await expect(page.locator('text=No vehicles registered')).toBeVisible();
    await expect(page.locator('text=Add a vehicle to get started')).toBeVisible();
  });

  test('handles API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('/api/admin/customers/12345/profile*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await page.goto('/admin/customers/12345/profile-foundation');

    // Should show error message
    await expect(page.locator('text=Error loading customer')).toBeVisible();
  });

  test('handles missing customer ID', async ({ page }) => {
    await page.goto('/admin/customers//profile-foundation');

    // Should show missing ID error
    await expect(page.locator('text=Missing customer ID')).toBeVisible();
  });

  test('validates ETag caching behavior', async ({ page }) => {
    let requestCount = 0;

    await page.route('/api/admin/customers/12345/profile*', async (route) => {
      requestCount++;

      const headers = route.request().headers();

      if (requestCount === 1) {
        // First request - return data with ETag
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCustomerProfile),
          headers: {
            'ETag': '"test-etag-12345"',
          },
        });
      } else {
        // Subsequent requests should have If-None-Match header
        expect(headers['if-none-match']).toBe('"test-etag-12345"');

        // Return 304 Not Modified
        await route.fulfill({
          status: 304,
          headers: {
            'ETag': '"test-etag-12345"',
          },
        });
      }
    });

    await page.goto('/admin/customers/12345/profile-foundation');

    // Wait for initial load
    await expect(page.locator('[data-testid="stat-lifetime-spend"]')).toBeVisible();

    // Reload the page to trigger caching behavior
    await page.reload();

    // Should still show the same data (from cache)
    await expect(page.locator('[data-testid="stat-lifetime-spend"]')).toContainText('$2,450.75');

    // Verify that second request was made with proper ETag header
    expect(requestCount).toBe(2);
  });
});

test.describe('Responsive Design', () => {
  test('adapts to mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size

    await page.route('/api/admin/customers/12345/profile*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          customer: { id: '12345', full_name: 'John Smith' },
          stats: { lifetime_spend: 100, unpaid_balance: 0, total_visits: 1, avg_ticket: 100, last_visit_at: null, last_service_at: null },
          vehicles: [{ id: 'v1', year: 2020, make: 'Toyota', model: 'Camry', plate: 'ABC123' }],
          appointments: [],
        }),
      });
    });

    await page.goto('/admin/customers/12345/profile-foundation');

    // Should be responsive - stats should stack on mobile
    await expect(page.locator('[data-testid="stat-lifetime-spend"]')).toBeVisible();

    // Check that layout adapts - stats grid should be single column on mobile
    const statsGrid = page.locator('[data-testid="stat-lifetime-spend"]').locator('..');
    await expect(statsGrid).toHaveClass(/grid-cols-1/);
  });
});
