// Network debugging test to see what API calls are being made
import { test, expect } from '@playwright/test';

test('Network Debug - Customer Profile API Calls', async ({ page }) => {
  console.log('🌐 Debugging network requests for customer profile...');

  // Capture all network requests
  const apiRequests: any[] = [];

  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/customers/322') || url.includes('/profile')) {
      apiRequests.push({
        method: request.method(),
        url: url,
        headers: Object.fromEntries(request.headers()),
      });
      console.log(`📤 REQUEST: ${request.method()} ${url}`);
    }
  });

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/customers/322') || url.includes('/profile')) {
      try {
        const responseBody = await response.text();
        console.log(`📥 RESPONSE: ${response.status()} ${url}`);

        // Parse and analyze the response if it's JSON
        if (response.headers()['content-type']?.includes('application/json')) {
          try {
            const jsonData = JSON.parse(responseBody);

            // Look for vehicles in the response
            let vehiclesFound = false;
            if (jsonData.data && jsonData.data.vehicles) {
              vehiclesFound = true;
              console.log(`   🚗 Vehicles in response: ${jsonData.data.vehicles.length}`);
              jsonData.data.vehicles.forEach((v: any, i: number) => {
                console.log(`      Vehicle ${i + 1}: ${v.year} ${v.make} ${v.model} (ID: ${v.id})`);
              });
            }

            if (!vehiclesFound) {
              console.log('   ❌ No vehicles found in response');
              console.log('   📋 Available keys:', Object.keys(jsonData));
              if (jsonData.data) {
                console.log('   📋 Data keys:', Object.keys(jsonData.data));
              }
            }

            // Check for stats
            if (jsonData.data && jsonData.data.stats) {
              console.log(`   📊 Stats found with keys: ${Object.keys(jsonData.data.stats)}`);
            }

          } catch (parseError) {
            console.log(`   ⚠️ JSON Parse Error: ${parseError}`);
          }
        }

      } catch (e) {
        console.log(`   ⚠️ Response Body Error: ${e}`);
      }
    }
  });

  // Navigate to the page
  console.log('🚀 Navigating to customer profile page...');
  await page.goto('http://localhost:5173/admin/customers/322');

  // Wait for all network requests to complete
  await page.waitForLoadState('networkidle');

  // Wait a bit more to ensure all API calls are captured
  await page.waitForTimeout(3000);

  console.log(`📊 Summary: Captured ${apiRequests.length} API requests`);
  apiRequests.forEach((req, i) => {
    console.log(`   ${i + 1}. ${req.method} ${req.url}`);
  });
});
