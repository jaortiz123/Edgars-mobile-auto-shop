/**
 * Sprint 2A Authentication Robustness Utilities
 * Comprehensive utilities for robust authentication system implementation
 */

// Error Handling Utilities
export class AuthenticationError extends Error {
  constructor(message: string, public code?: string, public status?: number) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'NetworkError';
  }
}

// Token Management Utilities
export const tokenUtils = {
  /**
   * Safely encode/decode JWT tokens with error handling
   */
  safeDecodeToken: (token: string): Record<string, unknown> | null => {
    try {
      const payload = token.split('.')[1];
      if (!payload) return null;
      
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  },

  /**
   * Check if token is expired with buffer time
   */
  isTokenExpired: (token: string, bufferMinutes: number = 5): boolean => {
    const decoded = tokenUtils.safeDecodeToken(token);
    if (!decoded?.exp) return true;
    
    const now = Date.now() / 1000;
    const buffer = bufferMinutes * 60;
    return (decoded.exp as number) <= (now + buffer);
  },

  /**
   * Get time until token expiration
   */
  getTokenTimeToExpiry: (token: string): number => {
    const decoded = tokenUtils.safeDecodeToken(token);
    if (!decoded?.exp) return 0;
    
    const now = Date.now() / 1000;
    return Math.max(0, (decoded.exp as number) - now);
  }
};

// Form Validation Utilities
export const authValidation = {
  /**
   * Comprehensive email validation
   */
  validateEmail: (email: string): { isValid: boolean; error?: string } => {
    const trimmedEmail = email.trim();
    
    if (!trimmedEmail) {
      return { isValid: false, error: 'Email is required' };
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return { isValid: false, error: 'Please enter a valid email address' };
    }
    
    if (trimmedEmail.length > 254) {
      return { isValid: false, error: 'Email address is too long' };
    }
    
    return { isValid: true };
  },

  /**
   * Comprehensive password validation
   */
  validatePassword: (password: string): { 
    isValid: boolean; 
    errors: string[]; 
    strength: number;
    strengthText: string;
  } => {
    const errors: string[] = [];
    let strength = 0;
    
    if (!password) {
      return { 
        isValid: false, 
        errors: ['Password is required'], 
        strength: 0,
        strengthText: 'None'
      };
    }
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    } else {
      strength++;
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    } else {
      strength++;
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    } else {
      strength++;
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    } else {
      strength++;
    }
    
    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character');
    } else {
      strength++;
    }
    
    const strengthText = strength < 2 ? 'Weak' : 
                        strength < 4 ? 'Medium' : 'Strong';
    
    return {
      isValid: errors.length === 0 && strength >= 3,
      errors,
      strength,
      strengthText
    };
  },

  /**
   * Password confirmation validation
   */
  validatePasswordConfirmation: (password: string, confirmPassword: string): { 
    isValid: boolean; 
    error?: string 
  } => {
    if (!confirmPassword) {
      return { isValid: false, error: 'Please confirm your password' };
    }
    
    if (password !== confirmPassword) {
      return { isValid: false, error: 'Passwords do not match' };
    }
    
    return { isValid: true };
  }
};

// Storage Utilities with Error Handling
export const secureStorage = {
  /**
   * Safely get item from localStorage with error handling
   */
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn(`Failed to get item from localStorage: ${key}`, error);
      return null;
    }
  },

  /**
   * Safely set item in localStorage with error handling
   */
  setItem: (key: string, value: string): boolean => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error(`Failed to set item in localStorage: ${key}`, error);
      return false;
    }
  },

  /**
   * Safely remove item from localStorage with error handling
   */
  removeItem: (key: string): boolean => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`Failed to remove item from localStorage: ${key}`, error);
      return false;
    }
  }
};

// Network Request Utilities
export const networkUtils = {
  /**
   * Create a fetch request with timeout and error handling
   */
  createTimedFetch: (url: string, options: RequestInit = {}, timeoutMs: number = 10000): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    return fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }).finally(() => {
      clearTimeout(timeoutId);
    });
  },

  /**
   * Handle API errors with proper error types
   */
  handleApiError: async (response: Response): Promise<never> => {
    let errorMessage = 'An unexpected error occurred';
    
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      // If parsing JSON fails, use status text
      errorMessage = response.statusText || errorMessage;
    }
    
    if (response.status === 401) {
      throw new AuthenticationError(errorMessage, 'UNAUTHORIZED', 401);
    }
    
    if (response.status === 400) {
      throw new ValidationError(errorMessage);
    }
    
    if (response.status >= 500) {
      throw new NetworkError(`Server error: ${errorMessage}`);
    }
    
    throw new Error(errorMessage);
  }
};

// ID Generation Utilities
export const idUtils = {
  /**
   * Generate a robust unique ID using crypto API when available
   */
  generateId: (prefix: string = ''): string => {
    const timestamp = Date.now().toString(36);
    
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      const uuid = crypto.randomUUID();
      return prefix ? `${prefix}-${uuid}` : uuid;
    }
    
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      const randomStr = Array.from(array, byte => byte.toString(36)).join('');
      return prefix ? `${prefix}-${timestamp}-${randomStr}` : `${timestamp}-${randomStr}`;
    }
    
    // Fallback for environments without crypto
    const random = Math.random().toString(36).substr(2, 9);
    return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
  }
};

// Accessibility Utilities
export const a11yUtils = {
  /**
   * Generate accessible error messages
   */
  generateErrorMessage: (errors: string[]): string => {
    if (errors.length === 0) return '';
    if (errors.length === 1) return errors[0];
    
    return `Multiple errors: ${errors.join(', ')}`;
  },

  /**
   * Create ARIA attributes for form fields
   */
  createFieldAriaProps: (fieldId: string, error?: string, required: boolean = false) => ({
    'aria-invalid': error ? 'true' : 'false',
    'aria-describedby': error ? `${fieldId}-error` : undefined,
    'aria-required': required ? 'true' : 'false',
  }),

  /**
   * Create live region announcements for screen readers
   */
  announceToScreenReader: (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    liveRegion.textContent = message;
    
    document.body.appendChild(liveRegion);
    
    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(liveRegion);
    }, 1000);
  }
};

// Performance Utilities
export const performanceUtils = {
  /**
   * Debounce function for input validation
   */
  debounce: <T extends (...args: unknown[]) => unknown>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  /**
   * Throttle function for frequent events
   */
  throttle: <T extends (...args: unknown[]) => unknown>(
    func: T,
    limit: number
  ): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }
};

// Export all utilities
export default {
  AuthenticationError,
  ValidationError,
  NetworkError,
  tokenUtils,
  authValidation,
  secureStorage,
  networkUtils,
  idUtils,
  a11yUtils,
  performanceUtils,
};
