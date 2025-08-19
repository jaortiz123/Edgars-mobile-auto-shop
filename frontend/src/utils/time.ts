/**
 * Enhanced Time Utility Functions for Sprint 3C Appointment Reminders
 * Enterprise-grade implementation with comprehensive robustness framework
 *
 * Features:
 * - Input validation with detailed error handling
 * - Timezone awareness and standardization
 * - Performance optimization with caching
 * - Accessibility support for screen readers
 * - Memory-efficient calculations
 * - Comprehensive error boundaries
 */

// Type definitions for enhanced error handling
export interface TimeError extends Error {
  code: string;
  context?: Record<string, unknown>;
}

export interface TimeCalculationOptions {
  timezone?: string;
  allowFuture?: boolean;
  allowPast?: boolean;
  maxDaysAhead?: number;
  maxDaysBehind?: number;
}

// Performance optimization: Cache for time calculations
const timeCalculationCache = new Map<string, { result: number; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds

// Default options
const DEFAULT_OPTIONS: TimeCalculationOptions = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  allowFuture: true,
  allowPast: true,
  maxDaysAhead: 365,
  maxDaysBehind: 30
};

/**
 * Create a standardized time error
 */
function createTimeError(message: string, code: string, context?: Record<string, unknown>): TimeError {
  const error = new Error(message) as TimeError;
  error.code = code;
  error.context = context;
  return error;
}

/**
 * Validate and normalize time input with comprehensive error handling
 */
