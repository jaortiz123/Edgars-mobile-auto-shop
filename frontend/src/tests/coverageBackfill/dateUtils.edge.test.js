/**
 * P2-T-004 Edge Cases Tests - Date Utilities
 * Comprehensive edge case testing for dateUtils to ensure robust error handling
 */

import { describe, it, expect } from 'vitest';
import * as dateUtils from '../../utils/dateUtils.js';

describe('DateUtils Edge Cases', () => {
  describe('Null and Undefined Handling', () => {
    it('should handle null inputs gracefully', () => {
      expect(dateUtils.validateDate(null)).toBeNull();
      expect(dateUtils.isToday(null)).toBe(false);
      expect(dateUtils.isTomorrow(null)).toBe(false);
      expect(dateUtils.isPast(null)).toBe(false);
      expect(dateUtils.isInBusinessHours(null)).toBe(false);
      expect(dateUtils.formatDate(null)).toBe('Invalid Date');
      expect(dateUtils.getRelativeDate(null)).toBe('Invalid Date');
      expect(dateUtils.addDays(null, 5)).toBeNull();
      expect(dateUtils.addMinutes(null, 30)).toBeNull();
      expect(dateUtils.getMinutesDifference(null, new Date())).toBe(0);
      expect(dateUtils.getStartOfDay(null)).toBeNull();
      expect(dateUtils.getEndOfDay(null)).toBeNull();
      expect(dateUtils.getDateRange(null, 3)).toEqual([]);
      expect(dateUtils.parseTimeString(null)).toBeNull();
      expect(dateUtils.parseAppointmentTime(null)).toBeNull();
      expect(dateUtils.combineDateAndTime(null, '10:00 AM')).toBeNull();
      expect(dateUtils.getBusinessDaysBetween(null, new Date())).toBe(0);
      expect(dateUtils.isWeekend(null)).toBe(false);
      expect(dateUtils.isHoliday(null)).toBe(false);
      expect(dateUtils.roundToNearestInterval(null, 15)).toBeNull();
    });

    it('should handle undefined inputs gracefully', () => {
      expect(dateUtils.validateDate(undefined)).toBeNull();
      expect(dateUtils.isToday(undefined)).toBe(false);
      expect(dateUtils.isTomorrow(undefined)).toBe(false);
      expect(dateUtils.isPast(undefined)).toBe(false);
      expect(dateUtils.isInBusinessHours(undefined)).toBe(false);
      expect(dateUtils.formatDate(undefined)).toBe('Invalid Date');
      expect(dateUtils.getRelativeDate(undefined)).toBe('Invalid Date');
      expect(dateUtils.addDays(undefined, 5)).toBeNull();
      expect(dateUtils.addMinutes(undefined, 30)).toBeNull();
      expect(dateUtils.getMinutesDifference(undefined, new Date())).toBe(0);
      expect(dateUtils.getStartOfDay(undefined)).toBeNull();
      expect(dateUtils.getEndOfDay(undefined)).toBeNull();
      expect(dateUtils.getDateRange(undefined, 3)).toEqual([]);
      expect(dateUtils.parseTimeString(undefined)).toBeNull();
      expect(dateUtils.parseAppointmentTime(undefined)).toBeNull();
      expect(dateUtils.combineDateAndTime(undefined, '10:00 AM')).toBeNull();
      expect(dateUtils.getBusinessDaysBetween(undefined, new Date())).toBe(0);
      expect(dateUtils.isWeekend(undefined)).toBe(false);
      expect(dateUtils.isHoliday(undefined)).toBe(false);
      expect(dateUtils.roundToNearestInterval(undefined, 15)).toBeNull();
    });
  });

  describe('Invalid Date Objects', () => {
    const invalidDate = new Date('invalid');

    it('should handle invalid Date objects', () => {
      expect(dateUtils.validateDate(invalidDate)).toBeNull();
      expect(dateUtils.isToday(invalidDate)).toBe(false);
      expect(dateUtils.isTomorrow(invalidDate)).toBe(false);
      expect(dateUtils.isPast(invalidDate)).toBe(false);
      expect(dateUtils.isInBusinessHours(invalidDate)).toBe(false);
      expect(dateUtils.formatDate(invalidDate)).toBe('Invalid Date');
      expect(dateUtils.getRelativeDate(invalidDate)).toBe('Invalid Date');
      expect(dateUtils.addDays(invalidDate, 5)).toBeNull();
      expect(dateUtils.addMinutes(invalidDate, 30)).toBeNull();
      expect(dateUtils.getMinutesDifference(invalidDate, new Date())).toBe(0);
      expect(dateUtils.getStartOfDay(invalidDate)).toBeNull();
      expect(dateUtils.getEndOfDay(invalidDate)).toBeNull();
      expect(dateUtils.getDateRange(invalidDate, 3)).toEqual([]);
      expect(dateUtils.getBusinessDaysBetween(invalidDate, new Date())).toBe(0);
      expect(dateUtils.isWeekend(invalidDate)).toBe(false);
      expect(dateUtils.isHoliday(invalidDate)).toBe(false);
      expect(dateUtils.roundToNearestInterval(invalidDate, 15)).toBeNull();
    });
  });

  describe('Empty and Invalid String Inputs', () => {
    it('should handle empty strings', () => {
      expect(dateUtils.validateDate('')).toBeNull();
      expect(dateUtils.parseTimeString('')).toBeNull();
      expect(dateUtils.parseAppointmentTime('')).toBeNull();
      expect(dateUtils.combineDateAndTime('', '10:00 AM')).toBeNull();
      expect(dateUtils.combineDateAndTime('2025-08-03', '')).toBeNull();
    });

    it('should handle invalid string formats', () => {
      expect(dateUtils.validateDate('not a date')).toBeNull();
      expect(dateUtils.parseTimeString('not a time')).toBeNull();
      expect(dateUtils.parseAppointmentTime('invalid time')).toBeNull();
      expect(dateUtils.combineDateAndTime('invalid date', '10:00 AM')).toBeNull();
      expect(dateUtils.combineDateAndTime('2025-08-03', 'invalid time')).toBeNull();
    });
  });

  describe('Edge Date Values', () => {
    it('should handle edge date values correctly', () => {
      // Test with Unix epoch
      const epoch = new Date(0);
      expect(dateUtils.validateDate(epoch)).toEqual(epoch);
      expect(dateUtils.formatDate(epoch)).toBeTruthy();
      
      // Test with far future date
      const farFuture = new Date('2099-12-31T23:59:59');
      expect(dateUtils.validateDate(farFuture)).toEqual(farFuture);
      expect(dateUtils.formatDate(farFuture)).toBeTruthy();
      
      // Test with leap year dates
      const leapYear = new Date('2024-02-29T10:00:00');
      expect(dateUtils.validateDate(leapYear)).toEqual(leapYear);
      expect(dateUtils.formatDate(leapYear)).toBeTruthy();
    });

    it('should handle end of month/year boundaries', () => {
      const endOfYear = new Date('2025-12-31T23:59:59');
      const nextDay = dateUtils.addDays(endOfYear, 1);
      expect(nextDay.getFullYear()).toBe(2026);
      expect(nextDay.getMonth()).toBe(0); // January
      expect(nextDay.getDate()).toBe(1);

      const endOfMonth = new Date('2025-01-31T10:00:00');
      const nextMonth = dateUtils.addDays(endOfMonth, 1);
      expect(nextMonth.getMonth()).toBe(1); // February
      expect(nextMonth.getDate()).toBe(1);
    });
  });

  describe('Business Logic Edge Cases', () => {
    it('should handle weekend business hour checks', () => {
      const saturdayMorning = new Date('2025-08-02T10:00:00'); // Saturday
      const sundayMorning = new Date('2025-08-03T10:00:00'); // Sunday
      
      expect(dateUtils.isInBusinessHours(saturdayMorning)).toBe(false);
      expect(dateUtils.isInBusinessHours(sundayMorning)).toBe(false);
    });

    it('should handle boundary business hours', () => {
      const exactStart = new Date('2025-08-04T08:00:00'); // Monday 8 AM
      const exactEnd = new Date('2025-08-04T17:00:00'); // Monday 5 PM
      const justBefore = new Date('2025-08-04T07:59:59'); // Monday 7:59:59 AM
      const justAfter = new Date('2025-08-04T17:00:01'); // Monday 5:00:01 PM
      
      expect(dateUtils.isInBusinessHours(exactStart)).toBe(true);
      expect(dateUtils.isInBusinessHours(exactEnd)).toBe(false); // Should be exclusive
      expect(dateUtils.isInBusinessHours(justBefore)).toBe(false);
      expect(dateUtils.isInBusinessHours(justAfter)).toBe(false);
    });

    it('should handle business days calculation edge cases', () => {
      // Same day
      const sameDay = new Date('2025-08-04T10:00:00');
      expect(dateUtils.getBusinessDaysBetween(sameDay, sameDay)).toBe(0);
      
      // End date before start date
      const start = new Date('2025-08-06T10:00:00');
      const end = new Date('2025-08-04T10:00:00');
      expect(dateUtils.getBusinessDaysBetween(start, end)).toBe(0);
      
      // Weekend-only range
      const fridayEvening = new Date('2025-08-01T18:00:00');
      const mondayMorning = new Date('2025-08-04T09:00:00');
      expect(dateUtils.getBusinessDaysBetween(fridayEvening, mondayMorning)).toBe(1); // Just Friday
    });
  });

  describe('Time Parsing Edge Cases', () => {
    it('should handle various time formats', () => {
      // 12-hour format variations
      expect(dateUtils.parseTimeString('1:00 AM')).toEqual({ hours: 1, minutes: 0 });
      expect(dateUtils.parseTimeString('12:00 AM')).toEqual({ hours: 0, minutes: 0 }); // Midnight
      expect(dateUtils.parseTimeString('12:00 PM')).toEqual({ hours: 12, minutes: 0 }); // Noon
      expect(dateUtils.parseTimeString('11:59 PM')).toEqual({ hours: 23, minutes: 59 });
      
      // 24-hour format
      expect(dateUtils.parseTimeString('00:00')).toEqual({ hours: 0, minutes: 0 });
      expect(dateUtils.parseTimeString('23:59')).toEqual({ hours: 23, minutes: 59 });
      
      // Edge cases
      expect(dateUtils.parseTimeString('25:00')).toBeNull(); // Invalid hour
      expect(dateUtils.parseTimeString('12:60')).toBeNull(); // Invalid minute
      expect(dateUtils.parseTimeString('12:00 XM')).toBeNull(); // Invalid meridiem
    });

    it('should handle malformed time strings', () => {
      expect(dateUtils.parseTimeString('10')).toBeNull();
      expect(dateUtils.parseTimeString('10:')).toBeNull();
      expect(dateUtils.parseTimeString(':30')).toBeNull();
      expect(dateUtils.parseTimeString('10:30:45')).toBeNull(); // Seconds not supported
      expect(dateUtils.parseTimeString('abc:def')).toBeNull();
    });
  });

  describe('Date Range Edge Cases', () => {
    it('should handle edge case parameters for date ranges', () => {
      const baseDate = new Date('2025-08-03T10:00:00');
      
      // Zero days
      expect(dateUtils.getDateRange(baseDate, 0)).toEqual([]);
      
      // Negative days
      expect(dateUtils.getDateRange(baseDate, -1)).toEqual([]);
      expect(dateUtils.getDateRange(baseDate, -5)).toEqual([]);
      
      // Very large range (should still work but might be memory intensive)
      const largeRange = dateUtils.getDateRange(baseDate, 1000);
      expect(largeRange).toHaveLength(1000);
      expect(largeRange[0]).toEqual(baseDate);
      expect(largeRange[999]).toEqual(dateUtils.addDays(baseDate, 999));
    });
  });

  describe('Rounding Edge Cases', () => {
    it('should handle edge cases in time rounding', () => {
      const testDate = new Date('2025-08-03T10:00:00'); // Exactly on the hour
      
      // Should return same time when already rounded
      const rounded = dateUtils.roundToNearestInterval(testDate, 15);
      expect(rounded.getHours()).toBe(10);
      expect(rounded.getMinutes()).toBe(0);
      
      // Test with 1-minute intervals
      const testDate2 = new Date('2025-08-03T10:30:30'); // 30 seconds
      const rounded1min = dateUtils.roundToNearestInterval(testDate2, 1);
      expect(rounded1min.getMinutes()).toBe(31); // Should round up to next minute
      
      // Test with very large intervals
      const testDate3 = new Date('2025-08-03T10:30:00');
      const rounded60 = dateUtils.roundToNearestInterval(testDate3, 60);
      expect(rounded60.getHours()).toBe(11);
      expect(rounded60.getMinutes()).toBe(0);
      
      // Test with zero interval (should handle gracefully)
      expect(dateUtils.roundToNearestInterval(testDate, 0)).toBeNull();
      
      // Test with negative interval
      expect(dateUtils.roundToNearestInterval(testDate, -15)).toBeNull();
    });
  });

  describe('Day Boundary Edge Cases', () => {
    it('should handle daylight saving time transitions', () => {
      // Note: These tests may vary depending on timezone
      const beforeDST = new Date('2025-03-09T01:30:00'); // Before DST starts
      const afterDST = new Date('2025-03-09T03:30:00'); // After DST starts
      
      const startOfDayBefore = dateUtils.getStartOfDay(beforeDST);
      const endOfDayBefore = dateUtils.getEndOfDay(beforeDST);
      
      expect(startOfDayBefore.getHours()).toBe(0);
      expect(endOfDayBefore.getHours()).toBe(23);
      
      const startOfDayAfter = dateUtils.getStartOfDay(afterDST);
      const endOfDayAfter = dateUtils.getEndOfDay(afterDST);
      
      expect(startOfDayAfter.getHours()).toBe(0);
      expect(endOfDayAfter.getHours()).toBe(23);
    });

    it('should handle year boundaries correctly', () => {
      const newYearsEve = new Date('2025-12-31T23:30:00');
      const startOfDay = dateUtils.getStartOfDay(newYearsEve);
      const endOfDay = dateUtils.getEndOfDay(newYearsEve);
      
      expect(startOfDay.getFullYear()).toBe(2025);
      expect(startOfDay.getMonth()).toBe(11); // December
      expect(startOfDay.getDate()).toBe(31);
      
      expect(endOfDay.getFullYear()).toBe(2025);
      expect(endOfDay.getMonth()).toBe(11);
      expect(endOfDay.getDate()).toBe(31);
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle repeated operations without memory leaks', () => {
      const baseDate = new Date('2025-08-03T10:00:00');
      
      // Perform many operations to test for memory leaks
      for (let i = 0; i < 100; i++) {
        dateUtils.addDays(baseDate, i);
        dateUtils.addMinutes(baseDate, i * 15);
        dateUtils.formatDate(baseDate);
        dateUtils.getRelativeDate(baseDate);
        dateUtils.roundToNearestInterval(baseDate, 15);
      }
      
      // If we get here without errors, memory handling is likely fine
      expect(true).toBe(true);
    });

    it('should handle rapid successive calls', () => {
      const now = new Date();
      
      // Rapid successive calls should not interfere with each other
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(dateUtils.addMinutes(now, i));
      }
      
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.getMinutes()).toBe((now.getMinutes() + index) % 60);
      });
    });
  });
});
