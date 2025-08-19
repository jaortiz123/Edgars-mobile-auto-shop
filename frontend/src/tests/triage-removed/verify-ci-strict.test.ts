import { describe, test, expect } from 'vitest';

describe('CI-STRICT-001 Verification', () => {
  test('console.log should work normally', () => {
    // This should work fine - console.log is not overridden
    console.log('Normal log message - this should work');
    expect(true).toBe(true);
  });

  test('verify console.error is overridden', () => {
    // This should throw an error because console.error is overridden in setup.ts
    expect(() => {
      console.error('Test error message');
    }).toThrow('console.error: Test error message');
  });

  test('verify console.warn is overridden', () => {
    // This should throw an error because console.warn is overridden in setup.ts
    expect(() => {
      console.warn('Test warning message');
    }).toThrow('console.warn: Test warning message');
  });

  test('should handle circular objects safely', () => {
    const circular: Record<string, unknown> = { name: 'test' };
    circular.self = circular;

    expect(() => {
      console.error('Circular:', circular);
    }).toThrow(/console\.error:/);
  });

  test('should handle null and undefined', () => {
    expect(() => {
      console.error(null, undefined);
    }).toThrow('console.error: null undefined');
  });

  test('should handle no arguments', () => {
    expect(() => {
      console.error();
    }).toThrow('console.error: ');
  });
});
