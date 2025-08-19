/**
 * Test suite to verify CI-STRICT-001 console guard functionality
 * Tests allowlist system and withConsoleErrorSpy helper
 */
import { describe, it, expect } from 'vitest';
import { withConsoleErrorSpy } from './setup';

describe('CI-STRICT-001 Console Guard', () => {
  it('should allow whitelisted console errors without failing', async () => {
    // This should not fail the test because it matches our allowlist
    console.error('🔧 DIRECT MOCK: Test message');
    expect(true).toBe(true);
  });

  it('should allow withConsoleErrorSpy to temporarily disable strict checking', async () => {
    const result = await withConsoleErrorSpy(async () => {
      // This error would normally fail the test, but should be allowed in the spy context
      console.error('Unexpected test error that would normally fail');
      return 'test-result';
    });

    expect(result).toBe('test-result');
  });

  it('should handle nested async operations in withConsoleErrorSpy', async () => {
    const result = await withConsoleErrorSpy(async () => {
      // Simulate async operation that logs errors
      await new Promise(resolve => setTimeout(resolve, 10));
      console.error('Async error that should be captured');
      console.warn('Async warning that should be captured');
      return 'async-result';
    });

    expect(result).toBe('async-result');
  });
});
