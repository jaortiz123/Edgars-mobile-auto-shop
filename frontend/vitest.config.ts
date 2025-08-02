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
      // Enhanced path aliases for comprehensive resolution (mirror vite.config.ts)
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
    // Use jsdom for all tests
    environment: 'jsdom',
    setupFiles: ['src/tests/setup-minimal.ts'], // Using minimal setup to isolate hang issue
    
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
    
    // Pool configuration - use forks instead of threads to prevent resource leaks
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
        minForks: 1,
        maxForks: 2, // Reduced from 4 to minimize resource contention
      }
    },
    
    // Reporter configuration (updated for v3 compatibility)
    reporters: [['default', { summary: false }], 'junit'],
    outputFile: {
      junit: 'test-results/junit.xml'
    },
    
    // Watch mode configuration
    watch: false,
    
    // Dependency optimization (updated syntax)
    deps: {
      optimizer: {
        web: {
          include: [
            // Inline dependencies that might cause issues
            '@testing-library/react',
            '@testing-library/jest-dom',
            'jest-axe'
          ]
        }
      }
    },

    // Coverage configuration moved inside test block
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
  },
})
