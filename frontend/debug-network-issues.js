/**
 * Debug Network Issues Script
 * Uses Playwright to capture network requests and identify 500 errors
 */

const { chromium } = require('playwright');

async function debugNetworkIssues() {
  console.log('🚀 Starting network debugging...');

  const browser = await chromium.launch({
    headless: false, // Keep browser open so you can see what's happening
    devtools: true   // Open DevTools automatically
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Track all network requests
  const networkRequests = [];
  const failedRequests = [];

  page.on('request', request => {
    console.log(`📤 REQUEST: ${request.method()} ${request.url()}`);
    networkRequests.push({
      method: request.method(),
      url: request.url(),
      headers: request.headers(),
      timestamp: new Date().toISOString()
    });
  });

  page.on('response', response => {
    const status = response.status();
    const url = response.url();

    console.log(`📥 RESPONSE: ${status} ${url}`);

    if (status >= 400) {
      console.log(`❌ FAILED REQUEST: ${status} ${url}`);
      failedRequests.push({
        status,
        url,
        statusText: response.statusText(),
        headers: response.headers(),
        timestamp: new Date().toISOString()
      });
    }
  });

  try {
    // Navigate to your frontend (adjust URL as needed)
    console.log('🌐 Navigating to frontend...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    // Wait a bit for initial requests to complete
    await page.waitForTimeout(3000);

    // Try to trigger some API calls by clicking around
    console.log('🖱️ Attempting to trigger API calls...');

    // Look for admin login or dashboard links
    const adminLinks = await page.locator('a[href*="admin"], button:has-text("admin"), [data-testid*="admin"]').all();
    if (adminLinks.length > 0) {
      console.log('🔑 Found admin elements, clicking...');
      await adminLinks[0].click();
      await page.waitForTimeout(2000);
    }

    // Look for any API-triggering buttons
    const buttons = await page.locator('button, [role="button"]').all();
    if (buttons.length > 0) {
      console.log('🔘 Clicking buttons to trigger requests...');
      for (let i = 0; i < Math.min(3, buttons.length); i++) {
        try {
          await buttons[i].click();
          await page.waitForTimeout(1000);
        } catch (e) {
          console.log(`Button ${i} click failed:`, e.message);
        }
      }
    }

    // Report findings
    console.log('\n📊 NETWORK DEBUG SUMMARY:');
    console.log(`Total requests: ${networkRequests.length}`);
    console.log(`Failed requests: ${failedRequests.length}`);

    if (failedRequests.length > 0) {
      console.log('\n❌ FAILED REQUESTS DETAILS:');
      for (const req of failedRequests) {
        console.log(`${req.status} ${req.statusText}: ${req.url}`);

        // Try to get response body for 500 errors
        if (req.status === 500) {
          try {
            const response = await page.waitForResponse(response =>
              response.url() === req.url && response.status() === 500,
              { timeout: 1000 }
            );
            const body = await response.text();
            console.log(`Response body: ${body}`);
          } catch (e) {
            console.log('Could not capture response body');
          }
        }
      }
    }

    // Check if backend is reachable
    console.log('\n🔍 Testing backend connectivity...');
    try {
      const backendResponse = await page.evaluate(async () => {
        try {
          const response = await fetch('http://localhost:5000/api/admin/appointments');
          return {
            status: response.status,
            statusText: response.statusText,
            body: await response.text()
          };
        } catch (error) {
          return { error: error.message };
        }
      });

      console.log('Backend test result:', backendResponse);
    } catch (e) {
      console.log('Backend connectivity test failed:', e.message);
    }

    console.log('\n✅ Debug session complete. Browser will stay open for manual inspection.');
    console.log('Check the Network tab in DevTools for more details.');

    // Keep browser open for manual inspection
    await page.waitForTimeout(60000); // Wait 1 minute

  } catch (error) {
    console.error('❌ Debug script error:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  debugNetworkIssues().catch(console.error);
}

module.exports = { debugNetworkIssues };
