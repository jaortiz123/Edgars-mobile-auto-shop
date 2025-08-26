import { test, expect } from '@playwright/test';

test.describe('Debug Appointment Load Failure', () => {
  test('capture failing appointment load request', async ({ page }) => {
    // Arrays to capture network activity
    const networkRequests: Array<{ url: string; timestamp: string }> = [];
    const networkResponses: Array<{ url: string; status: number; timestamp: string; body?: any }> = [];
    const failedRequests: Array<{ url: string; error: string; timestamp: string }> = [];

    // Monitor all network requests
    page.on('request', (request) => {
      networkRequests.push({
        url: request.url(),
        timestamp: new Date().toISOString()
      });
    });

    // Monitor all network responses
    page.on('response', async (response) => {
      let body = null;
      try {
        // Only capture response body for API calls to avoid large payloads
        if (response.url().includes('/api/')) {
          body = await response.text();
        }
      } catch (e) {
        // Ignore errors when reading response body
      }

      networkResponses.push({
        url: response.url(),
        status: response.status(),
        timestamp: new Date().toISOString(),
        body
      });
    });

    // Monitor network failures
    page.on('requestfailed', (request) => {
      failedRequests.push({
        url: request.url(),
        error: request.failure()?.errorText || 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    });

    // Go to admin dashboard
    await page.goto('/admin/dashboard');
    await page.waitForTimeout(2000); // Wait for page to stabilize

    // Wait for appointment cards to load
    await page.waitForSelector('[data-appointment-id], [data-testid*="appointment-card"]', { timeout: 10000 });

    // Get all appointment cards
    const appointmentCards = await page.locator('[data-appointment-id], [data-testid*="appointment-card"]').all();
    console.log(`Found ${appointmentCards.length} appointment cards`);

    if (appointmentCards.length === 0) {
      throw new Error('No appointment cards found on dashboard');
    }

    // Use the first card for testing
    const firstCard = appointmentCards[0];
    const appointmentTestId = await firstCard.getAttribute('data-testid');
    const appointmentDataId = await firstCard.getAttribute('data-appointment-id');
    const cardText = await firstCard.textContent();

    console.log('First card details:', {
      testId: appointmentTestId,
      dataId: appointmentDataId,
      text: cardText?.slice(0, 100)
    });

    // Extract appointment ID from either attribute
    let actualId = appointmentTestId?.replace(/^(appointment-card-|apt-card-)/, '');
    if (!actualId && appointmentDataId) {
      actualId = appointmentDataId;
    }

    if (actualId) {
      console.log(`Intercepting requests for appointment ${actualId}`);

      // Intercept the drawer API call (the primary one used by AppointmentDrawer)
      await page.route(`**/api/appointments/${actualId}`, async (route) => {
        console.log(`Intercepted GET request for /api/appointments/${actualId} (drawer) - returning 500 error`);
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Failed to load appointment',
            message: 'Database connection failed',
            code: 'DB_CONNECTION_ERROR'
          })
        });
      });

      // Also intercept the rich appointment API call
      await page.route(`**/api/admin/appointments/${actualId}`, async (route) => {
        console.log(`Intercepted GET request for /api/admin/appointments/${actualId} - returning 500 error`);
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Failed to load appointment',
            message: 'Database connection failed',
            code: 'DB_CONNECTION_ERROR'
          })
        });
      });

      // Now click the OPEN button on the first card
      console.log(`Looking for OPEN button for appointment ${actualId}`);
      const openButton = await page.locator(`[id*="apt-card-open-${actualId}"], button:has-text("OPEN")`).first();
      const openButtonExists = await openButton.count() > 0;

      if (openButtonExists) {
        console.log(`Clicking OPEN button for appointment ${actualId}`);
        await openButton.click();
      } else {
        console.log(`No OPEN button found, clicking on card directly`);
        await firstCard.click();
      }

      // Wait a bit for requests to be made and drawer to open/show error
      await page.waitForTimeout(3000);

      // Check for error banners first
      const errorBanner = page.locator('[role="alert"], .alert-error, .error-banner');
      const hasError = await errorBanner.count() > 0;

      if (hasError) {
        const errorText = await errorBanner.first().textContent();
        console.log(`Error banner found: ${errorText}`);
      } else {
        console.log('No error banner found');
      }

      // Check if drawer opened successfully or showed error
      const drawer = page.locator('[data-testid="drawer-open"]').first();
      const drawerVisible = await drawer.count() > 0;
      console.log(`Appointment drawer visible: ${drawerVisible}`);

      if (drawerVisible) {
        // Look for detailed error message with the new format
        const detailedErrorText = await drawer.locator('text=/Failed to load appointment.*Reason.*Database connection failed/i').count();
        console.log(`Detailed error message found in drawer: ${detailedErrorText > 0}`);

        // Also check for any error messages in drawer - use first() to avoid strict mode
        const drawerErrorText = await drawer.textContent();
        console.log(`Drawer content preview: ${drawerErrorText?.slice(0, 200)}`);

        // Look for the specific error message we sent (legacy check)
        const dbErrorText = await drawer.locator('text=/database connection failed/i').count();
        console.log(`"Database connection failed" text found: ${dbErrorText > 0}`);

        if (detailedErrorText > 0) {
          console.log('✅ SUCCESS: Found detailed error message with API-specific reason');
        } else if (dbErrorText > 0) {
          console.log('⚠️  PARTIAL: Found API error message but not in expected detailed format');
        } else {
          console.log('❌ ERROR: Expected error message not found');
        }
      }
    } else {
      console.log('Could not extract appointment ID from card');
    }

    // Log captured network activity
    console.log('\n=== FAILED NETWORK REQUESTS ===');
    failedRequests.forEach((req, i) => {
      console.log(`${i + 1}. FAILED ${req.url} - ${req.error} at ${req.timestamp}`);
    });

    console.log('\n=== API NETWORK RESPONSES ===');
    networkResponses
      .filter(res => res.url.includes('/api/'))
      .forEach((res, i) => {
        console.log(`${i + 1}. ${res.status} ${res.url} at ${res.timestamp}`);
        if (res.status >= 400 && res.body) {
          console.log(`   Response body: ${res.body}`);
        }
      });

    console.log('\n=== ALL NETWORK REQUESTS ===');
    networkRequests
      .filter(req => req.url.includes('/api/'))
      .forEach((req, i) => {
        console.log(`${i + 1}. ${req.url} at ${req.timestamp}`);
      });
  });
});
