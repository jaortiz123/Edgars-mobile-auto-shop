/**
 * Date Utilities for Scheduling Intelligence
 *
 * Provides date manipulation and formatting utilities with robust error handling
 *
 * Features:
 * - Memory Management: No persistent state, all functions are pure
 * - Error Handling: Graceful handling of invalid dates
 * - Performance: Cached formatters, optimized calculations
 * - Type Safety: Runtime validation with fallbacks
 * - Security: Input sanitization for date strings
 * - Maintainability: Clear function signatures and documentation
 */

// Cached date formatters for performance
const dateFormatters = {
  date: new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }),
  time: new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }),
  dateTime: new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }),
  dayName: new Intl.DateTimeFormat('en-US', { weekday: 'long' }),
  shortDate: new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  })
};

/**
 * Validate and sanitize date input
 * @param {string|Date|number} input - Date input to validate
 * @returns {Date|null} - Valid Date object or null
 */
export function validateDate(input) {
  try {
    if (!input) return null;

    let date;

    if (input instanceof Date) {
      date = input;
    } else if (typeof input === 'string') {
      // Sanitize string input
      const sanitized = input.trim().replace(/[<>]/g, '');

      // Check for obviously invalid date strings
      if (sanitized.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // For YYYY-MM-DD format, validate components before parsing
        const parts = sanitized.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);

        if (month < 1 || month > 12) return null;
        if (day < 1 || day > 31) return null;

        // Check for February 30, April 31, etc.
        const testDate = new Date(sanitized);
        if (testDate.getFullYear() !== year ||
            testDate.getMonth() !== month - 1 ||
            testDate.getDate() !== day) {
          return null; // Date was auto-corrected, so it was invalid
        }

        date = testDate;
      } else {
        date = new Date(sanitized);
      }
    } else if (typeof input === 'number') {
      date = new Date(input);
    } else {
      return null;
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return null;
    }

    return date;

  } catch (error) {
    console.warn('Error validating date:', error);
    return null;
  }
}

/**
 * Check if a date is today
 * @param {Date|string} date - Date to check
 * @returns {boolean} - True if date is today
 */
export function isToday(date) {
  const validDate = validateDate(date);
  if (!validDate) return false;

  const today = new Date();
  return validDate.toDateString() === today.toDateString();
}

/**
 * Check if a date is tomorrow
 * @param {Date|string} date - Date to check
 * @returns {boolean} - True if date is tomorrow
 */
export function isTomorrow(date) {
  const validDate = validateDate(date);
  if (!validDate) return false;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return validDate.toDateString() === tomorrow.toDateString();
}

/**
 * Check if a date is in the past
 * @param {Date|string} date - Date to check
 * @returns {boolean} - True if date is in the past
 */
export function isPast(date) {
  const validDate = validateDate(date);
  if (!validDate) return false;

  const now = new Date();
  return validDate < now;
}

/**
 * Check if a date is in business hours
 * @param {Date|string} date - Date to check
 * @param {Object} businessHours - Business hours config
 * @returns {boolean} - True if date is in business hours
 */
export function isInBusinessHours(date, businessHours = { start: 8, end: 17 }) {
  const validDate = validateDate(date);
  if (!validDate) return false;

  const hour = validDate.getHours();
  return hour >= businessHours.start && hour < businessHours.end;
}

/**
 * Format date for display
 * @param {Date|string} date - Date to format
 * @param {string} format - Format type ('date', 'time', 'dateTime', 'dayName', 'shortDate')
 * @returns {string} - Formatted date string
 */
export function formatDate(date, format = 'date') {
  const validDate = validateDate(date);
  if (!validDate) return 'Invalid Date';

  try {
    const formatter = dateFormatters[format];
    if (!formatter) {
      console.warn(`Unknown date format: ${format}`);
      return validDate.toLocaleDateString();
    }

    return formatter.format(validDate);

  } catch (error) {
    console.warn('Error formatting date:', error);
    return validDate.toLocaleDateString();
  }
}

