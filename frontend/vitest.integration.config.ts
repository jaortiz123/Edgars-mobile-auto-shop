import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Standalone integration test config (does not exclude integration dir)
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/tests': path.resolve(__dirname, './src/tests'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/utils': path.resolve(__dirname, './src/utils'),
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/tests/preActEnv.ts','src/tests/jest.setup.ts'],
    include: ['src/tests/integration/**/*.it.[jt]s?(x)','src/tests/integration/**/*.{test,spec}.[jt]s?(x)'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/archived/**',
      '**/src/tests/archived/**',
      '**/src/tests/triage-removed/**'
    ],
    testTimeout: 15000,
    hookTimeout: 15000,
    retry: 0,
  }
});
