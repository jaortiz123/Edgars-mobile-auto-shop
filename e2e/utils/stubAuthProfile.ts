// Playwright helper to stub the customer profile endpoint (frontend expects it during auth init).
// Reduces noise (CORS / 404) and avoids re-render loops triggered by repeated auth failures cascading into the board.
import { Page } from '@playwright/test';

export async function stubCustomerProfile(page: Page, overrides: Partial<{ email: string }> = {}) {
  await page.route('**/customers/profile', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        email: overrides.email || 'advisor@example.com',
        vehicles: []
      })
    });
  });
}

export default stubCustomerProfile;