/**
 * Get relative date description
 * @param {Date|string} date - Date to describe
 * @returns {string} - Relative description (Today, Tomorrow, etc.)
 */
export function getRelativeDate(date) {
  const validDate = validateDate(date);
  if (!validDate) return 'Invalid Date';

  if (isToday(validDate)) return 'Today';
  if (isTomorrow(validDate)) return 'Tomorrow';

  const now = new Date();
  const daysDiff = Math.floor((validDate - now) / (1000 * 60 * 60 * 24));

  if (daysDiff < 0) {
    return `${Math.abs(daysDiff)} day${Math.abs(daysDiff) === 1 ? '' : 's'} ago`;
  } else if (daysDiff <= 7) {
    return formatDate(validDate, 'dayName');
  } else {
    return formatDate(validDate, 'shortDate');
  }
}

/**
 * Add days to a date
 * @param {Date|string} date - Base date
 * @param {number} days - Number of days to add
 * @returns {Date|null} - New date or null if invalid
 */
export function addDays(date, days) {
  const validDate = validateDate(date);
  if (!validDate || typeof days !== 'number') return null;

  const newDate = new Date(validDate);
  newDate.setDate(newDate.getDate() + days);
  return newDate;
}

/**
 * Add minutes to a date
 * @param {Date|string} date - Base date
 * @param {number} minutes - Number of minutes to add
 * @returns {Date|null} - New date or null if invalid
 */
export function addMinutes(date, minutes) {
  const validDate = validateDate(date);
  if (!validDate || typeof minutes !== 'number') return null;

  const newDate = new Date(validDate);
  newDate.setMinutes(newDate.getMinutes() + minutes);
  return newDate;
}

/**
 * Get the difference in minutes between two dates
 * @param {Date|string} date1 - First date
 * @param {Date|string} date2 - Second date
 * @returns {number|null} - Difference in minutes or null if invalid
 */
export function getMinutesDifference(date1, date2) {
  const validDate1 = validateDate(date1);
  const validDate2 = validateDate(date2);

  if (!validDate1 || !validDate2) return null;

  return Math.floor((validDate2 - validDate1) / (1000 * 60));
}

/**
 * Get the start of day for a date
 * @param {Date|string} date - Date to get start of day
 * @returns {Date|null} - Start of day or null if invalid
 */
export function getStartOfDay(date) {
  const validDate = validateDate(date);
  if (!validDate) return null;

  const startOfDay = new Date(validDate);
  startOfDay.setHours(0, 0, 0, 0);
  return startOfDay;
}

/**
 * Get the end of day for a date
 * @param {Date|string} date - Date to get end of day
 * @returns {Date|null} - End of day or null if invalid
 */
export function getEndOfDay(date) {
  const validDate = validateDate(date);
  if (!validDate) return null;

  const endOfDay = new Date(validDate);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay;
}

/**
 * Get date range for a number of days
 * @param {Date|string} startDate - Starting date
 * @param {number} numberOfDays - Number of days in range
 * @returns {Array|null} - Array of dates or null if invalid
 */
export function getDateRange(startDate, numberOfDays) {
  const validStartDate = validateDate(startDate);
  if (!validStartDate || typeof numberOfDays !== 'number' || numberOfDays < 1) {
    return null;
  }

  const dates = [];
  for (let i = 0; i < numberOfDays; i++) {
    const date = addDays(validStartDate, i);
    if (date) {
      dates.push(date);
    }
  }

  return dates;
}

/**
 * Parse time string to hours and minutes
 * @param {string} timeString - Time string (e.g., "2:30 PM")
 * @returns {Object|null} - {hours, minutes} or null if invalid
 */
