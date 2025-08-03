import { describe, it, expect } from 'vitest';

describe('Simple Act Warning Test', () => {
  it('should run basic test', () => {
    expect(true).toBe(true);
  });

  it('should verify console.error override works', () => {
    // This should throw because console.error is overridden
    expect(() => {
      console.error('Test error message');
    }).toThrow('console.error: Test error message');
  });

  it('should verify console.warn override works', () => {
    // This should throw because console.warn is overridden
    expect(() => {
      console.warn('Test warning message');
    }).toThrow('console.warn: Test warning message');
  });

  it('console.log should work normally (not overridden)', () => {
    // console.log should work fine - not overridden
    console.log('This is a normal log message and should work');
    expect(true).toBe(true);
  });
});
