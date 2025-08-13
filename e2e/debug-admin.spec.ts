import { test, expect } from '@playwright/test';
import fs from 'fs';

test('debug admin dashboard', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const consoleMessages: string[] = [];
  page.on('console', msg => consoleMessages.push(`${msg.type()}: ${msg.text()}`));

  const networkFailures: any[] = [];
  page.on('requestfailed', req => {
    networkFailures.push({ type: 'failed', url: req.url(), method: req.method(), failure: req.failure()?.errorText });
  });
  page.on('response', res => {
    if (res.status() >= 400) {
      networkFailures.push({ type: 'response-error', url: res.url(), status: res.status() });
    }
  });

  // Navigate to admin dashboard
  await page.goto('http://localhost:5173/admin/dashboard', { waitUntil: 'networkidle' });

  // Wait briefly to reproduce the white-screen
  await page.waitForTimeout(3000);

  // Ensure output dir
  try { fs.mkdirSync('e2e-report', { recursive: true }); } catch {}

  // Take screenshot
  const screenshotPath = 'e2e-report/admin-dashboard-debug.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });

  // Print logs to stdout so we can capture them
  console.log('PLAYWRIGHT_CONSOLE_LOGS_START');
  console.log(JSON.stringify(consoleMessages, null, 2));
  console.log('PLAYWRIGHT_CONSOLE_LOGS_END');

  console.log('PLAYWRIGHT_PAGEERRORS_START');
  console.log(JSON.stringify(pageErrors, null, 2));
  console.log('PLAYWRIGHT_PAGEERRORS_END');

  console.log('PLAYWRIGHT_NETWORK_LOGS_START');
  console.log(JSON.stringify(networkFailures, null, 2));
  console.log('PLAYWRIGHT_NETWORK_LOGS_END');

  // Sanity assertion
  expect(true).toBeTruthy();
});
