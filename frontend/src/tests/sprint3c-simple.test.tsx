/**
 * Sprint 3C: Time Utilities - Enhanced with Redesigned Mock Factory
 * Refactored to use createTestMocks() dependency injection pattern
 */

import { describe, test, expect, beforeEach } from 'vitest';
import createTestMocks from './mocks/index';

describe('Sprint 3C: Time Utilities - Enhanced with Redesigned Mock Factory', () => {
  let mocks: ReturnType<typeof createTestMocks>;

  beforeEach(() => {
    // Create fresh mocks for each test
    mocks = createTestMocks();
    
    // Set a fixed current time for deterministic testing
    const fixedTime = new Date('2024-01-15T10:00:00Z');
    mocks.time.setCurrentTime(fixedTime);
  });

  test('can use dependency injection time utilities', () => {
    expect(mocks.time).toBeDefined();
    expect(mocks.time.getMinutesUntil).toBeDefined();
    expect(mocks.time.isStartingSoon).toBeDefined();
    expect(mocks.time.isRunningLate).toBeDefined();
    expect(mocks.time.isOverdue).toBeDefined();
    
    console.log('Dependency injection time utils available:', Object.keys(mocks.time));
  });

  test('appointment timing calculations with dependency injection', () => {
    // Set appointments at specific times relative to our fixed current time (10:00 AM)
    const startingSoonTime = new Date('2024-01-15T10:10:00Z'); // 10 minutes from now
    const lateTime = new Date('2024-01-15T09:45:00Z'); // 15 minutes ago  
    const overdueTime = new Date('2024-01-15T09:25:00Z'); // 35 minutes ago

    // Test using dependency injection time calculations
    const minutesUntilStarting = mocks.time.getMinutesUntil(startingSoonTime);
    const minutesUntilLate = mocks.time.getMinutesUntil(lateTime);
    const minutesUntilOverdue = mocks.time.getMinutesUntil(overdueTime);

    expect(minutesUntilStarting).toBe(10);
    expect(minutesUntilLate).toBe(-15);
    expect(minutesUntilOverdue).toBe(-35);
  });

  test('appointment status logic with dependency injection', () => {
    // Set appointments at specific times for status testing
    const startingSoonTime = new Date('2024-01-15T10:10:00Z'); // 10 min from now
    const lateTime = new Date('2024-01-15T09:57:00Z'); // 3 min ago (within buffer)
    const overdueTime = new Date('2024-01-15T09:25:00Z'); // 35 min ago

    // Test status logic using dependency injection functions
    const isStartingSoon = mocks.time.isStartingSoon(startingSoonTime);
    const isRunningLate = mocks.time.isRunningLate(lateTime);
    const isOverdue = mocks.time.isOverdue(overdueTime);

    expect(isStartingSoon).toBe(true);
    expect(isRunningLate).toBe(true);
    expect(isOverdue).toBe(true);
    
    // Test negative cases
    expect(mocks.time.isStartingSoon(lateTime)).toBe(false);
    expect(mocks.time.isRunningLate(startingSoonTime)).toBe(false);
    expect(mocks.time.isOverdue(startingSoonTime)).toBe(false);
  });

  test('time progression simulation with dependency injection', () => {
    const appointmentTime = new Date('2024-01-15T10:30:00Z'); // 30 minutes from current time
    
    // Initially, appointment is 30 minutes away
    expect(mocks.time.getMinutesUntil(appointmentTime)).toBe(30);
    expect(mocks.time.isStartingSoon(appointmentTime)).toBe(false);
    
    // Advance time by 20 minutes
    mocks.time.advanceTime(20); // 20 minutes
    
    // Now appointment should be 10 minutes away
    expect(mocks.time.getMinutesUntil(appointmentTime)).toBe(10);
    expect(mocks.time.isStartingSoon(appointmentTime)).toBe(true);
    
    // Advance time past the appointment
    mocks.time.advanceTime(25); // 25 more minutes (total: 45 min advanced)
    
    // Now appointment should be 15 minutes overdue (30 - 45 = -15)
    expect(mocks.time.getMinutesUntil(appointmentTime)).toBe(-15);
    expect(mocks.time.isRunningLate(appointmentTime)).toBe(false); // 15 min is beyond 5 min buffer
  });

  test('duration formatting with dependency injection', () => {
    // Test duration formatting using dependency injection
    expect(mocks.time.formatDuration(90)).toBe('1h 30m');
    expect(mocks.time.formatDuration(60)).toBe('1h');
    expect(mocks.time.formatDuration(45)).toBe('45m');
    expect(mocks.time.formatDuration(0)).toBe('0m');
  });

  test('cache management with dependency injection', () => {
    const appointmentTime = new Date('2024-01-15T10:30:00Z');
    
    // Make some calculations to populate cache
    mocks.time.getMinutesUntil(appointmentTime);
    mocks.time.isStartingSoon(appointmentTime);
    
    // Get cache stats
    const stats = mocks.time.getTimeCacheStats();
    expect(stats).toBeDefined();
    expect(typeof stats.size).toBe('number');
    
    // Clear cache
    mocks.time.clearTimeCache();
    
    // Cache should be cleared (function should execute without error)
    expect(() => mocks.time.clearTimeCache()).not.toThrow();
  });
});
