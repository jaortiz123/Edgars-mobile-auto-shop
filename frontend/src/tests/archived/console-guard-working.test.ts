/**
 * Test console guard functionality
 */
import { describe, test, expect } from 'vitest';
import { withConsoleErrorSpy } from './setup';

describe('Console Guard Tests', () => {
  test('should allow whitelisted console messages', () => {
    // This should pass because it matches our allowlist pattern
    console.error('🔧 DIRECT MOCK: This should be allowed');
    expect(true).toBe(true);
  });

  test('should use withConsoleErrorSpy for expected errors', async () => {
    const result = await withConsoleErrorSpy(async () => {
      // These would normally fail the test but should be captured by the spy
      console.error('This is an expected error in negative path testing');
      console.warn('This is an expected warning in negative path testing');
      return 'success';
    });
    
    expect(result).toBe('success');
  });
});
