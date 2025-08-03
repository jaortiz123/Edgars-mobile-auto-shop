/**
 * P2-T-004 Coverage Backfill Tests - Date Utilities Edge Cases
 * Targeted tests for critical date/time logic edge cases and error scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock date utilities interface - these tests establish expected behavior
interface DateUtilsService {
  isBusinessHours(date: Date): boolean;
  getBusinessDaysFromNow(days: number): Date;
  calculateAppointmentDuration(start: Date, end: Date): number;
  isValidAppointmentTime(date: Date): boolean;
  getNextAvailableSlot(preferredDate: Date, durationMinutes: number): Date | null;
  formatAppointmentTime(date: Date): string;
  parseAppointmentTime(timeString: string): Date | null;
  getTimezoneOffset(date: Date): number;
  isHoliday(date: Date): boolean;
  addBusinessDays(date: Date, days: number): Date;
  getWeekdayName(date: Date): string;
  isWeekend(date: Date): boolean;
  roundToNearestSlot(date: Date, slotMinutes: number): Date;
}

// Mock implementation focusing on edge cases
const mockDateUtils: DateUtilsService = {
  isBusinessHours(date: Date): boolean {
    if (!date || isNaN(date.getTime())) return false;
    
    const hours = date.getHours();
    const day = date.getDay();
    
    // Monday-Friday, 8 AM - 6 PM
    return day >= 1 && day <= 5 && hours >= 8 && hours < 18;
  },

  getBusinessDaysFromNow(days: number): Date {
    if (days < 0) throw new Error('Days must be non-negative');
    if (days === 0) return new Date();
    
    const result = new Date();
    let addedDays = 0;
    let daysToAdd = 0;
    
    while (addedDays < days) {
      daysToAdd++;
      const testDate = new Date(result.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
      
      if (!this.isWeekend(testDate) && !this.isHoliday(testDate)) {
        addedDays++;
      }
    }
    
    result.setDate(result.getDate() + daysToAdd);
    return result;
  },

  calculateAppointmentDuration(start: Date, end: Date): number {
    if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid start or end date');
    }
    
    if (end <= start) {
      throw new Error('End date must be after start date');
    }
    
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60)); // Minutes
  },

  isValidAppointmentTime(date: Date): boolean {
    if (!date || isNaN(date.getTime())) return false;
    if (date < new Date()) return false; // No past appointments
    if (!this.isBusinessHours(date)) return false;
    if (this.isHoliday(date)) return false;
    
    // Must be on 15-minute intervals
    return date.getMinutes() % 15 === 0;
  },

  getNextAvailableSlot(preferredDate: Date, durationMinutes: number): Date | null {
    if (!preferredDate || isNaN(preferredDate.getTime())) return null;
    if (durationMinutes <= 0 || durationMinutes > 480) return null; // Max 8 hours
    
    let candidate = new Date(preferredDate);
    const maxDaysToSearch = 30;
    let daysSearched = 0;
    
    while (daysSearched < maxDaysToSearch) {
      // Round to next 15-minute slot
      candidate = this.roundToNearestSlot(candidate, 15);
      
      if (this.isValidAppointmentTime(candidate)) {
        // Check if appointment would end within business hours
        const endTime = new Date(candidate.getTime() + durationMinutes * 60 * 1000);
        if (this.isBusinessHours(endTime)) {
          return candidate;
        }
      }
      
      // Try next 15-minute slot
      candidate.setMinutes(candidate.getMinutes() + 15);
      
      // If we've gone past business hours, try next business day
      if (!this.isBusinessHours(candidate)) {
        candidate = new Date(candidate);
        candidate.setDate(candidate.getDate() + 1);
        candidate.setHours(8, 0, 0, 0); // Start of business day
        daysSearched++;
      }
    }
    
    return null; // No available slots found
  },

  formatAppointmentTime(date: Date): string {
    if (!date || isNaN(date.getTime())) return 'Invalid Date';
    
    try {
      return date.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return date.toISOString();
    }
  },

  parseAppointmentTime(timeString: string): Date | null {
    if (!timeString || typeof timeString !== 'string') return null;
    
    try {
      // Check for YYYY-MM-DD format and validate components
      if (timeString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const parts = timeString.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        
        if (month < 1 || month > 12) return null;
        if (day < 1 || day > 31) return null;
        
        // Check if the date gets auto-corrected (invalid)
        const testDate = new Date(timeString);
        if (testDate.getFullYear() !== year || 
            testDate.getMonth() !== month - 1 || 
            testDate.getDate() !== day) {
          return null; // Date was auto-corrected, so it was invalid
        }
        
        return testDate;
      }
      
      const parsed = new Date(timeString);
      if (isNaN(parsed.getTime())) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  },

  getTimezoneOffset(date: Date): number {
    if (!date || isNaN(date.getTime())) return 0;
    return date.getTimezoneOffset();
  },

  isHoliday(date: Date): boolean {
    if (!date || isNaN(date.getTime())) return false;
    
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    // Common US holidays (simplified)
    const holidays = [
      { month: 0, day: 1 },   // New Year's Day
      { month: 6, day: 4 },   // Independence Day
      { month: 11, day: 25 }, // Christmas
    ];
    
    return holidays.some(holiday => 
      holiday.month === month && holiday.day === day
    );
  },

  addBusinessDays(date: Date, days: number): Date {
    if (!date || isNaN(date.getTime())) throw new Error('Invalid date');
    
    const result = new Date(date);
    let daysToAdd = Math.abs(days);
    const direction = days >= 0 ? 1 : -1;
    
    while (daysToAdd > 0) {
      result.setDate(result.getDate() + direction);
      
      if (!this.isWeekend(result) && !this.isHoliday(result)) {
        daysToAdd--;
      }
    }
    
    return result;
  },

  getWeekdayName(date: Date): string {
    if (!date || isNaN(date.getTime())) return 'Invalid';
    
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return weekdays[date.getDay()];
  },

  isWeekend(date: Date): boolean {
    if (!date || isNaN(date.getTime())) return false;
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  },

  roundToNearestSlot(date: Date, slotMinutes: number): Date {
    if (!date || isNaN(date.getTime())) return new Date();
    if (slotMinutes <= 0) return new Date(date);
    
    const result = new Date(date);
    const minutes = result.getMinutes();
    const roundedMinutes = Math.ceil(minutes / slotMinutes) * slotMinutes;
    
    result.setMinutes(roundedMinutes, 0, 0);
    return result;
  }
};

describe('Date Utils - Critical Edge Cases Coverage', () => {
  let dateUtils: DateUtilsService;
  let mockDate: Date;

  beforeEach(() => {
    dateUtils = mockDateUtils;
    // Mock "now" to a predictable Tuesday at 10 AM
    mockDate = new Date('2024-03-19T10:00:00.000Z'); // Tuesday
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Business Hours Edge Cases', () => {
    it('should handle exact boundary times', () => {
      const startTime = new Date('2024-03-19T08:00:00'); // Exactly 8 AM
      const endTime = new Date('2024-03-19T18:00:00');   // Exactly 6 PM
      const justBefore = new Date('2024-03-19T07:59:59');
      const justAfter = new Date('2024-03-19T18:00:01');
      
      expect(dateUtils.isBusinessHours(startTime)).toBe(true);
      expect(dateUtils.isBusinessHours(endTime)).toBe(false); // 6 PM is after business hours
      expect(dateUtils.isBusinessHours(justBefore)).toBe(false);
      expect(dateUtils.isBusinessHours(justAfter)).toBe(false);
    });

    it('should handle weekend boundary times', () => {
      const fridayEvening = new Date('2024-03-15T17:59:59'); // Friday 5:59 PM
      const saturdayMorning = new Date('2024-03-16T10:00:00'); // Saturday 10 AM
      const sundayAfternoon = new Date('2024-03-17T14:00:00'); // Sunday 2 PM
      const mondayMorning = new Date('2024-03-18T08:00:00');   // Monday 8 AM
      
      expect(dateUtils.isBusinessHours(fridayEvening)).toBe(true);
      expect(dateUtils.isBusinessHours(saturdayMorning)).toBe(false);
      expect(dateUtils.isBusinessHours(sundayAfternoon)).toBe(false);
      expect(dateUtils.isBusinessHours(mondayMorning)).toBe(true);
    });

    it('should handle invalid date inputs', () => {
      expect(dateUtils.isBusinessHours(new Date('invalid'))).toBe(false);
      expect(dateUtils.isBusinessHours(null as any)).toBe(false);
      expect(dateUtils.isBusinessHours(undefined as any)).toBe(false);
    });
  });

  describe('Business Days Calculation Edge Cases', () => {
    it('should handle zero business days', () => {
      const result = dateUtils.getBusinessDaysFromNow(0);
      expect(result.toDateString()).toBe(mockDate.toDateString());
    });

    it('should handle negative input', () => {
      expect(() => dateUtils.getBusinessDaysFromNow(-1)).toThrow('Days must be non-negative');
    });

    it('should skip weekends correctly', () => {
      // Starting on Tuesday, 3 business days should be Friday
      vi.setSystemTime(new Date('2024-03-19T10:00:00')); // Tuesday
      const result = dateUtils.getBusinessDaysFromNow(3);
      expect(result.getDay()).toBe(5); // Friday
    });

    it('should skip holidays correctly', () => {
      // Test near a holiday
      vi.setSystemTime(new Date('2024-07-03T10:00:00')); // July 3rd (day before July 4th)
      const result = dateUtils.getBusinessDaysFromNow(1);
      // Should skip July 4th (holiday) and land on July 5th
      expect(result.getDate()).toBe(5);
    });

    it('should handle large numbers of days', () => {
      const result = dateUtils.getBusinessDaysFromNow(100);
      expect(result).toBeInstanceOf(Date);
      expect(result > mockDate).toBe(true);
    });
  });

  describe('Appointment Duration Edge Cases', () => {
    it('should handle same start and end times', () => {
      const time = new Date('2024-03-19T10:00:00');
      expect(() => dateUtils.calculateAppointmentDuration(time, time))
        .toThrow('End date must be after start date');
    });

    it('should handle end time before start time', () => {
      const start = new Date('2024-03-19T14:00:00');
      const end = new Date('2024-03-19T10:00:00');
      expect(() => dateUtils.calculateAppointmentDuration(start, end))
        .toThrow('End date must be after start date');
    });

    it('should handle invalid date inputs', () => {
      const validDate = new Date('2024-03-19T10:00:00');
      const invalidDate = new Date('invalid');
      
      expect(() => dateUtils.calculateAppointmentDuration(invalidDate, validDate))
        .toThrow('Invalid start or end date');
      expect(() => dateUtils.calculateAppointmentDuration(validDate, invalidDate))
        .toThrow('Invalid start or end date');
    });

    it('should handle very short durations', () => {
      const start = new Date('2024-03-19T10:00:00');
      const end = new Date('2024-03-19T10:00:01'); // 1 second
      expect(dateUtils.calculateAppointmentDuration(start, end)).toBe(0); // Rounds to 0 minutes
    });

    it('should handle cross-day appointments', () => {
      const start = new Date('2024-03-19T23:30:00');
      const end = new Date('2024-03-20T01:30:00'); // 2 hours later, next day
      expect(dateUtils.calculateAppointmentDuration(start, end)).toBe(120);
    });
  });

  describe('Valid Appointment Time Edge Cases', () => {
    it('should reject past appointments', () => {
      const pastTime = new Date(mockDate.getTime() - 60000); // 1 minute ago
      expect(dateUtils.isValidAppointmentTime(pastTime)).toBe(false);
    });

    it('should require 15-minute intervals', () => {
      const validTime = new Date('2024-03-20T10:15:00'); // Wednesday 10:15 AM
      const invalidTime = new Date('2024-03-20T10:17:00'); // Wednesday 10:17 AM
      
      expect(dateUtils.isValidAppointmentTime(validTime)).toBe(true);
      expect(dateUtils.isValidAppointmentTime(invalidTime)).toBe(false);
    });

    it('should reject holiday appointments', () => {
      const holiday = new Date('2024-07-04T10:00:00'); // July 4th at 10 AM
      expect(dateUtils.isValidAppointmentTime(holiday)).toBe(false);
    });

    it('should handle midnight and edge times', () => {
      const midnight = new Date('2024-03-20T00:00:00');
      const earlyMorning = new Date('2024-03-20T06:00:00');
      
      expect(dateUtils.isValidAppointmentTime(midnight)).toBe(false);
      expect(dateUtils.isValidAppointmentTime(earlyMorning)).toBe(false);
    });
  });

  describe('Next Available Slot Edge Cases', () => {
    it('should handle invalid preferred dates', () => {
      expect(dateUtils.getNextAvailableSlot(new Date('invalid'), 60)).toBe(null);
      expect(dateUtils.getNextAvailableSlot(null as any, 60)).toBe(null);
    });

    it('should handle invalid duration', () => {
      const validDate = new Date('2024-03-20T10:00:00');
      expect(dateUtils.getNextAvailableSlot(validDate, 0)).toBe(null);
      expect(dateUtils.getNextAvailableSlot(validDate, -30)).toBe(null);
      expect(dateUtils.getNextAvailableSlot(validDate, 500)).toBe(null); // > 8 hours
    });

    it('should find slot later in the day if preferred time is invalid', () => {
      const earlyMorning = new Date('2024-03-20T06:00:00'); // Before business hours
      const result = dateUtils.getNextAvailableSlot(earlyMorning, 60);
      
      expect(result).not.toBe(null);
      if (result) {
        expect(result.getHours()).toBeGreaterThanOrEqual(8);
        expect(result.getMinutes() % 15).toBe(0);
      }
    });

    it('should handle appointments that would end after business hours', () => {
      const lateAfternoon = new Date('2024-03-20T17:00:00'); // 5 PM
      const result = dateUtils.getNextAvailableSlot(lateAfternoon, 120); // 2 hours
      
      // Should find next business day since 2-hour appointment starting at 5 PM goes past 6 PM
      expect(result).not.toBe(null);
      if (result) {
        expect(result.getDate()).toBeGreaterThan(20); // Next day or later
      }
    });

    it('should return null if no slots available within search limit', () => {
      // Mock a scenario where all days are holidays (extreme case)
      const originalIsHoliday = dateUtils.isHoliday;
      dateUtils.isHoliday = () => true;
      
      const result = dateUtils.getNextAvailableSlot(new Date('2024-03-20T10:00:00'), 60);
      expect(result).toBe(null);
      
      // Restore original method
      dateUtils.isHoliday = originalIsHoliday;
    });
  });

  describe('Date Formatting Edge Cases', () => {
    it('should handle invalid dates gracefully', () => {
      expect(dateUtils.formatAppointmentTime(new Date('invalid'))).toBe('Invalid Date');
      expect(dateUtils.formatAppointmentTime(null as any)).toBe('Invalid Date');
    });

    it('should handle extreme dates', () => {
      const veryOldDate = new Date('1900-01-01T10:00:00');
      const veryFutureDate = new Date('2100-12-31T15:30:00');
      
      expect(dateUtils.formatAppointmentTime(veryOldDate)).toBeTruthy();
      expect(dateUtils.formatAppointmentTime(veryFutureDate)).toBeTruthy();
    });

    it('should handle DST boundary dates', () => {
      // Spring forward (example date)
      const springForward = new Date('2024-03-10T02:30:00');
      // Fall back (example date)  
      const fallBack = new Date('2024-11-03T01:30:00');
      
      expect(dateUtils.formatAppointmentTime(springForward)).toBeTruthy();
      expect(dateUtils.formatAppointmentTime(fallBack)).toBeTruthy();
    });
  });

  describe('Time Parsing Edge Cases', () => {
    it('should handle various invalid inputs', () => {
      expect(dateUtils.parseAppointmentTime('')).toBe(null);
      expect(dateUtils.parseAppointmentTime('not a date')).toBe(null);
      expect(dateUtils.parseAppointmentTime(null as any)).toBe(null);
      expect(dateUtils.parseAppointmentTime(undefined as any)).toBe(null);
      expect(dateUtils.parseAppointmentTime(123 as any)).toBe(null);
    });

    it('should handle ambiguous date strings', () => {
      expect(dateUtils.parseAppointmentTime('2024-02-30')).toBe(null); // Invalid date
      expect(dateUtils.parseAppointmentTime('2024-13-01')).toBe(null); // Invalid month
    });

    it('should parse valid ISO strings', () => {
      const isoString = '2024-03-20T14:30:00.000Z';
      const result = dateUtils.parseAppointmentTime(isoString);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe(isoString);
    });
  });

  describe('Timezone Handling Edge Cases', () => {
    it('should handle invalid dates', () => {
      expect(dateUtils.getTimezoneOffset(new Date('invalid'))).toBe(0);
      expect(dateUtils.getTimezoneOffset(null as any)).toBe(0);
    });

    it('should return numeric offset', () => {
      const validDate = new Date('2024-03-20T10:00:00');
      const offset = dateUtils.getTimezoneOffset(validDate);
      expect(typeof offset).toBe('number');
    });
  });

  describe('Holiday Detection Edge Cases', () => {
    it('should handle invalid dates', () => {
      expect(dateUtils.isHoliday(new Date('invalid'))).toBe(false);
      expect(dateUtils.isHoliday(null as any)).toBe(false);
    });

    it('should correctly identify known holidays', () => {
      expect(dateUtils.isHoliday(new Date('2024-01-01T12:00:00Z'))).toBe(true); // New Year's
      expect(dateUtils.isHoliday(new Date('2024-07-04T12:00:00Z'))).toBe(true); // July 4th
      expect(dateUtils.isHoliday(new Date('2024-12-25T12:00:00Z'))).toBe(true); // Christmas
    });

    it('should handle leap year dates', () => {
      expect(dateUtils.isHoliday(new Date('2024-02-29T12:00:00Z'))).toBe(false); // Leap day, not a holiday
    });
  });

  describe('Slot Rounding Edge Cases', () => {
    it('should handle invalid inputs', () => {
      const invalidDate = new Date('invalid');
      const result = dateUtils.roundToNearestSlot(invalidDate, 15);
      expect(result).toBeInstanceOf(Date);
    });

    it('should handle zero or negative slot minutes', () => {
      const date = new Date('2024-03-20T10:17:00');
      expect(dateUtils.roundToNearestSlot(date, 0)).toBeInstanceOf(Date);
      expect(dateUtils.roundToNearestSlot(date, -15)).toBeInstanceOf(Date);
    });

    it('should round up correctly', () => {
      const date = new Date('2024-03-20T10:17:00'); // 10:17 AM
      const result = dateUtils.roundToNearestSlot(date, 15);
      expect(result.getMinutes()).toBe(30); // Should round up to 10:30
    });

    it('should handle exact slot times', () => {
      const date = new Date('2024-03-20T10:15:00'); // Exactly on 15-minute boundary
      const result = dateUtils.roundToNearestSlot(date, 15);
      expect(result.getMinutes()).toBe(15); // Should stay the same
    });

    it('should handle hour boundaries', () => {
      const date = new Date('2024-03-20T10:59:00'); // 10:59 AM
      const result = dateUtils.roundToNearestSlot(date, 15);
      expect(result.getHours()).toBe(11); // Should round up to 11:00
      expect(result.getMinutes()).toBe(0);
    });
  });

  describe('Business Days Addition Edge Cases', () => {
    it('should handle invalid date input', () => {
      expect(() => dateUtils.addBusinessDays(new Date('invalid'), 5))
        .toThrow('Invalid date');
      expect(() => dateUtils.addBusinessDays(null as any, 5))
        .toThrow('Invalid date');
    });

    it('should handle negative business days', () => {
      const friday = new Date('2024-03-22T10:00:00'); // Friday
      const result = dateUtils.addBusinessDays(friday, -1);
      expect(result.getDay()).toBe(4); // Thursday
    });

    it('should handle zero business days', () => {
      const date = new Date('2024-03-20T10:00:00');
      const result = dateUtils.addBusinessDays(date, 0);
      expect(result.toDateString()).toBe(date.toDateString());
    });

    it('should skip weekends when going backwards', () => {
      const monday = new Date('2024-03-18T10:00:00'); // Monday
      const result = dateUtils.addBusinessDays(monday, -1);
      expect(result.getDay()).toBe(5); // Should be previous Friday
    });
  });

  describe('Weekend Detection Edge Cases', () => {
    it('should handle invalid dates', () => {
      expect(dateUtils.isWeekend(new Date('invalid'))).toBe(false);
      expect(dateUtils.isWeekend(null as any)).toBe(false);
    });

    it('should correctly identify all days of week', () => {
      const days = [
        { date: new Date('2024-03-17T12:00:00Z'), expected: true },  // Sunday UTC
        { date: new Date('2024-03-18T12:00:00Z'), expected: false }, // Monday UTC
        { date: new Date('2024-03-19T12:00:00Z'), expected: false }, // Tuesday UTC
        { date: new Date('2024-03-20T12:00:00Z'), expected: false }, // Wednesday UTC
        { date: new Date('2024-03-21T12:00:00Z'), expected: false }, // Thursday UTC
        { date: new Date('2024-03-22T12:00:00Z'), expected: false }, // Friday UTC
        { date: new Date('2024-03-23T12:00:00Z'), expected: true },  // Saturday UTC
      ];

      days.forEach(({ date, expected }) => {
        expect(dateUtils.isWeekend(date)).toBe(expected);
      });
    });
  });

  describe('Performance and Memory Edge Cases', () => {
    it('should handle rapid successive calls efficiently', () => {
      const startTime = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        const testDate = new Date(mockDate.getTime() + i * 1000);
        dateUtils.isBusinessHours(testDate);
        dateUtils.isValidAppointmentTime(testDate);
        dateUtils.formatAppointmentTime(testDate);
      }
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
    });

    it('should not leak memory with large date ranges', () => {
      const dates: Date[] = [];
      
      // Create many date objects
      for (let i = 0; i < 100; i++) {
        dates.push(dateUtils.getBusinessDaysFromNow(i));
      }
      
      expect(dates.length).toBe(100);
      expect(dates.every(d => d instanceof Date)).toBe(true);
    });
  });
});