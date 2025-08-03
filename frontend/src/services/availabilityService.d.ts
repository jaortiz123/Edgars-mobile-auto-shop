/**
 * TypeScript declarations for availabilityService.js
 * Enables proper type checking and imports for the JavaScript module
 */

export interface TimeSlot {
  id: string;
  time: Date;
  formatted: string;
  duration: number;
  available: boolean;
  conflictReason?: string;
  isFallback?: boolean;
}

export interface AvailabilityOptions {
  maxSlots?: number;
}

export interface NextAvailableSlot extends TimeSlot {
  date: string;
}

export interface AvailabilityStats {
  totalSlots: number;
  availableSlots: number;
  occupancyRate: number;
  nextAvailable: NextAvailableSlot | null;
}

/**
 * Get available appointment slots for a service
 */
export function getAvailableSlots(
  serviceId: string,
  targetDate?: string | Date,
  options?: AvailabilityOptions
): Promise<TimeSlot[]>;

/**
 * Get next available appointment slot
 */
export function getNextAvailableSlot(
  serviceId: string,
  daysAhead?: number
): Promise<NextAvailableSlot | null>;

/**
 * Clear availability cache
 */
export function clearAvailabilityCache(serviceId?: string | null): void;

/**
 * Refresh availability cache for a specific date range
 */
export function refreshAvailabilityCache(
  serviceId: string,
  startDate: Date,
  endDate: Date
): Promise<void>;

/**
 * Get availability statistics
 */
export function getAvailabilityStats(
  serviceId: string,
  daysAhead?: number
): Promise<AvailabilityStats>;
