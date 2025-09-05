import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      // Enhanced path aliases for comprehensive resolution
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
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        // Force Docker networking in CI/container environment, localhost for local dev
        target: process.env.CI === 'true' || process.env.DOCKER_ENV === 'true' ? 'http://backend:3001' : (process.env.VITE_API_URL || 'http://localhost:3001'),
        changeOrigin: true,
        secure: false,
        ws: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('[VITE PROXY ERROR]', err.message, _req.url);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('[VITE PROXY REQUEST]', req.method, req.url, '-> backend:3001');
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('[VITE PROXY RESPONSE]', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
  test: {
    // Enhanced test environment configuration
    environment: 'jsdom',
    setupFiles: ['src/tests/setup.ts'],
    globals: true,
    css: true,
    restoreMocks: true,
    clearMocks: true,
    mockReset: true,

    // Enhanced test execution configuration
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,

    // Better file inclusion patterns
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'src/tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/e2e/**'
    ],

    // Enhanced coverage configuration
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'lcov', 'html', 'json'],
      include: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/tests/**',
        '!src/**/*.test.{ts,tsx}',
        '!src/**/*.spec.{ts,tsx}',
        '!src/vite-env.d.ts'
      ],
      exclude: [
        'src/tests/**',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts'
      ],
      // Adjusted coverage thresholds for realistic targets
      thresholds: {
        global: {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80,
        },
        // Specific thresholds for critical areas
        'src/utils/**': {
          statements: 95,
          branches: 90,
          functions: 95,
          lines: 95,
        },
        'src/services/**': {
          statements: 85,
          branches: 80,
          functions: 85,
          lines: 85,
        }
      }
    },
  },
})
