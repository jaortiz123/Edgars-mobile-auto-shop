import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  
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
    // ✅ SET THE ENVIRONMENT TO JSDOM FOR ALL TESTS.
    environment: 'jsdom',
    // Increase global timeouts for slower integration-like tests; unit tests unaffected
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // ✅ P1-T-013: Environment-specific test execution (using deprecated but working approach)
    environmentMatchGlobs: [
      ['**/*.utils.test.ts', 'node'],
      ['**/*.components.test.tsx', 'jsdom']
    ],
    
    // ✅ Point to a single, reliable setup file.
    setupFiles: ['src/tests/setup.ts'],
    
    // ✅ Globals are needed for libraries like testing-library
    globals: true,
    
    // ✅ Include .it. files for integration tests
    include: ['**/*.{test,spec,it}.?(c|m)[jt]s?(x)'],
    
    // P2-T-009: Retry configuration for flaky test detection
    retry: 2, // Retry flaky tests up to 2 times
    
    // 🔧 Worker management to prevent runaway processes
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1,
        useAtomics: true
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
      // Exclude heavy integration test suites from the default unit run
      '**/src/tests/integration/**',
      '**/src/tests/**.it.*'
    ],
    
    // 🎯 Coverage thresholds to prevent regression
    coverage: {
      reporter: ['text', 'lcov', 'json', 'json-summary'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80
      }
    },
    
    // Optional: Keep CSS processing if your components import CSS files
    css: true,
  },
});
