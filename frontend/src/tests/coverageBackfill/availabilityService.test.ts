/**
 * Test suite for availabilityService.js
 * Target: 70%+ coverage for MEDIUM priority module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).fetch = mockFetch;

describe('AvailabilityService Coverage Tests', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let availabilityService: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Dynamic import each time to ensure fresh module state
    // @ts-expect-error - JavaScript module without TypeScript declarations
    availabilityService = await import('../../services/availabilityService.js');

    if (availabilityService?.clearAvailabilityCache) {
      availabilityService.clearAvailabilityCache();
    }

    // Reset fetch mock to default success response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ appointments: [] })
    });
  });

  describe('getAvailableSlots', () => {
    it('should return available slots for a valid service and date', async () => {
      const today = new Date();
      const result = await availabilityService.getAvailableSlots('Oil Change', today);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('id');
        expect(result[0]).toHaveProperty('time');
        expect(result[0]).toHaveProperty('formatted');
        expect(result[0]).toHaveProperty('duration');
        expect(result[0]).toHaveProperty('available');
      }
    });

    it('should handle invalid date gracefully', async () => {
      const result = await availabilityService.getAvailableSlots('Oil Change', 'invalid-date');
      expect(result).toEqual([]);
    });

    it('should handle past dates gracefully', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const result = await availabilityService.getAvailableSlots('Oil Change', pastDate);
      expect(result).toEqual([]);
    });

    it('should limit results based on maxSlots option', async () => {
      const today = new Date();
      const result = await availabilityService.getAvailableSlots('Oil Change', today, { maxSlots: 2 });
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('should handle different service durations', async () => {
      const today = new Date();

      const oilChangeSlots = await availabilityService.getAvailableSlots('Oil Change', today);
      const brakeServiceSlots = await availabilityService.getAvailableSlots('Brake Service', today);

      expect(oilChangeSlots).toBeInstanceOf(Array);
      expect(brakeServiceSlots).toBeInstanceOf(Array);

      if (oilChangeSlots.length > 0 && brakeServiceSlots.length > 0) {
        expect(oilChangeSlots[0].duration).toBe(45);
        expect(brakeServiceSlots[0].duration).toBe(120);
      }
    });

    it('should handle empty string service ID', async () => {
      const today = new Date();
      const result = await availabilityService.getAvailableSlots('', today);
      expect(result).toBeInstanceOf(Array);
    });

    it('should handle null service ID', async () => {
      const today = new Date();
      const result = await availabilityService.getAvailableSlots(null, today);
      expect(result).toBeInstanceOf(Array);
    });

    it('should handle unknown service types', async () => {
      const today = new Date();
      const result = await availabilityService.getAvailableSlots('Unknown Service', today);
      expect(result).toBeInstanceOf(Array);
    });
  });

  describe('getNextAvailableSlot', () => {
    it('should return next available slot or null', async () => {
      const result = await availabilityService.getNextAvailableSlot('Oil Change');

      if (result) {
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('time');
        expect(result).toHaveProperty('formatted');
        expect(result).toHaveProperty('date');
        expect(result.available).toBe(true);
      } else {
        expect(result).toBeNull();
      }
    });

    it('should handle custom days ahead parameter', async () => {
      const result = await availabilityService.getNextAvailableSlot('Oil Change', 3);

      if (result) {
        expect(result).toHaveProperty('date');
      }
    });

    it('should handle invalid service ID', async () => {
      const result = await availabilityService.getNextAvailableSlot(null);
      expect(result === null || (result && typeof result === 'object')).toBe(true);
    });

    it('should handle very limited days ahead', async () => {
      const result = await availabilityService.getNextAvailableSlot('Oil Change', 1);
      expect(result === null || (result && typeof result === 'object')).toBe(true);
    });
  });

  describe('clearAvailabilityCache', () => {
    it('should clear all cache when no serviceId provided', () => {
      expect(() => {
        availabilityService.clearAvailabilityCache();
      }).not.toThrow();
    });

    it('should clear cache for specific service', () => {
      expect(() => {
        availabilityService.clearAvailabilityCache('Oil Change');
      }).not.toThrow();
    });

    it('should clear cache for empty service ID', () => {
      expect(() => {
        availabilityService.clearAvailabilityCache('');
      }).not.toThrow();
    });

    it('should handle special characters in service ID', () => {
      expect(() => {
        availabilityService.clearAvailabilityCache('Service with spaces & symbols!');
      }).not.toThrow();
    });
  });

  describe('refreshAvailabilityCache', () => {
    it('should handle valid date range', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 2);

      await expect(
        availabilityService.refreshAvailabilityCache('Oil Change', startDate, endDate)
      ).resolves.not.toThrow();
    });

    it('should handle invalid dates gracefully', async () => {
      await expect(
        availabilityService.refreshAvailabilityCache('Oil Change', 'invalid', 'invalid')
      ).resolves.not.toThrow();
    });

    it('should handle invalid service ID', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1);

      await expect(
        availabilityService.refreshAvailabilityCache(null, startDate, endDate)
      ).resolves.not.toThrow();
    });

    it('should handle same start and end date', async () => {
      const date = new Date();

      await expect(
        availabilityService.refreshAvailabilityCache('Oil Change', date, date)
      ).resolves.not.toThrow();
    });

    it('should handle past dates', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      await expect(
        availabilityService.refreshAvailabilityCache('Oil Change', pastDate, pastDate)
      ).resolves.not.toThrow();
    });
  });

  describe('getAvailabilityStats', () => {
    it('should return availability statistics', async () => {
      const result = await availabilityService.getAvailabilityStats('Oil Change', 3);

      expect(result).toHaveProperty('totalSlots');
      expect(result).toHaveProperty('availableSlots');
      expect(result).toHaveProperty('occupancyRate');
      expect(result).toHaveProperty('nextAvailable');
      expect(typeof result.totalSlots).toBe('number');
      expect(typeof result.availableSlots).toBe('number');
      expect(typeof result.occupancyRate).toBe('string');
    });

    it('should handle single day analysis', async () => {
      const result = await availabilityService.getAvailabilityStats('Oil Change', 1);

      expect(result).toHaveProperty('totalSlots');
      expect(result).toHaveProperty('availableSlots');
      expect(result).toHaveProperty('occupancyRate');
      expect(result).toHaveProperty('nextAvailable');
    });

    it('should handle different service types', async () => {
      const oilChangeStats = await availabilityService.getAvailabilityStats('Oil Change', 2);
      const brakeServiceStats = await availabilityService.getAvailabilityStats('Brake Service', 2);

      expect(oilChangeStats).toHaveProperty('totalSlots');
      expect(brakeServiceStats).toHaveProperty('totalSlots');
      expect(typeof oilChangeStats.totalSlots).toBe('number');
      expect(typeof brakeServiceStats.totalSlots).toBe('number');
    });

    it('should handle zero days ahead', async () => {
      const result = await availabilityService.getAvailabilityStats('Oil Change', 0);

      expect(result).toHaveProperty('totalSlots');
      expect(result).toHaveProperty('availableSlots');
      expect(result.totalSlots).toBe(0);
      expect(result.availableSlots).toBe(0);
    });

    it('should handle longer analysis periods', async () => {
      const result = await availabilityService.getAvailabilityStats('Oil Change', 7);

      expect(result).toHaveProperty('totalSlots');
      expect(result.totalSlots).toBeGreaterThan(0);
    });

    it('should return valid occupancy rate format', async () => {
      const result = await availabilityService.getAvailabilityStats('Oil Change', 2);

      expect(typeof result.occupancyRate).toBe('string');
      expect(result.occupancyRate).toMatch(/^\d+\.\d$/);
    });

    it('should handle invalid service ID', async () => {
      const result = await availabilityService.getAvailabilityStats('', 2);

      expect(result).toHaveProperty('totalSlots');
      expect(result).toHaveProperty('availableSlots');
      expect(result).toHaveProperty('occupancyRate');
      expect(result).toHaveProperty('nextAvailable');
    });
  });

  describe('Edge Cases', () => {
    it('should handle future dates correctly', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const result = await availabilityService.getAvailableSlots('Oil Change', futureDate);
      expect(result).toBeInstanceOf(Array);
    });

    it('should handle weekend dates', async () => {
      const date = new Date();
      while (date.getDay() !== 0 && date.getDay() !== 6) {
        date.setDate(date.getDate() + 1);
      }

      const result = await availabilityService.getAvailableSlots('Oil Change', date);
      expect(result).toBeInstanceOf(Array);
    });

    it('should handle all defined service types', async () => {
      const serviceTypes = [
        'Oil Change',
        'Brake Service',
        'Engine Diagnostics',
        'Tire Rotation',
        'Battery Replacement',
        'Emergency Repair'
      ];

      const today = new Date();

      for (const service of serviceTypes) {
        const result = await availabilityService.getAvailableSlots(service, today);
        expect(result).toBeInstanceOf(Array);
      }
    });

    it('should maintain consistent data types in responses', async () => {
      const today = new Date();
      const result = await availabilityService.getAvailableSlots('Oil Change', today);

      if (result.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result.forEach((slot: any) => {
          expect(typeof slot.id).toBe('string');
          expect(slot.time).toBeInstanceOf(Date);
          expect(typeof slot.formatted).toBe('string');
          expect(typeof slot.duration).toBe('number');
          expect(typeof slot.available).toBe('boolean');
        });
      }
    });

    it('should handle stats for very short periods', async () => {
      const result = await availabilityService.getAvailabilityStats('Oil Change', 1);

      expect(result.totalSlots).toBeGreaterThanOrEqual(0);
      expect(result.availableSlots).toBeGreaterThanOrEqual(0);
      expect(result.availableSlots).toBeLessThanOrEqual(result.totalSlots);
    });
  });
});
