// JS mirror of TS config to ensure Playwright loads projects without requiring ts-node.
const { defineConfig, devices } = require('@playwright/test');
module.exports = defineConfig({
  testDir: 'e2e',
  globalSetup: require.resolve('./e2e/global-setup'),
  retries: process.env.CI ? 1 : 0,
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['iPhone 12'], viewport: { width: 375, height: 812 } } }
  ],
  reporter: [ ['list'], ['html', { outputFolder: 'e2e-report' }] ],
  use: { trace: 'on-first-retry', screenshot: 'only-on-failure', actionTimeout: 15000, navigationTimeout: 30000, storageState: 'e2e/storageState.json' },
  timeout: 30000,
  webServer: {
    command: 'bash -lc "export SKIP_KILL_5173=1; npm run dev --prefix frontend"',
    port: 5173,
    reuseExistingServer: true,
    timeout: 120000
  }
});
