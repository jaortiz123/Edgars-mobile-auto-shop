import { defineConfig } from 'vitest/config';
import path from 'path';

const MIN = Number(process.env.COVERAGE_MIN ?? 50);

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/contexts': path.resolve(__dirname, './src/contexts'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/pages': path.resolve(__dirname, './src/pages'),
      '@test-utils': path.resolve(__dirname, './src/tests/test-utils.tsx'),
    },
  },
  test: {
    // ✅ Only run core unit suites
    include: [
      'src/components/**/*.{test,spec,unit}.{ts,tsx}',
      'src/hooks/**/*.{test,spec,unit}.{ts,tsx}',
      'src/utils/**/*.{test,spec,unit}.{ts,tsx}',
      'src/lib/**/*.{test,spec,unit}.{ts,tsx}',
      'src/store/**/*.{test,spec,unit}.{ts,tsx}',
      'src/pages/**/*.{test,spec,unit}.{ts,tsx}',
    ],
    // 🚫 Keep noisy/legacy/archived out of unit pass
    exclude: [
      'e2e/**',
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'src/tests/integration/**',
      'src/tests/triage/**',
      'src/tests/archived/**',
      'src/tests/coverageBackfill/**',
      'src/tests/branch-coverage/**',
      'src/**/__mocks__/**',
      'src/**/__fixtures__/**',
      'src/**/stories/**',
      'src/**/*.d.ts',
      'src/**/index.ts',
      'src/main.tsx',
    ],
    environment: 'jsdom',
    setupFiles: ['src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      all: true,
      reporter: ['text', 'lcov'],
      include: [
        'src/components/**/*.{ts,tsx}',
        'src/hooks/**/*.{ts,tsx}',
        'src/utils/**/*.{ts,tsx}',
        'src/lib/**/*.{ts,tsx}',
        'src/store/**/*.{ts,tsx}',
        'src/pages/**/*.{ts,tsx}',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/**/__mocks__/**',
        'src/**/__fixtures__/**',
        'src/**/stories/**',
        'src/main.tsx',
        'src/**/index.ts',
      ],
      thresholds: {
        lines: MIN,
        statements: MIN,
        functions: MIN,
        branches: Math.max(0, MIN - 10),
      },
    },
  },
});
