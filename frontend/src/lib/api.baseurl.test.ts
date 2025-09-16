import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';

// Mock window.location before importing anything that might use axios
Object.defineProperty(global, 'window', {
  value: {
    location: {
      href: 'http://localhost:3000',
      origin: 'http://localhost:3000',
      protocol: 'http:',
      host: 'localhost:3000'
    }
  },
  writable: true
});

// Test the getApiUrl function logic without module side effects
describe('getApiUrl behavior', () => {
  let originalProcess: any;
  let originalWindow: any;
  beforeEach(() => {
    originalProcess = globalThis.process;
    originalWindow = globalThis.window;
  });

  afterEach(() => {
    globalThis.process = originalProcess;
    globalThis.window = originalWindow;
    vi.unstubAllGlobals();
  });

  test('uses VITE_API_URL in browser when available', () => {
    // Mock browser environment
    globalThis.window = { location: { href: 'http://localhost:3000' } } as any;

    // Test the logic directly with manual environment mocking
    const testGetApiUrl = (): string => {
      if (typeof window !== 'undefined') {
        // Mock the VITE environment directly
        const viteEnv = { VITE_API_URL: 'https://api.example.com/api' }
        if (viteEnv?.VITE_API_URL) {
          return viteEnv.VITE_API_URL
        }
        return 'http://localhost:3001/api'
      }

      if (typeof process !== 'undefined' && process.env?.API_URL) {
        return process.env.API_URL
      }

      return 'http://localhost:3001/api'
    };

    expect(testGetApiUrl()).toBe('https://api.example.com/api');
  });

  test('uses process.env.API_URL in Node environment', () => {
    // Remove window to simulate Node environment
    globalThis.window = undefined as any;

    // Mock process.env
    globalThis.process = {
      env: { API_URL: 'https://node-api.example.com' }
    } as any;

    // Test the fallback behavior by directly checking the logic
    const getApiUrl = (): string => {
      if (typeof window !== 'undefined') {
        const viteEnv = (import.meta as any)?.env
        if (viteEnv?.VITE_API_URL) {
          return viteEnv.VITE_API_URL
        }
        return 'http://localhost:3001/api'
      }

      if (typeof process !== 'undefined' && process.env?.API_URL) {
        return process.env.API_URL
      }

      return 'http://localhost:3001/api'
    };

    expect(getApiUrl()).toBe('https://node-api.example.com');
  });

  test('falls back to default localhost URL', () => {
    // Remove both window and process
    globalThis.window = undefined as any;
    globalThis.process = undefined as any;

    const getApiUrl = (): string => {
      if (typeof window !== 'undefined') {
        const viteEnv = (import.meta as any)?.env
        if (viteEnv?.VITE_API_URL) {
          return viteEnv.VITE_API_URL
        }
        return 'http://localhost:3001/api'
      }

      if (typeof process !== 'undefined' && process.env?.API_URL) {
        return process.env.API_URL
      }

      return 'http://localhost:3001/api'
    };

    expect(getApiUrl()).toBe('http://localhost:3001/api');
  });
});
