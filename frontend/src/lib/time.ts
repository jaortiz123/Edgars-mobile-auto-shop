// filepath: /Users/jesusortiz/Edgars-mobile-auto-shop/frontend/src/lib/time.ts
/**
 * Time utility functions for greetings and time-based interactions
 */

/**
 * Get appropriate greeting based on current time
 * @returns Greeting string based on time of day
 */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) {
    return 'Good Morning';
  }
  if (hour < 18) {
    return 'Good Afternoon';
  }
  return 'Good Evening';
}

/**
 * Check if a time is within a certain range in minutes
 * @param arrivalTime - The time to check
 * @param minutes - The range in minutes
 * @returns True if time is within range
 */
export function isWithin(arrivalTime: Date | string, minutes: number): boolean {
  const now = new Date();
  const arrival = new Date(arrivalTime);
  const diff = arrival.getTime() - now.getTime();
  return diff > 0 && diff < minutes * 60 * 1000;
}

/**
 * Calculate minutes past a given time
 * @param startTime - The reference time
 * @returns Minutes past the time (positive if in the past)
 */
export function minutesPast(startTime: Date | string): number {
  const now = new Date();
  const start = new Date(startTime);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / 60000);
}

/**
 * Calculate minutes until a given target time
 * @param targetTime - The target time
 * @returns Minutes until target time (negative if in the past)
 */
export function getMinutesUntil(targetTime: Date | string): number {
  const now = new Date();
  const target = new Date(targetTime);
  const diff = target.getTime() - now.getTime();
  return Math.round(diff / 60000);
}
