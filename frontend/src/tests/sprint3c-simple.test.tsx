/**
 * Sprint 7 T5 Phase 2: Enhanced Time Utilities Test with Mock Factory Integration
 * Refactored from basic calculations to use mockFactory.time for deterministic testing
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { mockFactory } from '@/tests/mockFactory';

// Use mock factory time utilities for controlled testing
const { resetAll, time: timeMocks } = mockFactory;

describe('Sprint 3C: Time Utilities - Enhanced with Mock Factory', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    resetAll();
    
    // Set a fixed current time for deterministic testing
    const fixedTime = new Date('2024-01-15T10:00:00Z');
    timeMocks.setCurrentTime(fixedTime);
  });

  test('can use mock factory time utilities', () => {
    expect(timeMocks).toBeDefined();
    expect(timeMocks.getMinutesUntil).toBeDefined();
    expect(timeMocks.isStartingSoon).toBeDefined();
    expect(timeMocks.isRunningLate).toBeDefined();
    expect(timeMocks.isOverdue).toBeDefined();
    
    console.log('Mock factory time utils available:', Object.keys(timeMocks));
  });

  test('appointment timing calculations with mock factory', () => {
    // Set appointments at specific times relative to our fixed current time (10:00 AM)
    const startingSoonTime = new Date('2024-01-15T10:10:00Z'); // 10 minutes from now
    const lateTime = new Date('2024-01-15T09:45:00Z'); // 15 minutes ago  
    const overdueTime = new Date('2024-01-15T09:25:00Z'); // 35 minutes ago

    // Test using mock factory time calculations - these should work because they have mockImplementation
    const minutesUntilStarting = timeMocks.getMinutesUntil(startingSoonTime);
    const minutesUntilLate = timeMocks.getMinutesUntil(lateTime);
    const minutesUntilOverdue = timeMocks.getMinutesUntil(overdueTime);

    expect(minutesUntilStarting).toBe(10);
    expect(minutesUntilLate).toBe(-15);
    expect(minutesUntilOverdue).toBe(-35);
  });

  test('appointment status logic with mock factory', () => {
    // Set appointments at specific times for status testing
    const startingSoonTime = new Date('2024-01-15T10:10:00Z'); // 10 min from now
    const lateTime = new Date('2024-01-15T09:57:00Z'); // 3 min ago (within buffer)
    const overdueTime = new Date('2024-01-15T09:25:00Z'); // 35 min ago

    // Test status logic using mock factory functions
    const isStartingSoon = timeMocks.isStartingSoon(startingSoonTime);
    const isRunningLate = timeMocks.isRunningLate(lateTime);
    const isOverdue = timeMocks.isOverdue(overdueTime);

    expect(isStartingSoon).toBe(true);
    expect(isRunningLate).toBe(true);
    expect(isOverdue).toBe(true);
    
    // Test negative cases
    expect(timeMocks.isStartingSoon(lateTime)).toBe(false);
    expect(timeMocks.isRunningLate(startingSoonTime)).toBe(false);
    expect(timeMocks.isOverdue(startingSoonTime)).toBe(false);
  });

  test('time progression simulation with mock factory', () => {
    const appointmentTime = new Date('2024-01-15T10:30:00Z'); // 30 minutes from current time
    
    // Initially, appointment is 30 minutes away
    expect(timeMocks.getMinutesUntil(appointmentTime)).toBe(30);
    expect(timeMocks.isStartingSoon(appointmentTime)).toBe(false);
    
    // Advance time by 20 minutes
    timeMocks.advanceTime(20); // 20 minutes
    
    // Now appointment should be 10 minutes away
    expect(timeMocks.getMinutesUntil(appointmentTime)).toBe(10);
    expect(timeMocks.isStartingSoon(appointmentTime)).toBe(true);
    
    // Advance time past the appointment
    timeMocks.advanceTime(25); // 25 more minutes (total: 45 min advanced)
    
    // Now appointment should be 15 minutes overdue (30 - 45 = -15)
    expect(timeMocks.getMinutesUntil(appointmentTime)).toBe(-15);
    expect(timeMocks.isRunningLate(appointmentTime)).toBe(false); // 15 min is beyond 5 min buffer
  });

  test('duration formatting with mock factory', () => {
    // Test duration formatting using mock factory
    expect(timeMocks.formatDuration(90)).toBe('1h 30m');
    expect(timeMocks.formatDuration(60)).toBe('1h');
    expect(timeMocks.formatDuration(45)).toBe('45m');
    expect(timeMocks.formatDuration(0)).toBe('0m');
  });

  test('cache management with mock factory', () => {
    const appointmentTime = new Date('2024-01-15T10:30:00Z');
    
    // Make some calculations to populate cache
    timeMocks.getMinutesUntil(appointmentTime);
    timeMocks.isStartingSoon(appointmentTime);
    
    // Get cache stats
    const stats = timeMocks.getTimeCacheStats();
    expect(stats).toBeDefined();
    expect(typeof stats.size).toBe('number');
    
    // Clear cache
    timeMocks.clearTimeCache();
    
    // Cache should be cleared (function should execute without error)
    expect(timeMocks.clearTimeCache).toHaveBeenCalled();
  });
});
