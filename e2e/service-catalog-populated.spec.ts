import { test, expect } from '@playwright/test';
import { stubCustomerProfile } from './utils/stubAuthProfile';

// Smoke guard: ensures service catalog seed present (prevents silent empty modal regressions)
test.describe('Service Catalog Data Presence', () => {
  test('catalog API returns active services (seed present)', async ({ page }) => {
    await stubCustomerProfile(page);
    // Navigate to root to ensure same-origin for fetch & storage state established
    await page.goto('/');
    const len = await page.evaluate(async () => {
      const resp = await fetch('/api/admin/service-operations');
      if (!resp.ok) throw new Error('Bad status ' + resp.status);
      const data = await resp.json();
      if (Array.isArray(data)) return data.length; // new flat shape
      if (Array.isArray(data.service_operations)) return data.service_operations.length; // legacy fallback
      return -1;
    });
    expect(len).toBeGreaterThan(0);
  });
});
