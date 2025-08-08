// Enhanced utility functions for Sprint 2B robustness improvements
import { Appointment } from '../types/appointment';

/**
 * Type guard to check if an object is a valid appointment
 */
export function isValidAppointment(obj: any): obj is Appointment {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.customer_name === 'string' &&
    typeof obj.service === 'string' &&
    typeof obj.requested_time === 'string' &&
    typeof obj.status === 'string'
  );
}

/**
 * Safely parse an appointment date with fallback
 */
export function parseAppointmentDate(scheduledAt?: string, requestedTime?: string): Date {
  try {
    const timeString = scheduledAt || requestedTime;
    if (!timeString) {
      console.warn('No appointment time provided, using current time');
      return new Date();
    }
    
    const parsed = new Date(timeString);
    if (isNaN(parsed.getTime())) {
      console.warn('Invalid appointment time:', timeString, 'using current time');
      return new Date();
    }
    
    return parsed;
  } catch (error) {
    console.error('Error parsing appointment time:', error);
    return new Date();
  }
}

/**
 * Validate and clean appointment data
 */
export function validateAppointment(appointment: any): Appointment | null {
  try {
    if (!isValidAppointment(appointment)) {
      console.warn('Invalid appointment object:', appointment);
      return null;
    }

    // Ensure required fields have valid values
    const cleaned: Appointment = {
      id: appointment.id || '',
      customer_name: appointment.customer_name || 'Unknown Customer',
      service: appointment.service || 'Unknown Service',
      requested_time: appointment.requested_time || new Date().toISOString(),
      status: appointment.status || 'pending',
      customer_phone: appointment.customer_phone || undefined,
      scheduled_at: appointment.scheduled_at || undefined,
      location_address: appointment.location_address || undefined,
      notes: appointment.notes || undefined,
      price: typeof appointment.price === 'number' ? appointment.price : undefined
    };

    return cleaned;
  } catch (error) {
    console.error('Error validating appointment:', error);
    return null;
  }
}

/**
 * Safely process an array of appointments
 */
export function validateAppointments(appointments: any[]): Appointment[] {
  if (!Array.isArray(appointments)) {
    console.warn('Invalid appointments array:', appointments);
    return [];
  }

  return appointments
    .map(validateAppointment)
    .filter((apt): apt is Appointment => apt !== null);
}

/**
 * Calculate urgency priority with error handling
 */
export function calculateUrgencyPriority(
  time: Date, 
  todayStr: string,
  urgencyThresholds = { overdue: -30, runningLate: -5, startingSoon: 30 }
): number {
  try {
    const now = new Date();
    const diffMinutes = (time.getTime() - now.getTime()) / (1000 * 60);
    
    if (diffMinutes < urgencyThresholds.overdue) return 4; // Overdue
    if (diffMinutes < urgencyThresholds.runningLate) return 3; // Running late
    if (diffMinutes <= urgencyThresholds.startingSoon && diffMinutes > 0) return 2; // Starting soon
    if (time.toDateString() === todayStr) return 1; // Today
    return 0; // Normal
  } catch (error) {
    console.error('Error calculating urgency priority:', error);
    return 0;
  }
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Safe local storage operations
 */
export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return null;
    }
  },
  
  setItem: (key: string, value: string): boolean => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error('Error writing to localStorage:', error);
      return false;
    }
  },
  
  removeItem: (key: string): boolean => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Error removing from localStorage:', error);
      return false;
    }
  }
};

/**
 * Check if a value is empty (null, undefined, empty string, empty array)
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Format error messages for user display
 */
export function formatErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
  if (error instanceof Error) {
    return error.message || fallback;
  }
  if (typeof error === 'string') {
    return error || fallback;
  }
  return fallback;
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}
