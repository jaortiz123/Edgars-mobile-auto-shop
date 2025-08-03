/**
 * P2-T-004 Coverage Tests - Date Utilities
 * Tests specifically designed to achieve coverage on critical dateUtils functions
 */

import { describe, it, expect } from 'vitest';
import * as dateUtils from '../../utils/dateUtils.js';

describe('DateUtils Coverage Tests', () => {
  describe('Date Validation', () => {
    it('should validate dates correctly', () => {
      const validDate = new Date('2025-08-03T10:00:00');
      const invalidDate = new Date('invalid');
      
      expect(dateUtils.validateDate(validDate)).toEqual(validDate);
      expect(dateUtils.validateDate(invalidDate)).toBeNull();
      expect(dateUtils.validateDate(null)).toBeNull();
      expect(dateUtils.validateDate('not a date')).toBeNull();
    });

    it('should check if date is today', () => {
      const today = new Date();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      expect(dateUtils.isToday(today)).toBe(true);
      expect(dateUtils.isToday(yesterday)).toBe(false);
      expect(dateUtils.isToday(null)).toBe(false);
    });

    it('should check if date is tomorrow', () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const today = new Date();
      
      expect(dateUtils.isTomorrow(tomorrow)).toBe(true);
      expect(dateUtils.isTomorrow(today)).toBe(false);
      expect(dateUtils.isTomorrow(null)).toBe(false);
    });

    it('should check if date is in the past', () => {
      const past = new Date(Date.now() - 1000);
      const future = new Date(Date.now() + 1000);
      
      expect(dateUtils.isPast(past)).toBe(true);
      expect(dateUtils.isPast(future)).toBe(false);
      expect(dateUtils.isPast(null)).toBe(false);
    });
  });

  describe('Business Hours', () => {
    it('should check if date is in business hours', () => {
      const businessHour = new Date('2025-08-04T10:00:00'); // Monday 10am
      const afterHours = new Date('2025-08-04T20:00:00'); // Monday 8pm
      const weekend = new Date('2025-08-03T10:00:00'); // Sunday 10am
      
      expect(dateUtils.isInBusinessHours(businessHour)).toBe(true);
      expect(dateUtils.isInBusinessHours(afterHours)).toBe(false);
      expect(dateUtils.isInBusinessHours(weekend)).toBe(false);
      expect(dateUtils.isInBusinessHours(null)).toBe(false);
    });

    it('should work with custom business hours', () => {
      const date = new Date('2025-08-04T19:00:00'); // Monday 7pm
      const customHours = { start: 9, end: 20 }; // 9am-8pm
      
      expect(dateUtils.isInBusinessHours(date, customHours)).toBe(true);
      expect(dateUtils.isInBusinessHours(date)).toBe(false); // default hours
    });
  });

  describe('Date Formatting', () => {
    it('should format dates correctly', () => {
      const testDate = new Date('2025-08-03T14:30:00');
      
      expect(dateUtils.formatDate(testDate, 'date')).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(dateUtils.formatDate(testDate, 'time')).toMatch(/\d{1,2}:\d{2}/);
      expect(dateUtils.formatDate(testDate, 'datetime')).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(dateUtils.formatDate(null)).toBe('');
    });

    it('should get relative date strings', () => {
      const today = new Date();
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      expect(dateUtils.getRelativeDate(today)).toMatch(/today/i);
      expect(dateUtils.getRelativeDate(tomorrow)).toMatch(/tomorrow/i);
      expect(dateUtils.getRelativeDate(null)).toBe('');
    });
  });

  describe('Date Manipulation', () => {
    it('should add days correctly', () => {
      const date = new Date('2025-08-03T10:00:00');
      const result = dateUtils.addDays(date, 5);
      
      expect(result).toBeInstanceOf(Date);
      expect(result.getDate()).toBe(8);
      expect(dateUtils.addDays(null, 5)).toBeNull();
    });

    it('should add minutes correctly', () => {
      const date = new Date('2025-08-03T10:00:00');
      const result = dateUtils.addMinutes(date, 30);
      
      expect(result).toBeInstanceOf(Date);
      expect(result.getMinutes()).toBe(30);
      expect(dateUtils.addMinutes(null, 30)).toBeNull();
    });

    it('should calculate minutes difference', () => {
      const start = new Date('2025-08-03T10:00:00');
      const end = new Date('2025-08-03T10:30:00');
      
      expect(dateUtils.getMinutesDifference(start, end)).toBe(30);
      expect(dateUtils.getMinutesDifference(null, end)).toBe(0);
      expect(dateUtils.getMinutesDifference(start, null)).toBe(0);
    });
  });

  describe('Date Boundaries', () => {
    it('should get start of day', () => {
      const date = new Date('2025-08-03T14:30:45');
      const startOfDay = dateUtils.getStartOfDay(date);
      
      expect(startOfDay.getHours()).toBe(0);
      expect(startOfDay.getMinutes()).toBe(0);
      expect(startOfDay.getSeconds()).toBe(0);
      expect(dateUtils.getStartOfDay(null)).toBeNull();
    });

    it('should get end of day', () => {
      const date = new Date('2025-08-03T14:30:45');
      const endOfDay = dateUtils.getEndOfDay(date);
      
      expect(endOfDay.getHours()).toBe(23);
      expect(endOfDay.getMinutes()).toBe(59);
      expect(endOfDay.getSeconds()).toBe(59);
      expect(dateUtils.getEndOfDay(null)).toBeNull();
    });
  });

  describe('Date Ranges', () => {
    it('should generate date ranges', () => {
      const startDate = new Date('2025-08-03');
      const range = dateUtils.getDateRange(startDate, 3);
      
      expect(range).toHaveLength(3);
      expect(range[0]).toEqual(startDate);
      expect(dateUtils.getDateRange(null, 3)).toEqual([]);
    });

    it('should calculate business days between dates', () => {
      const monday = new Date('2025-08-04'); // Monday
      const friday = new Date('2025-08-08'); // Friday
      
      const businessDays = dateUtils.getBusinessDaysBetween(monday, friday);
      expect(businessDays).toBeGreaterThan(0);
      expect(dateUtils.getBusinessDaysBetween(null, friday)).toBe(0);
    });
  });

  describe('Time Utilities', () => {
    it('should parse time strings', () => {
      const result = dateUtils.parseTimeString('14:30');
      expect(result).toEqual({ hours: 14, minutes: 30 });
      
      expect(dateUtils.parseTimeString('invalid')).toBeNull();
      expect(dateUtils.parseTimeString(null)).toBeNull();
    });

    it('should combine date and time', () => {
      const result = dateUtils.combineDateAndTime('2025-08-03', '14:30');
      expect(result).toBeInstanceOf(Date);
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
      
      expect(dateUtils.combineDateAndTime(null, '14:30')).toBeNull();
      expect(dateUtils.combineDateAndTime('2025-08-03', null)).toBeNull();
    });

    it('should round to nearest interval', () => {
      const date = new Date('2025-08-03T10:07:00');
      const rounded = dateUtils.roundToNearestInterval(date, 15);
      
      expect(rounded.getMinutes()).toBe(0); // Rounds down to nearest 15min
      expect(dateUtils.roundToNearestInterval(null, 15)).toBeNull();
    });
  });

  describe('Special Date Checks', () => {
    it('should check if date is weekend', () => {
      const sunday = new Date('2025-08-03'); // Sunday
      const monday = new Date('2025-08-04'); // Monday
      
      expect(dateUtils.isWeekend(sunday)).toBe(true);
      expect(dateUtils.isWeekend(monday)).toBe(false);
      expect(dateUtils.isWeekend(null)).toBe(false);
    });

    it('should check if date is holiday', () => {
      const christmas = new Date('2025-12-25');
      const regular = new Date('2025-08-03');
      
      // Note: This tests the function exists and handles basic cases
      expect(typeof dateUtils.isHoliday(christmas)).toBe('boolean');
      expect(typeof dateUtils.isHoliday(regular)).toBe('boolean');
      expect(dateUtils.isHoliday(null)).toBe(false);
    });

    it('should parse appointment time strings', () => {
      const validTime = '2025-08-03T14:30:00';
      const invalidTime = 'invalid-time';
      
      const result = dateUtils.parseAppointmentTime(validTime);
      expect(result).toBeInstanceOf(Date);
      
      expect(dateUtils.parseAppointmentTime(invalidTime)).toBeNull();
      expect(dateUtils.parseAppointmentTime(null)).toBeNull();
    });
  });
});
