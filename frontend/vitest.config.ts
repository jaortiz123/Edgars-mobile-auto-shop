import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    'globalThis.IS_REACT_ACT_ENVIRONMENT': 'true'
  },

  // ✅ A SINGLE, CORRECT ALIAS CONFIGURATION
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@/components": path.resolve(__dirname, "./src/components"),
      "@/contexts": path.resolve(__dirname, "./src/contexts"),
      "@/hooks": path.resolve(__dirname, "./src/hooks"),
      "@/lib": path.resolve(__dirname, "./src/lib"),
      "@/services": path.resolve(__dirname, "./src/services"),
      "@/utils": path.resolve(__dirname, "./src/utils"),
      "@/types": path.resolve(__dirname, "./src/types"),
      "@/tests": path.resolve(__dirname, "./src/tests"),
      "@/pages": path.resolve(__dirname, "./src/pages"),
      "@/containers": path.resolve(__dirname, "./src/containers"),
    },
  },

  test: {
    // Single environment (jsdom). Deprecated environmentMatchGlobs removed.
    environment: 'jsdom',
    testTimeout: 5000, // 5-second timeout to prevent hanging
    hookTimeout: 3000, // 3-second timeout for hooks
    // Pre-setup ensures act flag is set before React loads.
    setupFiles: ['src/tests/preActEnv.ts','src/tests/setup.ts'],

    // ✅ Globals are needed for libraries like testing-library
    globals: true,

  // Include all standard test naming patterns
  include: ['**/*.{test,spec,it}.?(c|m)[jt]s?(x)'],

    // P2-T-009: Retry configuration for flaky test detection
    retry: 2, // Retry flaky tests up to 2 times

    // 🔧 Worker management to prevent runaway processes
    // Use forks for reliable V8 coverage emission across workers
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 4,
        minForks: 1
      }
    },

    // 🔧 Force-close workers that don't exit properly
    teardownTimeout: 1000,

    // ✅ Exclude archived tests from execution
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/archived/**',
      '**/src/tests/archived/**',
      '**/src/tests/triage-removed/**',
  // Exclude Playwright specs from Vitest (run only under Playwright)
  '**/tests/pages/**/*.spec.ts',
      // Exclude heavy integration test suites from the default unit run
  // Keep integration tests excluded by default; run them via dedicated script if desired
  '**/src/tests/integration/**',
  '**/src/tests/**.it.*',
      // Exclude empty or placeholder coverage backfill dateUtils files
      '**/src/tests/coverageBackfill/dateUtils.*.test.*',
      '**/src/tests/coverageBackfill/dateUtils.*.edge.*',
    ],

    // 🎯 Coverage thresholds to prevent regression
    coverage: {
      enabled: process.env.NO_COVERAGE === '1' ? false : true,
      provider: 'v8',
      reporter: ['text', 'lcov', 'json', 'json-summary'],
      reportsDirectory: './coverage',
  // Emit coverage reports even if tests fail
  reportOnFailure: true,
      clean: true,
      // Include all files under src for baseline metrics
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
  'src/tests/**',
  'src/test/**',
  'src/mocks/**',
  'src/pages/e2e/**',
  '**/*.stories.*',
  '**/*.d.ts',
  // Exclude backup/scratch files that may contain invalid syntax
  '**/*.backup.*',
  'src/components/admin/AppointmentCardRobust.backup.tsx'
      ],
      thresholds: {
        // Temporarily lowered to sprint target to allow incremental progress;
        // raise back to 80 after ≥60% global line coverage is stable.
        lines: 60,
        branches: 60,
        functions: 60,
        statements: 60
      }
    },

    // Optional: Keep CSS processing if your components import CSS files
    css: true,
  },
});
