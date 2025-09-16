import { test, expect } from '@playwright/test';

test('smoke: backend health endpoint responds', async ({ request }) => {
  const response = await request.get('/health');
  expect(response.ok()).toBeTruthy();
});
