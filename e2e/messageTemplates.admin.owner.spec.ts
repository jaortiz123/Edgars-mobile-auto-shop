import { test, expect, Page } from '@playwright/test';

function buildFakeJwt(role: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 60 * 60; // 1h
  const payload = Buffer.from(JSON.stringify({ sub: 'user-owner-1', email: 'owner@example.com', exp })).toString('base64url');
  const signature = 'testsignature';
  return `${header}.${payload}.${signature}`;
}

async function loginAsOwner(page: Page) {
  await page.route('**/customers/profile', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, body: JSON.stringify({ email: 'owner@example.com', role: 'Owner' }) });
    }
    return route.continue();
  });
  await page.addInitScript(token => {
    localStorage.setItem('auth_token', token as string);
  }, buildFakeJwt('Owner'));
  await page.goto('/');
}

test.describe('Admin Templates CRUD (Owner)', () => {
  test('create, edit, delete template lifecycle', async ({ page }) => {
    await loginAsOwner(page);

    // Intercept list/create BEFORE navigating so initial fetch is stubbed too.
    let createdSlug = 'e2e_test_template_' + Date.now();
  let created = false;
  let updated = false;
  let deleted = false;
    await page.route(/\/admin\/message-templates(?:\?.*)?$/, route => {
      const method = route.request().method();
      if (method === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        expect(body.slug).toBe(createdSlug);
        created = true;
        return route.fulfill({ status: 200, body: JSON.stringify({ id: 'temp-id-1', slug: body.slug, label: body.label, channel: body.channel, category: body.category, body: body.body, variables: [], is_active: true }) });
      }
      if (method === 'GET') {
        if (deleted) {
          return route.fulfill({ status: 200, body: JSON.stringify({ message_templates: [] }) });
        }
        if (!created) {
          return route.fulfill({ status: 200, body: JSON.stringify({ message_templates: [] }) });
        }
        if (created && !updated) {
          return route.fulfill({ status: 200, body: JSON.stringify({ message_templates: [{ id: 'temp-id-1', slug: createdSlug, label: 'Test Label', channel: 'sms', category: 'Tests', body: 'Hello {{name}}', variables: ['name'], is_active: true }] }) });
        }
        if (updated) {
          return route.fulfill({ status: 200, body: JSON.stringify({ message_templates: [{ id: 'temp-id-1', slug: createdSlug, label: 'Updated Label', channel: 'sms', category: 'Tests', body: 'Hello {{name}}', variables: ['name'], is_active: true }] }) });
        }
      }
      return route.continue();
    });

    await page.goto('/admin/templates');

    // Ensure Create button visible
    const createBtn = page.getByTestId('create-template-btn');
    await expect(createBtn).toBeVisible();

    await createBtn.click();
    await expect(page.getByText('Create Template')).toBeVisible();

    await page.fill('input[placeholder="vehicle_ready_sms"]', createdSlug);
    await page.fill('input[placeholder="Vehicle Ready (SMS)"]', 'Test Label');
    await page.fill('input[placeholder="Reminders"]', 'Tests');
    await page.fill('textarea[placeholder="Hi {{customer.name}}, your vehicle is ready!"]', 'Hello {{name}}');
    await page.click('button:has-text("Save")');

    // Expect modal closed and table shows new row
    await expect(page.getByTestId('templates-table')).toBeVisible();
    await expect(page.getByText(createdSlug)).toBeVisible();

    // EDIT FLOW
  await page.route(/\/admin\/message-templates\/(?:[^?]+)?(?:\?.*)?$/, route => {
      const url = route.request().url();
      if (route.request().method() === 'PATCH' && url.includes(createdSlug)) {
        const body = JSON.parse(route.request().postData() || '{}');
        expect(body.label).toBe('Updated Label');
        updated = true;
        return route.fulfill({ status: 200, body: JSON.stringify({ id: 'temp-id-1', slug: createdSlug, label: 'Updated Label', channel: 'sms', category: 'Tests', body: 'Hello {{name}}', variables: ['name'], is_active: true }) });
      }
      if (route.request().method() === 'GET') {
        // Detailed GET for single template fetch could occur; return latest state
        const label = updated ? 'Updated Label' : 'Test Label';
        return route.fulfill({ status: 200, body: JSON.stringify({ id: 'temp-id-1', slug: createdSlug, label, channel: 'sms', category: 'Tests', body: 'Hello {{name}}', variables: ['name'], is_active: true }) });
      }
      return route.continue();
    });

    await page.getByTestId(`edit-${createdSlug}`).click();
    await expect(page.getByText('Edit Template')).toBeVisible();
    const labelInput = page.locator('input[placeholder="Vehicle Ready (SMS)"]');
    await labelInput.fill('Updated Label');
    await page.click('button:has-text("Save")');
  // Wait for PATCH + subsequent list GET to finish before asserting
  await page.waitForResponse(resp => /\/admin\/message-templates\//.test(resp.url()) && resp.request().method() === 'PATCH');
  await page.waitForResponse(resp => /\/admin\/message-templates(?:\?.*)?$/.test(resp.url()) && resp.request().method() === 'GET');
  await expect(page.getByText('Updated Label')).toBeVisible();

    // DELETE FLOW
  await page.route(/\/admin\/message-templates\/(?:[^?]+)?(?:\?.*)?$/, route => {
      const url = route.request().url();
      if (route.request().method() === 'DELETE' && url.includes(createdSlug)) {
        // After delete, mark as updated and rely on list GET interceptor to return empty list
  deleted = true;
        return route.fulfill({ status: 200, body: JSON.stringify({ deleted: true, soft: true }) });
      }
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, body: JSON.stringify({ message_templates: [] }) });
      }
      return route.continue();
    });

    // Stub confirm dialog
    page.once('dialog', dialog => dialog.accept());
  await page.getByTestId(`delete-${createdSlug}`).click();
  await page.waitForResponse(resp => /\/admin\/message-templates\//.test(resp.url()) && resp.request().method() === 'DELETE');
  await page.waitForResponse(resp => /\/admin\/message-templates(?:\?.*)?$/.test(resp.url()) && resp.request().method() === 'GET');
  await expect(page.getByText(createdSlug)).toHaveCount(0);
  });
});
