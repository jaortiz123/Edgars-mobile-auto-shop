/**
 * Vitest Configuration for Sprint 7
 * Enhanced test environment configuration for React components and services
 */
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  test: {
    // Use jsdom for all tests
    environment: 'jsdom',
    setupFiles: ['src/tests/setup.ts'],
    
    // Global configuration
    globals: true,
    css: true,
    restoreMocks: true,
    clearMocks: true,
    mockReset: true,
    
    // Timeout configuration
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    
    // File patterns
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'src/tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'src/**/*.it.{ts,tsx}', // Integration tests
      'src/tests/**/*.it.{ts,tsx}' // Integration tests in tests folder
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/e2e/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/build/**'
    ],
    
    // Pool configuration for better performance
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4,
      }
    },
    
    // Reporter configuration
    reporters: ['verbose', 'junit'],
    outputFile: {
      junit: 'test-results/junit.xml'
    },
    
    // Watch mode configuration
    watch: false,
    
    // Dependency optimization
    deps: {
      inline: [
        // Inline dependencies that might cause issues
        '@testing-library/react',
        '@testing-library/jest-dom',
        'jest-axe'
      ]
    }
  },
  
  coverage: {
    provider: 'v8',
    reportsDirectory: 'coverage',
    reporter: ['text', 'lcov', 'html', 'json', 'json-summary'],
    
    include: [
      'src/**/*.{ts,tsx}',
      '!src/**/*.d.ts',
      '!src/tests/**',
      '!src/**/*.test.{ts,tsx}',
      '!src/**/*.spec.{ts,tsx}',
      '!src/vite-env.d.ts',
      '!src/main.tsx'
    ],
    
    exclude: [
      'src/tests/**',
      'src/**/*.test.{ts,tsx}',
      'src/**/*.spec.{ts,tsx}',
      'src/**/*.d.ts',
      'src/main.tsx',
      'src/vite-env.d.ts',
      'src/**/__mocks__/**',
      'src/**/types.ts'
    ],
    
    // Unified global coverage thresholds
    thresholds: {
      global: {
        statements: 10,   // Achievable baseline
        branches: 10,    // Comfortable margin
        functions: 10,   // Achievable target
        lines: 10,        // Achievable baseline
      },
    },
    
    // Skip coverage for certain patterns
    skipFull: false,
    all: true,
    clean: true,
    cleanOnRerun: true,
  },
  
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