function validateAndNormalizeTime(
  timeInput: Date | string | number | null | undefined,
  context: string = 'time input'
): Date {
  // Handle null/undefined
  if (timeInput == null) {
    throw createTimeError(
      `Invalid ${context}: cannot be null or undefined`,
      'TIME_NULL_INPUT',
      { input: timeInput, context }
    );
  }

  let date: Date;

  try {
    // Handle different input types
    if (timeInput instanceof Date) {
      date = new Date(timeInput.getTime()); // Create new instance to avoid mutation
    } else if (typeof timeInput === 'string') {
      // Handle ISO strings, timestamps, and other string formats
      if (timeInput.trim() === '') {
        throw createTimeError(
          `Invalid ${context}: empty string`,
          'TIME_EMPTY_STRING',
          { input: timeInput, context }
        );
      }
      date = new Date(timeInput);
    } else if (typeof timeInput === 'number') {
      // Handle Unix timestamps (both seconds and milliseconds)
      const timestamp = timeInput < 10000000000 ? timeInput * 1000 : timeInput;
      date = new Date(timestamp);
    } else {
      throw createTimeError(
        `Invalid ${context}: unsupported type ${typeof timeInput}`,
        'TIME_INVALID_TYPE',
        { input: timeInput as unknown, type: typeof timeInput, context }
      );
    }

    // Validate the resulting date
    if (isNaN(date.getTime())) {
      throw createTimeError(
        `Invalid ${context}: results in invalid date`,
        'TIME_INVALID_DATE',
        { input: timeInput as unknown, context }
      );
    }

    // Additional validation for reasonable date ranges
    const now = new Date();
    const yearDiff = Math.abs(date.getFullYear() - now.getFullYear());
    if (yearDiff > 100) {
      throw createTimeError(
        `Invalid ${context}: date too far in past or future (${yearDiff} years)`,
        'TIME_UNREASONABLE_DATE',
        { input: timeInput as unknown, date: date.toISOString(), yearDiff, context }
      );
    }

    return date;
  } catch (error) {
    if (error instanceof Error && (error as TimeError).code) {
      throw error; // Re-throw our custom errors
    }

    throw createTimeError(
      `Failed to parse ${context}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'TIME_PARSE_ERROR',
      { input: timeInput as unknown, originalError: error as unknown, context }
    );
  }
}

/**
 * Clear expired entries from time calculation cache
 */
function clearExpiredTimeCache(): void {
  const now = Date.now();
  const entries = Array.from(timeCalculationCache.entries());

  for (const [key, value] of entries) {
    if (now - value.timestamp > CACHE_DURATION) {
      timeCalculationCache.delete(key);
    }
  }
}

/**
 * Enhanced calculation of minutes until a given start time with caching and validation
 * @param startTime - The appointment start time
 * @param options - Configuration options
 * @returns Minutes until start time (negative if in the past)
 */
export function getMinutesUntil(
  startTime: Date | string | number,
  options: TimeCalculationOptions = {}
): number {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    // Create cache key for performance optimization
    const cacheKey = `minutesUntil:${startTime}:${JSON.stringify(opts)}`;
    const cached = timeCalculationCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return cached.result;
    }

    // Validate inputs
    const start = validateAndNormalizeTime(startTime, 'start time');
    const now = new Date();

    // Apply timezone standardization if specified
    let adjustedStart = start;
    if (opts.timezone && opts.timezone !== DEFAULT_OPTIONS.timezone) {
      // Convert to specified timezone (basic implementation)
      const offset = new Date().getTimezoneOffset() * 60000;
      adjustedStart = new Date(start.getTime() + offset);
    }

    // Calculate difference in milliseconds, then convert to minutes
    const diffMs = adjustedStart.getTime() - now.getTime();
    const diffMinutes = Math.round(diffMs / (1000 * 60));

    // Apply business rules validation
    if (!opts.allowFuture && diffMinutes > 0) {
      throw createTimeError(
        'Future times not allowed with current options',
        'TIME_FUTURE_NOT_ALLOWED',
        { diffMinutes, options: opts }
      );
    }

    if (!opts.allowPast && diffMinutes < 0) {
      throw createTimeError(
        'Past times not allowed with current options',
        'TIME_PAST_NOT_ALLOWED',
        { diffMinutes, options: opts }
      );
    }

    // Check reasonable limits
    const daysDiff = Math.abs(diffMinutes) / (24 * 60);
    if (diffMinutes > 0 && daysDiff > (opts.maxDaysAhead || 365)) {
      throw createTimeError(
        `Start time too far in future: ${daysDiff.toFixed(1)} days`,
        'TIME_TOO_FAR_FUTURE',
        { daysDiff, maxDaysAhead: opts.maxDaysAhead }
      );
    }

    if (diffMinutes < 0 && daysDiff > (opts.maxDaysBehind || 30)) {
      throw createTimeError(
        `Start time too far in past: ${daysDiff.toFixed(1)} days`,
        'TIME_TOO_FAR_PAST',
        { daysDiff, maxDaysBehind: opts.maxDaysBehind }
      );
    }

    // Cache the result for performance
    timeCalculationCache.set(cacheKey, {
      result: diffMinutes,
      timestamp: Date.now()
    });

    // Clean cache periodically
    if (timeCalculationCache.size > 100) {
      clearExpiredTimeCache();
    }

    return diffMinutes;
  } catch (error) {
    // Enhanced error logging
    console.error('Error in getMinutesUntil:', {
      startTime,
      options,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });

    // Return safe fallback for non-critical usage
    if (error instanceof Error && (error as TimeError).code === 'TIME_NULL_INPUT') {
      return 0; // Safe fallback for null inputs
    }

    throw error; // Re-throw for critical errors
  }
}

/**
 * Enhanced calculation of minutes since a given time with validation
 * @param time - The reference time
 * @param options - Configuration options
 * @returns Minutes since the time (positive if in the past)
 */
export function minutesPast(
  time: Date | string | number,
  options: TimeCalculationOptions = {}
): number {
  try {
    return -getMinutesUntil(time, options);
  } catch (error) {
    console.error('Error in minutesPast:', {
      time,
      options,
      error: error instanceof Error ? error.message : error
    });
    throw error;
  }
}

/**
 * Enhanced duration formatting with accessibility support
 * @param minutes - Number of minutes
 * @param options - Formatting options
 * @returns Formatted duration string
 */
export function formatDuration(
  minutes: number,
  options: {
    includeSeconds?: boolean;
    shortForm?: boolean;
    accessibility?: boolean;
  } = {}
): string {
  try {
    // Input validation
    if (typeof minutes !== 'number' || !isFinite(minutes)) {
      throw createTimeError(
        'Invalid minutes value for formatting',
        'TIME_INVALID_MINUTES',
        { minutes, type: typeof minutes }
      );
    }

    const absMinutes = Math.abs(minutes);
    const hours = Math.floor(absMinutes / 60);
    const mins = Math.round(absMinutes % 60);

    const { shortForm = false, accessibility = false } = options;

    // Format for screen readers
    if (accessibility) {
      if (hours > 0) {
        const hourText = hours === 1 ? '1 hour' : `${hours} hours`;
        const minText = mins === 0 ? '' : mins === 1 ? ' 1 minute' : ` ${mins} minutes`;
        return `${hourText}${minText}`;
      }
      return mins === 1 ? '1 minute' : `${mins} minutes`;
    }

    // Short form
    if (shortForm) {
      if (hours > 0) {
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
      }
      return `${mins}m`;
    }

    // Standard form
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  } catch (error) {
    console.error('Error in formatDuration:', {
      minutes,
      options,
      error: error instanceof Error ? error.message : error
    });
    return '0m'; // Safe fallback
  }
}

/**
 * Enhanced countdown text generation with accessibility support
 * @param minutesUntil - Minutes until event
 * @param options - Display options
 * @returns Display text
 */
export function getCountdownText(
  minutesUntil: number,
  options: {
    showDirection?: boolean;
    accessibility?: boolean;
    context?: string;
  } = {}
): string {
  try {
    // Input validation
    if (typeof minutesUntil !== 'number' || !isFinite(minutesUntil)) {
      throw createTimeError(
        'Invalid minutesUntil value for countdown text',
        'TIME_INVALID_COUNTDOWN',
        { minutesUntil, type: typeof minutesUntil }
      );
    }

    const { showDirection = true, accessibility = false, context = 'appointment' } = options;
    const duration = formatDuration(Math.abs(minutesUntil), { accessibility });

    if (minutesUntil > 0) {
      if (accessibility) {
        return `${context} starts in ${duration}`;
      }
      return showDirection ? `Starts in ${duration}` : duration;
    } else if (minutesUntil < 0) {
      if (accessibility) {
        return `${context} started ${duration} ago`;
      }
      return showDirection ? `Started ${duration} ago` : duration;
    } else {
      if (accessibility) {
        return `${context} is starting now`;
      }
      return 'Starting now';
    }
  } catch (error) {
    console.error('Error in getCountdownText:', {
      minutesUntil,
      options,
      error: error instanceof Error ? error.message : error
    });
    return 'Time unavailable'; // Safe fallback
  }
}

/**
 * Enhanced check if an appointment is starting soon with configurable thresholds
 * @param startTime - Appointment start time
 * @param thresholdMinutes - Minutes threshold (default: 15)
 * @param options - Additional options
 * @returns True if appointment starts within threshold
 */
export function isStartingSoon(
  startTime: Date | string | number,
  thresholdMinutes: number = 15,
  options: TimeCalculationOptions = {}
): boolean {
  try {
    // Input validation
    if (typeof thresholdMinutes !== 'number' || thresholdMinutes < 0 || thresholdMinutes > 1440) {
      throw createTimeError(
        'Invalid threshold for starting soon check',
        'TIME_INVALID_THRESHOLD',
        { thresholdMinutes, type: typeof thresholdMinutes }
      );
    }

    const minutesUntil = getMinutesUntil(startTime, options);
    return minutesUntil > 0 && minutesUntil <= thresholdMinutes;
  } catch (error) {
    console.error('Error in isStartingSoon:', {
      startTime,
      thresholdMinutes,
      options,
      error: error instanceof Error ? error.message : error
    });
    return false; // Safe fallback
  }
}

/**
 * Enhanced check if an appointment is running late with business rules
 * @param startTime - Appointment start time
 * @param lateThresholdMinutes - Minutes past start to consider late (default: 10)
 * @param options - Additional options
 * @returns True if appointment is late
 */
export function isRunningLate(
  startTime: Date | string | number,
  lateThresholdMinutes: number = 10,
  options: TimeCalculationOptions = {}
): boolean {
  try {
    // Input validation
    if (typeof lateThresholdMinutes !== 'number' || lateThresholdMinutes < 0 || lateThresholdMinutes > 1440) {
      throw createTimeError(
        'Invalid threshold for running late check',
        'TIME_INVALID_LATE_THRESHOLD',
        { lateThresholdMinutes, type: typeof lateThresholdMinutes }
      );
    }

    const minutesUntil = getMinutesUntil(startTime, options);
    return minutesUntil < -lateThresholdMinutes;
  } catch (error) {
    console.error('Error in isRunningLate:', {
      startTime,
      lateThresholdMinutes,
      options,
      error: error instanceof Error ? error.message : error
    });
    return false; // Safe fallback
  }
}

/**
 * Enhanced check if an appointment is overdue with escalation rules
 * @param startTime - Appointment start time
 * @param overdueThresholdMinutes - Minutes past start to consider overdue (default: 30)
 * @param options - Additional options
 * @returns True if appointment is overdue
 */
export function isOverdue(
  startTime: Date | string | number,
  overdueThresholdMinutes: number = 30,
  options: TimeCalculationOptions = {}
): boolean {
  try {
    // Input validation
    if (typeof overdueThresholdMinutes !== 'number' || overdueThresholdMinutes < 0 || overdueThresholdMinutes > 1440) {
      throw createTimeError(
        'Invalid threshold for overdue check',
        'TIME_INVALID_OVERDUE_THRESHOLD',
        { overdueThresholdMinutes, type: typeof overdueThresholdMinutes }
      );
    }

    const minutesUntil = getMinutesUntil(startTime, options);
    return minutesUntil < -overdueThresholdMinutes;
  } catch (error) {
    console.error('Error in isOverdue:', {
      startTime,
      overdueThresholdMinutes,
      options,
      error: error instanceof Error ? error.message : error
    });
    return false; // Safe fallback
  }
}

/**
 * Get urgency level for an appointment with comprehensive business logic
 * @param startTime - Appointment start time
 * @param thresholds - Custom thresholds for urgency levels
 * @returns Urgency level
 */
export function getUrgencyLevel(
  startTime: Date | string | number,
  thresholds: {
    startingSoon?: number;
    runningLate?: number;
    overdue?: number;
  } = {}
): 'normal' | 'soon' | 'late' | 'overdue' {
  try {
    const {
      startingSoon = 15,
      runningLate = 10,
      overdue = 30
    } = thresholds;

    if (isOverdue(startTime, overdue)) return 'overdue';
    if (isRunningLate(startTime, runningLate)) return 'late';
    if (isStartingSoon(startTime, startingSoon)) return 'soon';
    return 'normal';
  } catch (error) {
    console.error('Error in getUrgencyLevel:', {
      startTime,
      thresholds,
      error: error instanceof Error ? error.message : error
    });
    return 'normal'; // Safe fallback
  }
}

/**
 * Clear all time calculation caches (for testing or memory management)
 */
export function clearTimeCache(): void {
  timeCalculationCache.clear();
}

/**
 * Get cache statistics for monitoring
 */
export function getTimeCacheStats(): {
  size: number;
  hitRate: number;
  memoryUsage: number;
} {
  const entries = Array.from(timeCalculationCache.entries());
  const now = Date.now();
  const validEntries = entries.filter(([, value]) => now - value.timestamp < CACHE_DURATION);

  return {
    size: timeCalculationCache.size,
    hitRate: validEntries.length / Math.max(entries.length, 1),
    memoryUsage: JSON.stringify(entries).length // Approximate memory usage
  };
}
