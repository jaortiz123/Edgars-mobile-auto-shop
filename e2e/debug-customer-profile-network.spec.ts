import { test, expect } from '@playwright/test';
import { stubCustomerProfile } from './utils/stubAuthProfile';

// Helper function to ensure proper login (from existing E2E tests)
async function ensureLoggedIn(page) {
  // Navigate directly to customers page; storageState should already have auth token.
  await page.goto('http://localhost:5173/admin/customers');
  if (/\/admin\/login/.test(page.url())) {
    // Fallback: perform real login if redirect happened.
    const user = page.getByPlaceholder(/username/i).or(page.getByRole('textbox', { name: /username/i }));
    const pass = page.getByPlaceholder(/password/i).or(page.getByLabel(/password/i));
    await user.fill('advisor');
    await pass.fill('dev');
    const loginBtn = page.getByRole('button', { name: /login|log in|sign in/i });
    await loginBtn.click();
    await page.waitForURL(/\/admin\//, { timeout: 15000 });
    // Navigate again to customers list after login
    await page.goto('http://localhost:5173/admin/customers');
  }
}

test.describe('Debug Customer Profile Network Error', () => {
  test('capture network error when clicking View Full History', async ({ page }) => {
    // Set up authentication like other E2E tests
    await stubCustomerProfile(page);

    // Enable detailed console logging
    page.on('console', msg => console.log(`🔍 CONSOLE: ${msg.type()}: ${msg.text()}`));

    // Track all network requests and responses
    const requests: string[] = [];
    const responses: { url: string; status: number; error?: string }[] = [];

    page.on('request', request => {
      requests.push(`${request.method()} ${request.url()}`);
      console.log(`📤 REQUEST: ${request.method()} ${request.url()}`);
    });

    page.on('response', response => {
      const entry = { url: response.url(), status: response.status() };
      responses.push(entry);
      console.log(`📥 RESPONSE: ${response.status()} ${response.url()}`);
    });

    page.on('requestfailed', request => {
      const error = `${request.failure()?.errorText || 'Unknown error'}`;
      console.log(`❌ REQUEST FAILED: ${request.url()} - ${error}`);
      responses.push({ url: request.url(), status: 0, error });
    });

    // Use the authentication method from existing E2E tests
    await ensureLoggedIn(page);
    console.log('✅ Successfully authenticated and navigated to customers page');


    // Wait for customers to load
    await page.waitForLoadState('networkidle');

    // Look for any customer card and click "View Full History"
    const customerCards = page.locator('[data-testid^="customer-card-"]');
    const cardCount = await customerCards.count();
    console.log(`🔍 Found ${cardCount} customer cards`);

    if (cardCount > 0) {
      // Get the first customer card
      const firstCard = customerCards.first();

      // Find the "View Full History" button
      const viewHistoryBtn = firstCard.locator('[data-testid="customer-view-history"]');

      if (await viewHistoryBtn.count() > 0) {
        console.log('🔍 Found "View Full History" button, clicking...');

        // Clear previous requests/responses to focus on the error
        requests.length = 0;
        responses.length = 0;

        // Click the button and wait for navigation
        await viewHistoryBtn.click();

        // Wait for potential navigation and network requests
        await page.waitForTimeout(3000);

        console.log('\n📊 NETWORK ACTIVITY AFTER CLICKING "View Full History":');
        console.log('Requests made:');
        requests.forEach(req => console.log(`  - ${req}`));

        console.log('\nResponses received:');
        responses.forEach(resp => {
          if (resp.error) {
            console.log(`  ❌ ${resp.url} - FAILED: ${resp.error}`);
          } else if (resp.status >= 400) {
            console.log(`  ❌ ${resp.url} - ERROR: ${resp.status}`);
          } else {
            console.log(`  ✅ ${resp.url} - ${resp.status}`);
          }
        });

        // Check if we navigated to a customer profile page
        const currentUrl = page.url();
        console.log(`🔍 Current URL after click: ${currentUrl}`);

        // Check for any error messages on the page
        const errorMessages = page.locator('text=/error|failed|network|problem/i');
        const errorCount = await errorMessages.count();
        if (errorCount > 0) {
          console.log(`🔍 Found ${errorCount} error messages on page:`);
          for (let i = 0; i < errorCount; i++) {
            const errorText = await errorMessages.nth(i).textContent();
            console.log(`  - ${errorText}`);
          }
        }

        // Check the page content for any obvious issues
        const pageTitle = await page.textContent('h1, h2, [data-testid*="title"], [data-testid*="name"]');
        console.log(`🔍 Page title/header: ${pageTitle}`);

        // Look for loading states that might be stuck
        const loadingElements = page.locator('text=/loading|spinner|skeleton/i');
        const loadingCount = await loadingElements.count();
        if (loadingCount > 0) {
          console.log(`🔍 Found ${loadingCount} loading elements (might be stuck)`);
        }

      } else {
        console.log('❌ No "View Full History" button found on first customer card');
      }
    } else {
      console.log('❌ No customer cards found - need to create test data first');

      // Let's check what's actually on the page
      const pageContent = await page.textContent('body');
      console.log('🔍 Page content preview:', pageContent?.substring(0, 500));
    }
  });
});
