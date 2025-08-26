import { test, expect } from '@play    });

    // Monitor network failures;

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

    // Monitor browser console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString(),
      });
    });

    // Monitor failed requests
    page.on('requestfailed', (request) => {
      failedRequests.push({
        url: request.url(),
        error: request.failure()?.errorText || 'Unknown error',
        timestamp: new Date().toISOString()
      });
    });

    // Navigate to admin dashboard
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');

    // Wait for the status board to load
    await page.waitForSelector('.nb-board-grid', { timeout: 10000 });

    // Create a test appointment first through the API to have something to open
    await page.evaluate(async () => {
      try {
        const response = await fetch('/api/admin/appointments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customer_name: 'Test Customer for Debug',
            vehicle: '2023 Test Vehicle',
            services_summary: 'Debug Test Service',
            status: 'SCHEDULED',
            start: new Date().toISOString(),
            position: 1
          })
        });
        if (response.ok) {
          const data = await response.json();
          console.log('Created test appointment:', data);
          return data;
        }
      } catch (e) {
        console.log('Failed to create test appointment:', e);
      }
      return null;
    });

    // Wait a bit for the board to refresh with new appointment
    await page.waitForTimeout(1000);

    // Find appointment cards using a broader selector
    const appointmentCards = await page.locator('[data-testid^="appointment-card"], [data-testid^="apt-card"], [data-appointment-id]');
    const cardCount = await appointmentCards.count();
    console.log(`Found ${cardCount} appointment cards`);

    if (cardCount > 0) {
      // Get details about the first card
      const firstCard = appointmentCards.first();
      const appointmentTestId = await firstCard.getAttribute('data-testid');
      const appointmentDataId = await firstCard.getAttribute('data-appointment-id');
      const cardText = await firstCard.textContent();

      console.log(`First card details:`, {
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

        // Also intercept the alternative admin endpoint just in case
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

        // Try to open the appointment drawer by clicking the OPEN button
        console.log(`Looking for OPEN button for appointment ${actualId}`);
        const openButton = page.locator(`[data-testid="apt-card-open-${actualId}"]`);
        const openButtonExists = await openButton.count() > 0;

        if (openButtonExists) {
          console.log(`Clicking OPEN button for appointment ${actualId}`);
          await openButton.click();
        } else {
          console.log(`No OPEN button found, clicking card directly`);
          await firstCard.click();
        }

        // Wait for drawer to appear and check for error
        await page.waitForTimeout(2000);

        // Check if error banner appeared
        const errorBanner = page.locator('[data-testid="error-banner"], .error-banner, .alert-error');
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
        console.log('Could not extract appointment ID from card attributes');
      }
    } else {
      console.log('No appointment cards found to test with');
    }

    // Log all captured network activity
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
