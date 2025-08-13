import { test, expect } from '@playwright/test';

test('check neobrutal admin styles present', async ({ page }) => {
  await page.goto('http://localhost:5173/admin/dashboard', { waitUntil: 'networkidle' });

  const exists = await page.$('.admin-neobrutal') !== null;
  const rootVar = await page.evaluate(() => {
    const el = document.querySelector('.admin-neobrutal') || document.documentElement;
    const styles = getComputedStyle(el as Element);
    return {
      background: styles.getPropertyValue('--background')?.trim(),
      border: styles.getPropertyValue('--border')?.trim(),
      main: styles.getPropertyValue('--main')?.trim(),
    };
  });

  console.log('ADMIN_NEOBRUTAL_PRESENT:', exists);
  console.log('NEOBRUTAL_VARS:', JSON.stringify(rootVar, null, 2));

  // Also check a sample element (sidebar) for computed background color
  const sidebarBg = await page.evaluate(() => {
    const sidebar = document.querySelector('.admin-neobrutal aside');
    if (!sidebar) return null;
    const c = getComputedStyle(sidebar as Element).backgroundColor;
    return c;
  });

  console.log('SIDEBAR_BG:', sidebarBg);

  expect(exists).toBeTruthy();
});
