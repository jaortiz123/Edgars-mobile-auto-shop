import { describe, test, expect } from 'vitest';

describe('CI-STRICT-001 Live Test', () => {
  test('should pass normally', () => {
    console.log('This is a normal log message - should work fine');
    expect(true).toBe(true);
  });

  test.skip('SKIP - would fail with console.error', () => {
    // This test is skipped but shows what would happen
    console.error('This would cause the test to fail');
    expect(true).toBe(true);
  });

  test.skip('SKIP - would fail with console.warn', () => {
    // This test is skipped but shows what would happen
    console.warn('This would cause the test to fail');
    expect(true).toBe(true);
  });
});
