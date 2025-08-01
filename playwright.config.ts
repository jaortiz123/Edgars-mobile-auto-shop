import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  globalSetup: require.resolve('./e2e/global-setup'),
  reporter: [
    ['html', { outputFolder: 'e2e-report' }],
    ['monocart-reporter', {
      name: "My Test Report",
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
  use: { trace: 'on-first-retry', screenshot: 'only-on-failure' },
  webServer: {
    command: 'npm run dev --prefix frontend',
    port: 5173,
    reuseExistingServer: true,
  },
});
