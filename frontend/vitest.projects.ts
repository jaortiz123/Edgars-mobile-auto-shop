import { defineProject } from 'vitest/config';
import path from 'path';

export default [
  // ✅ Core unit tests (default)
  defineProject({
    test: {
      name: 'unit',
      include: [
        'src/components/**/*.{test,spec,unit}.{ts,tsx}',
        'src/hooks/**/*.{test,spec,unit}.{ts,tsx}',
        'src/utils/**/*.{test,spec,unit}.{ts,tsx}',
        'src/lib/**/*.{test,spec,unit}.{ts,tsx}',
        'src/store/**/*.{test,spec,unit}.{ts,tsx}',
        'src/pages/**/*.{test,spec,unit}.{ts,tsx}',
      ],
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
    },
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
  }),

  // 🚨 Triage tests (run on demand)
  defineProject({
    test: {
      name: 'triage',
      include: ['src/tests/triage/**/*.{test,spec}.{ts,tsx}'],
      environment: 'jsdom',
      setupFiles: ['src/tests/setup.ts'],
    },
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
  }),

  // 📦 Archived tests (run on demand)
  defineProject({
    test: {
      name: 'archived',
      include: ['src/tests/archived/**/*.{test,spec}.{ts,tsx}'],
      environment: 'jsdom',
      setupFiles: ['src/tests/setup.ts'],
    },
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
  }),
];
