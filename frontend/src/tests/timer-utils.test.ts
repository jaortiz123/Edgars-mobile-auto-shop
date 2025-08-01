/**
 * Test timer utility functions
 */
import { describe, test, expect } from 'vitest';
import { flushPromises } from './setup';

describe('Timer Utilities', () => {
  test('should handle flushPromises correctly', async () => {
    let resolved = false;
    Promise.resolve().then(() => { resolved = true; });
    
    await flushPromises();
    expect(resolved).toBe(true);
  });

  test('should export timer utilities correctly', () => {
    // Test that our timer utilities are properly exported
    expect(typeof flushPromises).toBe('function');
  });
});
