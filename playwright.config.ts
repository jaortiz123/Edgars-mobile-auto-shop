import { defineConfig, devices } from '@playwright/test';

// Build reporters so we can disable interactive servers in non-interactive runs
const reporters: any[] = [
  ['list'],
  ['html', { outputFolder: 'e2e-report', open: 'never' }],
];
// Only enable Monocart HTML preview when explicitly requested
if (process.env.PW_MONOCART === '1') {
  reporters.push([
    'monocart-reporter',
    {
      name: 'Cross-Browser Test Report',
      outputFile: './test-results/report.html',
      // Ensure reporter does not start a local server unless requested
      open: false,
      show: false,
    },
  ]);
}

export default defineConfig({
  testDir: 'e2e',
  globalSetup: require.resolve('./e2e/global-setup'),

  // P2-T-009: Retry configuration for flaky test detection
  retries: process.env.CI ? 1 : 0, // Retry once in CI, no retries locally

  // Global timeout for the entire test run (4 minutes) to prevent hangs
  globalTimeout: 240000,

  // Optimized for speed: single browser project
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Commented out other browsers for faster CI
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
    // {
    //   name: 'mobile-chrome',
    //   use: {
    //     ...devices['iPhone 12'],
    //     viewport: { width: 375, height: 812 },
    //     userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    //   },
    // },
  ],

  reporter: reporters,

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Set reasonable timeouts for CI
    actionTimeout: 15000,
    navigationTimeout: 30000,
    // Always send tenant context so backend resolves g.tenant_id
    extraHTTPHeaders: {
      'X-Tenant-Id': process.env.E2E_TENANT_ID || '00000000-0000-0000-0000-000000000001',
    },
    storageState: 'e2e/storageState.json'
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
