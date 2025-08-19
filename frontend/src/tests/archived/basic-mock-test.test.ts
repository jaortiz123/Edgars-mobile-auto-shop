/**
 * Simple test to validate the new dependency injection pattern works
 */

import { describe, it, expect } from 'vitest';
import createTestMocks from './mocks/index';

describe('P1-T-002: Basic Mock Factory Test', () => {
  it('should create mocks without circular dependencies', () => {
    const mocks = createTestMocks();

    expect(mocks).toBeDefined();
    expect(mocks.time).toBeDefined();
    expect(mocks.api).toBeDefined();
    expect(mocks.notification).toBeDefined();
  });

  it('should provide working time calculations', () => {
    const { time } = createTestMocks();

    time.setCurrentTime('2024-01-15T10:00:00Z');
    const result = time.getMinutesUntil('2024-01-15T10:30:00Z');
    expect(result).toBe(30);
  });
});
