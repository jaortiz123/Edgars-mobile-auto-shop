// vitest.projects.ts
import { defineProject } from 'vitest/config';
import path from 'path';

export default [
  defineProject({
    test: {
      name: 'unit',
      environment: 'jsdom',
      setupFiles: ['./src/tests/setup.ts'],
      include: [
        'tests/hooks/**/*.{test,spec}.{ts,tsx}',
        'src/tests/analytics/**/*.{test,spec}.{ts,tsx}',
      ],
      exclude: [
        'src/tests/archived/**',
        'src/tests/triage/**',
        'e2e/**',
        'dist/**',
        'node_modules/**'
      ]
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
