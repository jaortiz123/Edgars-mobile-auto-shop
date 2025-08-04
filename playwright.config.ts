import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  globalSetup: require.resolve('./e2e/global-setup'),
  
  // Cross-browser projects for P2-T-005 and mobile viewport for P2-T-008
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
    {
      name: 'mobile-chrome',
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 375, height: 812 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
      },
    },
  ],
  
  reporter: [
    ['html', { outputFolder: 'e2e-report' }],
    ['monocart-reporter', {
      name: "Cross-Browser Test Report",
      outputFile: './test-results/report.html',
      coverage: {
        entryFilter: (entry) => {
          // Exclude files from node_modules
          if (entry.url.includes('node_modules')) {
            return false;
          }
          return true;
        },
        sourceFilter: (sourcePath) => {
          return sourcePath.startsWith('frontend/src/');
        }
      }
    }]
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
    command: 'npm run dev --prefix frontend',
    port: 5173,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
