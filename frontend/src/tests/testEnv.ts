/**
 * Sprint 7 Test Environment Configuration
 * Additional test environment setup for enhanced testing capabilities
 */
import { vi } from 'vitest'

// Environment variables for testing
globalThis.process = globalThis.process || {};
globalThis.process.env = globalThis.process.env || {};

// Set default environment variables for tests
globalThis.process.env.NODE_ENV = 'test';
globalThis.process.env.VITE_API_BASE_URL = 'http://localhost:3001';
globalThis.process.env.VITE_API_ENDPOINT_URL = 'http://localhost:3001';
globalThis.process.env.VITE_APP_ENV = 'test';

// Export for potential use in other test files
export const testEnv = {
  NODE_ENV: 'test',
  API_BASE_URL: 'http://localhost:3001',
  APP_ENV: 'test'
};

// Console configuration for cleaner test output and act() warning detection
const originalError = console.error;
const originalWarn = console.warn;
let consoleErrors: string[] = [];
let actWarnings: string[] = [];

export function setupCleanConsole() {
  consoleErrors = [];
  actWarnings = [];
  
  console.error = (...args) => {
    const message = String(args[0] || '');
    
    // Detect React act() warnings and fail tests
    if ((message.includes('state update') && message.includes('act(')) || 
        message.includes('not wrapped in act(') ||
        message.includes('Warning: An update to') && message.includes('act(')) {
      actWarnings.push(message);
      if (process.env.CI || process.env.VITEST_STRICT_CONSOLE) {
        throw new Error(`React act() warning detected: ${message}`);
      }
    }
    
    // Filter out known test noise (but still track them)
    if (
      message.includes('Warning: ReactDOM.render') ||
      message.includes('Warning: componentWillMount') ||
      message.includes('Warning: componentWillReceiveProps') ||
      message.includes('findDOMNode is deprecated') ||
      message.includes('React.createFactory() is deprecated')
    ) {
      return;
    }
    
    // Track all console errors for potential test failures
    consoleErrors.push(message);
    originalError(...args);
  };
  
  console.warn = (...args) => {
    const message = String(args[0] || '');
    
    // Filter out known warnings
    if (
      message.includes('componentWillMount') ||
      message.includes('componentWillUpdate') ||
      message.includes('ReactDOM.render')
    ) {
      return;
    }
    
    originalWarn(...args);
  };
}

export function restoreConsole() {
  console.error = originalError;
  console.warn = originalWarn;
}

// Helper functions for act() warning detection
export function getConsoleErrors() {
  return [...consoleErrors];
}

export function getActWarnings() {
  return [...actWarnings];
}

export function clearConsoleErrors() {
  consoleErrors = [];
  actWarnings = [];
}

export function hasActWarnings() {
  return actWarnings.length > 0;
}

// Test utilities for Sprint 7 enhanced testing
export const testUtils = {
  // Wait for async operations
  waitForAsync: (ms = 0) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Mock timer utilities
  mockTimers: () => {
    vi.useFakeTimers();
    return {
      runAllTimers: () => vi.runAllTimers(),
      advanceTimersBy: (ms: number) => vi.advanceTimersByTime(ms),
      restore: () => vi.useRealTimers(),
    };
  },
  
  // Performance testing helpers
  measurePerformance: async (fn: () => Promise<void> | void) => {
    const start = performance.now();
    await fn();
    return performance.now() - start;
  },
  
  // Memory leak detection helpers
  checkMemoryLeaks: () => {
    if ('gc' in global && typeof global.gc === 'function') {
      global.gc();
    }
    
    return {
      heapUsed: process.memoryUsage?.()?.heapUsed || 0,
      external: process.memoryUsage?.()?.external || 0
    };
  }
};

export default testUtils;
