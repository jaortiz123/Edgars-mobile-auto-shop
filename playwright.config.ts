import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  webServer: {
    command: 'npm run dev --prefix mobile-auto-shop/frontend',
    port: 5173,
    reuseExistingServer: true,
  },
});
