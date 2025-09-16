import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/*.e2e.{ts,tsx}'],
  testIgnore: ['**/*.test.*', 'src/**', '**/__tests__/**'],
  retries: 1,
  reporter: [['list'], ['junit', { outputFile: 'test-results/e2e-junit.xml' }]],
  use: {
    baseURL: process.env.API_BASE_URL || 'http://localhost:58000',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