export function parseTimeString(timeString) {
  try {
    if (!timeString || typeof timeString !== 'string') return null;

    // Sanitize input
    const sanitized = timeString.trim().replace(/[<>]/g, '');

    // Match time patterns
    const timePattern = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i;
    const match = sanitized.match(timePattern);

    if (!match) return null;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3] ? match[3].toUpperCase() : null;

    // Validate ranges
    if (minutes < 0 || minutes > 59) return null;

    if (ampm) {
      // 12-hour format
      if (hours < 1 || hours > 12) return null;
      if (ampm === 'PM' && hours !== 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
    } else {
      // 24-hour format
      if (hours < 0 || hours > 23) return null;
    }

    return { hours, minutes };

  } catch (error) {
    console.warn('Error parsing time string:', error);
    return null;
  }
}

/**
 * Create date from date string and time string
 * @param {string} dateString - Date string (YYYY-MM-DD)
 * @param {string} timeString - Time string (HH:MM AM/PM)
 * @returns {Date|null} - Combined date or null if invalid
 */
export function combineDateAndTime(dateString, timeString) {
  const baseDate = validateDate(dateString);
  if (!baseDate) return null;

  const timeObj = parseTimeString(timeString);
  if (!timeObj) return null;

  const combinedDate = new Date(baseDate);
  combinedDate.setHours(timeObj.hours, timeObj.minutes, 0, 0);

  return combinedDate;
}

/**
 * Get business days between two dates
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @returns {number} - Number of business days
 */
export function getBusinessDaysBetween(startDate, endDate) {
  const validStart = validateDate(startDate);
  const validEnd = validateDate(endDate);

  if (!validStart || !validEnd || validStart > validEnd) return 0;

  let businessDays = 0;
  const currentDate = new Date(validStart);

  while (currentDate <= validEnd) {
    const dayOfWeek = currentDate.getDay();
    // Monday = 1, Friday = 5
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      businessDays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return businessDays;
}

/**
 * Round time to nearest interval
 * @param {Date|string} date - Date to round
 * @param {number} intervalMinutes - Interval in minutes (default 15)
 * @returns {Date|null} - Rounded date or null if invalid
 */
export function roundToNearestInterval(date, intervalMinutes = 15) {
  const validDate = validateDate(date);
  if (!validDate || typeof intervalMinutes !== 'number' || intervalMinutes <= 0) {
    return null;
  }

  const roundedDate = new Date(validDate);
  const minutes = roundedDate.getMinutes();
  const roundedMinutes = Math.round(minutes / intervalMinutes) * intervalMinutes;

  roundedDate.setMinutes(roundedMinutes, 0, 0);

  return roundedDate;
}

/**
 * Check if a date is a weekend (Saturday or Sunday)
 * @param {Date|string} date - Date to check
 * @returns {boolean} - True if weekend
 */
export function isWeekend(date) {
  const validDate = validateDate(date);
  if (!validDate) return false;
  const day = validDate.getDay(); // Use local time to match test expectations
  return day === 0 || day === 6;
}

/**
 * Check if a date is a US holiday (Jan 1, July 4, Dec 25)
 * @param {Date|string} date - Date to check
 * @returns {boolean} - True if holiday
 */
export function isHoliday(date) {
  const validDate = validateDate(date);
  if (!validDate) return false;
  const month = validDate.getMonth(); // Use local time to match test expectations
  const day = validDate.getDate();
  // US holidays: Jan 1, July 4, Dec 25
  return (
    (month === 0 && day === 1) ||
    (month === 6 && day === 4) ||
    (month === 11 && day === 25)
  );
}

/**
 * Parse appointment time string to Date object
 * @param {string} timeString - Time string to parse
 * @returns {Date|null} - Parsed date or null if invalid
 */
export function parseAppointmentTime(timeString) {
  if (!timeString || typeof timeString !== 'string') return null;

  try {
    const parsed = new Date(timeString);
    if (isNaN(parsed.getTime())) return null;

    // Additional validation using our stricter validateDate
    return validateDate(parsed);
  } catch (error) {
    return null;
  }
}
