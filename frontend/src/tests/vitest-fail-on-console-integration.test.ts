/**
 * Test suite to verify vitest-fail-on-console integration
 * This tests our enhanced CI console detection system
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Import our helper from the new setup
import { withConsoleErrorSpy } from './setup';

describe('Enhanced CI Console Detection with vitest-fail-on-console', () => {
  describe('Allowlist System', () => {
    it('should allow whitelisted console errors without failing', () => {
      // This should not fail the test because it matches our allowlist
      // In our current system, allowed messages don't throw
      console.error('🔧 DIRECT MOCK: Test message');
      expect(true).toBe(true); // Test passes if we get here without throwing
    });

    it('should allow MSW-related warnings', () => {
      console.warn('[MSW] Found a redundant usage of query');
      expect(true).toBe(true);
    });

    it('should allow AppointmentContext errors', () => {
      console.error('AppointmentContext: Error in refreshBoard - network timeout');
      expect(true).toBe(true);
    });
  });

  describe('Console Error Detection', () => {
    it('should fail tests with unexpected console.error after completion', () => {
      // Note: Current CI-STRICT-001 fails AFTER the test via afterEach
      // So this test will appear to pass but the overall test suite will fail
      console.error('This is an unexpected error that should fail the test');
      expect(true).toBe(true); // This will pass, but afterEach will fail
    });

    it('should fail tests with unexpected console.warn after completion', () => {
      console.warn('This is an unexpected warning that should fail the test');
      expect(true).toBe(true); // This will pass, but afterEach will fail
    });

    it('should allow console.log normally', () => {
      console.log('This should work fine');
      expect(true).toBe(true);
    });
  });

  describe('withConsoleErrorSpy Helper', () => {
    it('should allow expected errors when using withConsoleErrorSpy', async () => {
      const result = await withConsoleErrorSpy(async () => {
        // These would normally fail the test but should be captured by the spy
        console.error('Expected error in negative path testing');
        console.warn('Expected warning in negative path testing');
        return 'test-success';
      });

      expect(result).toBe('test-success');
    });

    it('should handle async operations in withConsoleErrorSpy', async () => {
      const result = await withConsoleErrorSpy(async () => {
        // Simulate async error
        await new Promise(resolve => setTimeout(resolve, 10));
        console.error('Async error that should be handled');
        return 'async-success';
      });

      expect(result).toBe('async-success');
    });
  });

  describe('Circular Reference Handling', () => {
    it('should handle circular objects safely in allowlist checking', () => {
      const circular: Record<string, unknown> = { name: 'test' };
      circular.self = circular;

      // Our system should be able to process this without crashing during allowlist checking
      console.error('🔧 DIRECT MOCK: Circular object test', circular);
      expect(true).toBe(true); // Should pass since it's on allowlist
    });
  });

  describe('Complex Arguments', () => {
    it('should handle multiple arguments of different types safely', () => {
      // Use allowlist pattern to test argument processing
      console.error('🔧 DIRECT MOCK: Multiple', 123, true, { key: 'value' }, null, undefined);
      expect(true).toBe(true); // Should pass since it's on allowlist
    });
  });
});
