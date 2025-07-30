/**
 * Time utility functions for appointment countdowns and scheduling
 */

/**
 * Calculate minutes until a given start time
 * @param startTime - The appointment start time
 * @returns Minutes until start time (negative if in the past)
 */
export function getMinutesUntil(startTime: Date | string): number {
  const now = new Date();
  const start = new Date(startTime);
  
  // Calculate difference in milliseconds, then convert to minutes
  const diffMs = start.getTime() - now.getTime();
  return Math.round(diffMs / (1000 * 60));
}

/**
 * Calculate minutes since a given time (positive for past times)
 * @param time - The reference time
 * @returns Minutes since the time (positive if in the past)
 */
export function minutesPast(time: Date | string): number {
  return -getMinutesUntil(time);
}

/**
 * Format minutes into a human-readable duration
 * @param minutes - Number of minutes
 * @returns Formatted duration string
 */
export function formatDuration(minutes: number): string {
  const absMinutes = Math.abs(minutes);
  const hours = Math.floor(absMinutes / 60);
  const mins = absMinutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

/**
 * Get display text for countdown
 * @param minutesUntil - Minutes until event
 * @returns Display text
 */
export function getCountdownText(minutesUntil: number): string {
  if (minutesUntil > 0) {
    return `Starts in ${formatDuration(minutesUntil)}`;
  } else {
    return `Started ${formatDuration(-minutesUntil)} ago`;
  }
}

/**
 * Check if an appointment is starting soon (within threshold)
 * @param startTime - Appointment start time
 * @param thresholdMinutes - Minutes threshold (default: 15)
 * @returns True if appointment starts within threshold
 */
export function isStartingSoon(startTime: Date | string, thresholdMinutes: number = 15): boolean {
  const minutesUntil = getMinutesUntil(startTime);
  return minutesUntil > 0 && minutesUntil <= thresholdMinutes;
}

/**
 * Check if an appointment is running late
 * @param startTime - Appointment start time
 * @param lateThresholdMinutes - Minutes past start to consider late (default: 10)
 * @returns True if appointment is late
 */
export function isRunningLate(startTime: Date | string, lateThresholdMinutes: number = 10): boolean {
  const minutesUntil = getMinutesUntil(startTime);
  return minutesUntil < -lateThresholdMinutes;
}

/**
 * Check if an appointment is overdue
 * @param startTime - Appointment start time
 * @param overdueThresholdMinutes - Minutes past start to consider overdue (default: 30)
 * @returns True if appointment is overdue
 */
export function isOverdue(startTime: Date | string, overdueThresholdMinutes: number = 30): boolean {
  const minutesUntil = getMinutesUntil(startTime);
  return minutesUntil < -overdueThresholdMinutes;
}
