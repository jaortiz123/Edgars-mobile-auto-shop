import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a human-friendly duration string into minutes.
 * Supported examples: "1h", "1h 30m", "90m", "1 hour", "1.5 hours", "45"
 * Returns a rounded integer number of minutes. Falls back to 60 minutes on invalid input.
 */
export function parseDurationToMinutes(input: string): number {
  try {
    if (!input || typeof input !== 'string') return 60;
    const s = input.trim().toLowerCase();

    // Combined patterns: allow forms like "1h30m" or "1 h 30 m"
    const combined = s.match(/(\d+(?:\.\d+)?)\s*h(?:ours?)?\s*(?:[:\-\/\s]+)?\s*(\d+(?:\.\d+)?)\s*m(?:in(?:utes?)?)?/);
    if (combined) {
      const hours = parseFloat(combined[1]);
      const minutes = parseFloat(combined[2] || '0');
      return Math.round(hours * 60 + minutes);
    }

    // Hours only: "1.5h" or "1.5 hours"
    const hoursOnly = s.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?)?$/);
    if (hoursOnly) {
      return Math.round(parseFloat(hoursOnly[1]) * 60);
    }

    // Minutes only: "90m", "45 min", or plain number interpreted as minutes
    const minutesOnly = s.match(/^(\d+(?:\.\d+)?)\s*m(?:in(?:utes?)?)?$/);
    if (minutesOnly) {
      return Math.round(parseFloat(minutesOnly[1]));
    }

    const plainNumber = s.match(/^(\d+(?:\.\d+)?)$/);
    if (plainNumber) {
      return Math.round(parseFloat(plainNumber[1]));
    }

    // More verbose forms like "1 hour" or "30 minutes"
    const hourVerbose = s.match(/^(\d+(?:\.\d+)?)\s*hours?$/);
    if (hourVerbose) return Math.round(parseFloat(hourVerbose[1]) * 60);
    const minuteVerbose = s.match(/^(\d+(?:\.\d+)?)\s*minutes?$/);
    if (minuteVerbose) return Math.round(parseFloat(minuteVerbose[1]));

    // If nothing matched, attempt to extract any numbers and guess minutes
    const nums = s.match(/\d+(?:\.\d+)?/g);
    if (nums && nums.length === 1) return Math.round(parseFloat(nums[0]));

    // Fallback
    return 60;
  } catch (error) {
    // On unexpected errors, log once and return safe default
    // eslint-disable-next-line no-console
    console.error('parseDurationToMinutes error for input:', input, error);
    return 60;
  }
}
