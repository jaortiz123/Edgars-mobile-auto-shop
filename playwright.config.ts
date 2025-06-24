import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  globalSetup: require.resolve('./e2e/global-setup'),
  reporter: [['html', { outputFolder: 'e2e-report' }]],
  use: { trace: 'on-first-retry', screenshot: 'only-on-failure' },
  webServer: {
    command: 'npm run dev --prefix mobile-auto-shop/frontend',
    port: 5173,
    reuseExistingServer: true,
  },
});
