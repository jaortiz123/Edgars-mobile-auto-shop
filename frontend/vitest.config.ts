import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

const MIN = Number(process.env.COVERAGE_MIN ?? 50);

export default defineConfig({
  plugins: [react()],
  define: {
    'globalThis.IS_REACT_ACT_ENVIRONMENT': 'true',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/contexts': path.resolve(__dirname, './src/contexts'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/tests': path.resolve(__dirname, './src/tests'),
      '@/pages': path.resolve(__dirname, './src/pages'),
      '@/containers': path.resolve(__dirname, './src/containers'),
      '@test-utils': path.resolve(__dirname, './src/tests/test-utils.tsx'),
    },
  },
  test: {
    include: ['src/**/*.{test,spec,it}.{ts,tsx}'],
    exclude: [
      'e2e/**',
      'node_modules/**',
      'dist/**',
      'src/**/__mocks__/**',
      'src/**/types/**',
      'src/**/fixtures/**',
      'src/**/*.d.ts',
      'src/**/index.ts',
      'src/main.tsx',
    ],
    environment: 'jsdom',
    setupFiles: ['src/tests/setup.ts'],
    css: true,
    alias: {
      '@test-utils': '/src/tests/test-utils.tsx',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'e2e/**',
        'src/**/__mocks__/**',
        'src/**/types/**',
        'src/**/fixtures/**',
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/main.tsx',
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
