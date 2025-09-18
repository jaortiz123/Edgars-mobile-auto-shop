import { test, expect } from '@playwright/test';

test.describe('Customer Search Debug & Network Analysis', () => {
  test('Reproduce customer search failure and capture network logs', async ({ page }) => {
    console.log('🔍 Starting Customer Search Debug Test');

    // Array to capture all network requests
    const networkRequests: Array<{
      url: string;
      method: string;
      status: number;
      response?: any;
      timestamp: string;
    }> = [];

    // Listen for all network requests
    page.on('request', request => {
      console.log(`📤 REQUEST: ${request.method()} ${request.url()}`);
    });

    page.on('response', async response => {
      const url = response.url();
      const method = response.request().method();
      const status = response.status();
      const timestamp = new Date().toISOString();

      console.log(`📥 RESPONSE: ${method} ${url} - Status: ${status}`);

      // Capture customer search API calls specifically
      if (url.includes('/api/admin/customers') || url.includes('/api/customers')) {
        let responseBody = null;
        try {
          responseBody = await response.json();
        } catch (e) {
          console.log(`⚠️ Could not parse JSON response for ${url}`);
        }

        networkRequests.push({
          url,
          method,
          status,
          response: responseBody,
          timestamp
        });

        console.log(`🎯 CUSTOMER API CAPTURED: ${method} ${url}`);
        console.log(`📊 Status: ${status}`);
        console.log(`📋 Response:`, JSON.stringify(responseBody, null, 2));
      }
    });

    // Navigate to the customers page
    console.log('🚀 Navigating to /admin/customers');
    await page.goto('http://localhost:5173/admin/customers');

    // Wait for page to load
    await page.waitForLoadState('networkidle');
    console.log('✅ Page loaded');

    // Look for search input
    console.log('🔍 Looking for search input field');
    const searchInput = page.locator('input[type="text"]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    console.log('✅ Search input found');

    // Type "Jesus" into the search field
    console.log('⌨️ Typing "Jesus" into search field');
    await searchInput.fill('Jesus');

    // Wait a moment for search to trigger
    await page.waitForTimeout(2000);

    // Try pressing Enter to trigger search
    console.log('⏎ Pressing Enter to trigger search');
    await searchInput.press('Enter');

    // Wait for potential network requests
    await page.waitForTimeout(3000);

    // Log all captured network requests
    console.log('\n📊 NETWORK ANALYSIS SUMMARY');
    console.log('='.repeat(50));

    if (networkRequests.length === 0) {
      console.log('❌ NO CUSTOMER API CALLS DETECTED');
      console.log('🔍 This indicates the frontend is not making API requests');
    } else {
      console.log(`✅ CAPTURED ${networkRequests.length} CUSTOMER API CALLS:`);

      networkRequests.forEach((req, index) => {
        console.log(`\n📡 Request ${index + 1}:`);
        console.log(`   URL: ${req.url}`);
        console.log(`   Method: ${req.method}`);
        console.log(`   Status: ${req.status}`);
        console.log(`   Time: ${req.timestamp}`);

        if (req.response) {
          console.log(`   Response:`, JSON.stringify(req.response, null, 4));
        }

        // Analyze the response
        if (req.status >= 200 && req.status < 300) {
          console.log(`   ✅ SUCCESS: API call succeeded`);

          if (req.response && req.response.data) {
            const customers = req.response.data.customers || req.response.data.customer || [];
            console.log(`   👥 Found ${Array.isArray(customers) ? customers.length : (customers ? 1 : 0)} customers`);
          }
        } else {
          console.log(`   ❌ FAILURE: HTTP ${req.status}`);
        }
      });
    }

    // Also check if there are any visible results in the UI
    console.log('\n🎨 UI STATE ANALYSIS');
    console.log('='.repeat(30));

    const resultsContainer = page.locator('[data-testid="customer-results"], .customer-results, .search-results').first();
    const isResultsVisible = await resultsContainer.isVisible().catch(() => false);

    if (isResultsVisible) {
      console.log('✅ Results container is visible');
      const resultCount = await resultsContainer.locator('.customer-item, .customer-row, tr').count();
      console.log(`📊 Visible results: ${resultCount}`);
    } else {
      console.log('❌ No results container found in UI');
    }

    // Check for error messages
    const errorMessage = page.locator('.error, .alert-error, [role="alert"]').first();
    const hasError = await errorMessage.isVisible().catch(() => false);

    if (hasError) {
      const errorText = await errorMessage.textContent();
      console.log(`🚨 Error message visible: "${errorText}"`);
    }

    // Take a screenshot for visual debugging
    await page.screenshot({
      path: 'e2e-report/customer-search-debug.png',
      fullPage: true
    });
    console.log('📸 Screenshot saved to e2e-report/customer-search-debug.png');

    // Final analysis
    console.log('\n🎯 ROOT CAUSE ANALYSIS');
    console.log('='.repeat(40));

    if (networkRequests.length === 0) {
      console.log('🔍 DIAGNOSIS: Frontend Issue');
      console.log('   • Search input is not triggering API calls');
      console.log('   • Check: Event handlers, form submission, API service calls');
      console.log('   • Action: Inspect frontend search implementation');
    } else {
      const failedRequests = networkRequests.filter(req => req.status >= 400);
      if (failedRequests.length > 0) {
        console.log('🔍 DIAGNOSIS: Backend Issue');
        console.log('   • API calls are being made but failing');
        console.log('   • Check: Backend endpoint implementation, authentication, database queries');
        console.log('   • Action: Debug backend search logic');
      } else {
        console.log('🔍 DIAGNOSIS: Data/UI Issue');
        console.log('   • API calls succeed but UI not updating');
        console.log('   • Check: Response parsing, state management, UI rendering');
        console.log('   • Action: Debug frontend response handling');
      }
    }
  });
});
