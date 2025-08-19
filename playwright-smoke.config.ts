import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  testMatch: 'smoke-frontend-only.spec.ts',

  // Cross-browser projects for P2-T-005
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  reporter: [
    ['html', { outputFolder: 'e2e-report-smoke' }],
    ['list'],
  ],

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Set reasonable timeouts for CI
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  // Global test timeout
  timeout: 30000,

  webServer: {
    command: 'bash -lc "export SKIP_KILL_5173=1; npm run dev --prefix frontend"',
    port: 5173,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
