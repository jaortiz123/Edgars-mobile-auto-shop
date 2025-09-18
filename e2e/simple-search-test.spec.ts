// Simple test to manually verify customer search works
import { test, expect } from '@playwright/test';

test('Manual Customer Search Verification', async ({ page }) => {
  // Capture network requests
  const apiRequests: any[] = [];

  page.on('request', (request) => {
    if (request.url().includes('/admin/customers') || request.url().includes('/api/customers')) {
      apiRequests.push({
        url: request.url(),
        method: request.method()
      });
      console.log(`📤 API REQUEST: ${request.method()} ${request.url()}`);
    }
  });

  page.on('response', async (response) => {
    if (response.url().includes('/admin/customers') || response.url().includes('/api/customers')) {
      try {
        const responseBody = await response.text();
        console.log(`📥 API RESPONSE: ${response.status()} ${response.url()}`);
        console.log(`📄 Response Body: ${responseBody.substring(0, 500)}${responseBody.length > 500 ? '...' : ''}`);
      } catch (e) {
        console.log(`📥 API RESPONSE: ${response.status()} ${response.url()} (body read error)`);
      }
    }
  });
  console.log('🔍 Starting manual customer search test');

  // Navigate to the customers page
  console.log('🚀 Navigating to /admin/customers');
  await page.goto('http://localhost:5173/admin/customers');

  // Wait for page to load
  console.log('⏳ Waiting for page to load...');
  await page.waitForLoadState('networkidle');

  // Take a screenshot to see the current state
  await page.screenshot({ path: 'test-results/customers-page-loaded.png', fullPage: true });
  console.log('📸 Screenshot saved: customers-page-loaded.png');

  // Look for the search input with different selectors
  console.log('🔍 Looking for search input...');

  const searchSelectors = [
    'input[type="text"]',
    'input[placeholder*="Search"]',
    'input[placeholder*="customer"]',
    'input[name*="search"]',
    '.search input',
    '[data-testid="search-input"]'
  ];

  let searchInput = null;

  for (const selector of searchSelectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 1000 })) {
        searchInput = element;
        console.log(`✅ Found search input with selector: ${selector}`);
        break;
      }
    } catch (e) {
      console.log(`❌ No search input found with selector: ${selector}`);
    }
  }

  if (searchInput) {
    // Type "Jesus" into the search field
    console.log('💬 Typing "Jesus" into search field...');
    await searchInput.fill('Jesus');

    // Wait a moment for the search to trigger (debounced)
    await page.waitForTimeout(1000);

    // Take another screenshot
    await page.screenshot({ path: 'test-results/after-search-input.png', fullPage: true });
    console.log('📸 Screenshot after search: after-search-input.png');

    // Wait for any network requests to complete
    await page.waitForTimeout(2000);

    // Look for results
    const resultsSelectors = [
      '.customer-card',
      '[data-testid="customer-result"]',
      '.search-results',
      '.customer-list li',
      '.customer-item',
      '[data-testid*="customer"]',
      '.bg-white.rounded-lg', // Common card pattern
      '.border.rounded' // Another card pattern
    ];

    let foundResults = false;
    for (const selector of resultsSelectors) {
      try {
        const results = page.locator(selector);
        const count = await results.count();
        if (count > 0) {
          console.log(`✅ Found ${count} results with selector: ${selector}`);
          foundResults = true;

          // Get text content of first result
          const firstResult = await results.first().textContent();
          console.log('First result content:', firstResult);

          // Check if it contains "Jesus" or "Lamborghini" (our expected data)
          if (firstResult && (firstResult.includes('Jesus') || firstResult.includes('Lamborghini'))) {
            console.log('🎉 FOUND EXPECTED SEARCH RESULT! Vehicle linkage data is visible!');
          }

          break;
        }
      } catch (e) {
        console.log(`❌ No results found with selector: ${selector}`);
      }
    }

    if (!foundResults) {
      console.log('⚠️ No search results found - checking page for error messages or loading states');

      // Check for common error/loading indicators
      const errorSelectors = [
        '.error',
        '.loading',
        '.spinner',
        '[data-testid="error"]',
        '[data-testid="loading"]',
        'text="No results"',
        'text="Loading"'
      ];

      for (const selector of errorSelectors) {
        try {
          const element = page.locator(selector);
          if (await element.isVisible({ timeout: 500 })) {
            const content = await element.textContent();
            console.log(`🔍 Found state indicator: ${selector} = "${content}"`);
          }
        } catch (e) {
          // Selector not found, continue
        }
      }
    }

    // Summary of API calls made
    console.log(`📊 Total API requests captured: ${apiRequests.length}`);
    apiRequests.forEach((req, i) => {
      console.log(`  ${i + 1}. ${req.method} ${req.url}`);
    });

  } else {
    console.log('❌ No search input found on page');

    // Get page content to debug
    const pageContent = await page.content();
    console.log('Page HTML contains search:', pageContent.includes('search'));
    console.log('Page HTML contains input:', pageContent.includes('<input'));
  }

  console.log('✅ Test completed');
});
