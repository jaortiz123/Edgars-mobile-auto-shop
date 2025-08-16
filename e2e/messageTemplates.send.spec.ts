import { test, expect, Page } from '@playwright/test';

// Assumptions:
// - Dashboard accessible at '/'
// - Appointment drawer can be opened via data-testid="open-drawer-<id>" (if not, adjust selectors later)
// - Network layer uses /appointments/:id/messages (already existing) for messaging
// This test intercepts the POST to verify payload and simulates success & failure.

const APPOINTMENT_ID = 'seed-appt-1';

async function openMessagesHarness(page: Page) {
  await page.goto(`/e2e/message-thread/${APPOINTMENT_ID}`);
  await page.getByTestId('message-thread-harness').waitFor();
}

test.describe('Template Insert & Send optimistic flow', () => {
  test('successful optimistic send', async ({ page }) => {
    // Stub template list for harness
    await page.route(/\/admin\/message-templates(?:\?.*)?$/, route => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, body: JSON.stringify({ message_templates: [
          { id: 'tpl1', slug: 'ready_sms', label: 'Ready SMS', channel: 'sms', category: 'General', body: 'Vehicle ready for pickup', variables: [], is_active: true },
          { id: 'tpl2', slug: 'followup_sms', label: 'Follow Up', channel: 'sms', category: 'General', body: 'How is your vehicle performing?', variables: [], is_active: true }
        ] }) });
      }
      return route.continue();
    });
    // Stub messages endpoints
    await page.route(/\/appointments\/.*\/messages$/, route => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, body: JSON.stringify({ messages: [] }) });
      }
      if (route.request().method() === 'POST') {
        const postData = JSON.parse(route.request().postData() || '{}');
        expect(postData.body).toBeTruthy();
        expect(Array.isArray(postData.variables_used)).toBeTruthy();
        return route.fulfill({ status: 200, body: JSON.stringify({ id: 'server-msg-1', status: 'delivered' }) });
      }
      return route.continue();
    });

  await openMessagesHarness(page);

    // Open template panel
  await page.getByTestId('template-picker-button').click();
    // Preview first template
    const firstTemplateButton = page.locator('[data-testid^="template-option-"]').first();
    await firstTemplateButton.click();
    // Click Insert & Send
    const sendButton = page.locator('[data-testid^="template-send-"]').first();
    await sendButton.click();

    // Optimistic message appears
  const optimistic = page.locator('[data-testid^="message-status-"]').first();
    await expect(optimistic).toHaveAttribute('data-state', /sending|delivered/);
  });

  test('failed optimistic send shows retry', async ({ page }) => {
    await page.route(/\/admin\/message-templates(?:\?.*)?$/, route => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, body: JSON.stringify({ message_templates: [
          { id: 'tpl1', slug: 'ready_sms', label: 'Ready SMS', channel: 'sms', category: 'General', body: 'Vehicle ready for pickup', variables: [], is_active: true }
        ] }) });
      }
      return route.continue();
    });
    let firstPost = true;
    await page.route(/\/appointments\/.*\/messages$/, route => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, body: JSON.stringify({ messages: [] }) });
      }
      if (route.request().method() === 'POST') {
        if (firstPost) {
          firstPost = false;
          return route.fulfill({ status: 500, body: JSON.stringify({ error: 'fail' }) });
        }
        return route.fulfill({ status: 200, body: JSON.stringify({ id: 'server-msg-2', status: 'delivered' }) });
      }
      return route.continue();
    });

  await openMessagesHarness(page);

  await page.getByTestId('template-picker-button').click();
    const firstTemplateButton = page.locator('[data-testid^="template-option-"]').first();
    await firstTemplateButton.click();
    const sendButton = page.locator('[data-testid^="template-send-"]').first();
    await sendButton.click();

    // Expect failed state eventually
    const statusEl = page.locator('[data-testid^="message-status-"]').first();
    await statusEl.waitFor();
    await page.waitForTimeout(300); // allow failure handling
    await expect(statusEl).toHaveAttribute('data-state', 'failed');

    // Retry
    const retryBtn = page.locator('[data-testid^="retry-"]').first();
    await retryBtn.click();
    await expect(statusEl).toHaveAttribute('data-state', /sending|delivered/);
  });
});
