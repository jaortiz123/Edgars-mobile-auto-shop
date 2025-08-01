import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  globalSetup: require.resolve('./e2e/global-setup'),
  
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
