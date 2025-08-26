import { test, expect } from '@playwright/test';

/**
 * Test that appointment cards on the status board display actual service names
 * instead of generic "Service #x" fallbacks.
 *
 * This test ensures the backend properly provides primaryOperationName from
 * the LEFT JOIN to service_operations table, and the frontend uses it correctly.
 */
test.describe('Board Service Names', () => {
  test('appointment cards show descriptive service names instead of Service #x', async ({ page }) => {
    // Navigate to the status board
    await page.goto('/admin/dashboard');
    await page.waitForSelector('[data-testid="status-board"]', { timeout: 10000 });

    // Wait for cards to load
    await page.waitForSelector('[data-appointment-id]', { timeout: 10000 });

    // Get all appointment card headlines
    const cardHeadlines = await page.locator('[data-appointment-id] .headline, [data-appointment-id] [class*="headline"]').allTextContents();

    // Verify that no cards show the generic "Service #x" pattern
    for (const headline of cardHeadlines) {
      if (headline && headline.trim()) {
        // Check that the headline is not in the format "Service #123" (generic fallback)
        expect(headline).not.toMatch(/^Service\s+#\d+$/);
        console.log(`✓ Card headline: "${headline}" (not generic fallback)`);
      }
    }

    // Ensure we actually found some cards to test
    expect(cardHeadlines.length).toBeGreaterThan(0);

    // Additional check: if we have cards, ensure they show meaningful service names
    if (cardHeadlines.length > 0) {
      const meaningfulHeadlines = cardHeadlines.filter(h =>
        h && h.trim() &&
        !h.match(/^Service\s+#\d+$/) &&
        h.length > 5 // Reasonable service name length
      );

      // At least some cards should have meaningful service names
      expect(meaningfulHeadlines.length).toBeGreaterThan(0);
      console.log(`✓ Found ${meaningfulHeadlines.length} cards with descriptive service names`);
    }
  });

  test('appointment cards display service names from backend API', async ({ page }) => {
    // Navigate to the status board
    await page.goto('/admin/dashboard');
    await page.waitForSelector('[data-testid="status-board"]', { timeout: 10000 });

    // Intercept the board API call to verify backend includes primaryOperationName
    const boardResponse = await page.waitForResponse(response =>
      response.url().includes('/api/admin/appointments/board') && response.status() === 200
    );

    const boardData = await boardResponse.json();

    // Verify the response structure includes cards with primaryOperationName
    expect(Array.isArray(boardData)).toBe(true);

    // Find the cards array in the response (should be second element)
    const cardsArray = boardData.find((item: any) => Array.isArray(item));

    if (cardsArray && cardsArray.length > 0) {
      // Check that cards have primaryOperationName field from backend
      for (const card of cardsArray.slice(0, 3)) { // Check first 3 cards
        expect(card).toHaveProperty('id');
        expect(card).toHaveProperty('customerName');

        // The key assertion: primaryOperationName should be present
        expect(card).toHaveProperty('primaryOperationName');

        console.log(`✓ Card ${card.id}: primaryOperationName = "${card.primaryOperationName}"`);
      }
    }
  });
});
