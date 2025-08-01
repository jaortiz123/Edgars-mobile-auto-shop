import '@testing-library/jest-dom/vitest'
import 'whatwg-fetch'

import { expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { toHaveNoViolations } from 'jest-axe'
import { cleanup } from '@testing-library/react'
import { restoreConsole } from './testEnv'

// CI-STRICT-001: Fail tests on console.error/warn (ROBUSTNESS ENHANCED)
beforeAll(() => {
  const origError = console.error;
  const origWarn = console.warn;
  
  /**
   * Create a robust console override that handles edge cases safely
   */
  const createSafeConsoleOverride = (level: 'error' | 'warn') => {
    return (...args: unknown[]) => {
      try {
        // Track seen objects for circular reference detection
        const seen = new WeakSet<object>();
        
        // Safe argument processing with comprehensive error handling
        const safeArgs = args.map((arg) => {
          if (arg === null) return 'null';
          if (arg === undefined) return 'undefined';
          if (typeof arg === 'string') return arg;
          if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
          
          // Handle objects and complex types safely
          if (typeof arg === 'object' && arg !== null) {
            try {
              // Try JSON.stringify first (handles most objects)
              return JSON.stringify(arg, (key, value) => {
                // Handle circular references
                if (typeof value === 'object' && value !== null) {
                  if (seen.has(value)) return '[Circular Reference]';
                  seen.add(value);
                }
                return value;
              }, 2);
            } catch {
              try {
                // Fallback to toString if JSON fails
                return String(arg);
              } catch {
                // Last resort: describe the object safely
                return `[Object of type ${Object.prototype.toString.call(arg)} - toString failed]`;
              }
            }
          }
          
          // Handle functions and other types
          try {
            return String(arg);
          } catch {
            return `[${typeof arg} - conversion failed]`;
          }
        });
        
        // Create error with enhanced context
        const message = safeArgs.join(' ');
        const error = new Error(`console.${level}: ${message}`);
        
        // Preserve stack trace for better debugging
        if (Error.captureStackTrace) {
          Error.captureStackTrace(error, createSafeConsoleOverride);
        }
        
        throw error;
      } catch (processingError) {
        // Graceful degradation: if our processing fails, still fail the test
        const errorMessage = processingError instanceof Error ? processingError.message : 'Unknown error';
        throw new Error(`console.${level}: [CI-STRICT-001 Error: ${errorMessage}] - Original console call failed processing`);
      }
    };
  };
  
  // Apply robust console overrides
  console.error = createSafeConsoleOverride('error');
  console.warn = createSafeConsoleOverride('warn');
  
  // Store originals for potential restoration if needed (backward compatibility)
  const globals = globalThis as typeof globalThis & {
    __originalConsole?: {
      error: typeof console.error;
      warn: typeof console.warn;
    };
  };
  
  globals.__originalConsole = {
    error: origError,
    warn: origWarn
  };
});

// Extend expect with accessibility matchers
expect.extend(toHaveNoViolations)

// Auto cleanup after each test
beforeEach(() => {
  cleanup()
})

// DESIGN-SYSTEM-001: Complete JSDOM CSS Environment Setup
beforeAll(() => {
  // Inject all CSS variables into JSDOM root element
  const root = document.documentElement;
  
  // Typography Scale CSS Variables
  root.style.setProperty('--fs-0', '0.75rem');    // 12px - Captions, fine print
  root.style.setProperty('--fs-1', '0.875rem');   // 14px - Small text, labels
  root.style.setProperty('--fs-2', '1rem');       // 16px - Body text (base)
  root.style.setProperty('--fs-3', '1.25rem');    // 20px - Small headings, lead text
  root.style.setProperty('--fs-4', '1.5rem');     // 24px - Medium headings
  root.style.setProperty('--fs-5', '2rem');       // 32px - Large headings
  root.style.setProperty('--fs-6', '2.5rem');     // 40px - Hero headings
  
  // Line Heights
  root.style.setProperty('--lh-tight', '1.25');   // Headings
  root.style.setProperty('--lh-normal', '1.5');   // Body text
  root.style.setProperty('--lh-relaxed', '1.75'); // Large text blocks
  
  // Font Weights
  root.style.setProperty('--fw-normal', '400');
  root.style.setProperty('--fw-medium', '500');
  root.style.setProperty('--fw-semibold', '600');
  root.style.setProperty('--fw-bold', '700');
  
  // Spacing Scale CSS Variables
  root.style.setProperty('--sp-0', '0');
  root.style.setProperty('--sp-1', '0.5rem');  // 8px
  root.style.setProperty('--sp-2', '1rem');    // 16px
  root.style.setProperty('--sp-3', '1.5rem');  // 24px
  root.style.setProperty('--sp-4', '2rem');    // 32px
  root.style.setProperty('--sp-5', '2.5rem');  // 40px
  root.style.setProperty('--sp-6', '3rem');    // 48px
  root.style.setProperty('--sp-8', '4rem');    // 64px
  
  // Component Specific Variables
  root.style.setProperty('--card-padding', 'var(--sp-3)');
  root.style.setProperty('--card-gap', 'var(--sp-2)');
  root.style.setProperty('--button-padding-y', 'var(--sp-2)');
  root.style.setProperty('--button-padding-x', 'var(--sp-3)');
  
  // Shadow System
  root.style.setProperty('--card-shadow-default', '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)');
  root.style.setProperty('--card-shadow-hover', '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)');
  root.style.setProperty('--card-shadow-focus', '0 0 0 2px rgba(59, 130, 246, 0.5)');
  root.style.setProperty('--card-shadow-urgent', '0 0 0 2px rgba(239, 68, 68, 0.3), 0 1px 3px 0 rgba(0, 0, 0, 0.1)');
  root.style.setProperty('--card-shadow-warning', '0 0 0 2px rgba(245, 158, 11, 0.3), 0 1px 3px 0 rgba(0, 0, 0, 0.1)');
  
  // Accessibility Variables
  root.style.setProperty('--focus-outline-width', '2px');
  root.style.setProperty('--focus-outline-offset', '2px');
  root.style.setProperty('--focus-outline-color', 'rgba(59, 130, 246, 0.6)');
  root.style.setProperty('--min-touch-target', '44px');
  
  // Animation Variables
  root.style.setProperty('--animation-duration', '0.2s');
  root.style.setProperty('--animation-easing', 'ease-in-out');
  
  // Mock getComputedStyle globally to return our CSS variables
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = (el: Element, pseudoElement?: string | null) => {
    // Create a mock CSS style object with our predefined variables
    const cssVariables = {
      // Typography
      '--fs-0': root.style.getPropertyValue('--fs-0') || '0.75rem',
      '--fs-1': root.style.getPropertyValue('--fs-1') || '0.875rem',
      '--fs-2': root.style.getPropertyValue('--fs-2') || '1rem',
      '--fs-3': root.style.getPropertyValue('--fs-3') || '1.25rem',
      '--fs-4': root.style.getPropertyValue('--fs-4') || '1.5rem',
      '--fs-5': root.style.getPropertyValue('--fs-5') || '2rem',
      '--fs-6': root.style.getPropertyValue('--fs-6') || '2.5rem',
      
      // Line Heights
      '--lh-tight': root.style.getPropertyValue('--lh-tight') || '1.25',
      '--lh-normal': root.style.getPropertyValue('--lh-normal') || '1.5',
      '--lh-relaxed': root.style.getPropertyValue('--lh-relaxed') || '1.75',
      
      // Font Weights
      '--fw-normal': root.style.getPropertyValue('--fw-normal') || '400',
      '--fw-medium': root.style.getPropertyValue('--fw-medium') || '500',
      '--fw-semibold': root.style.getPropertyValue('--fw-semibold') || '600',
      '--fw-bold': root.style.getPropertyValue('--fw-bold') || '700',
      
      // Spacing
      '--sp-0': root.style.getPropertyValue('--sp-0') || '0',
      '--sp-1': root.style.getPropertyValue('--sp-1') || '0.5rem',
      '--sp-2': root.style.getPropertyValue('--sp-2') || '1rem',
      '--sp-3': root.style.getPropertyValue('--sp-3') || '1.5rem',
      '--sp-4': root.style.getPropertyValue('--sp-4') || '2rem',
      '--sp-5': root.style.getPropertyValue('--sp-5') || '2.5rem',
      '--sp-6': root.style.getPropertyValue('--sp-6') || '3rem',
      '--sp-8': root.style.getPropertyValue('--sp-8') || '4rem',
      
      // Component Variables
      '--card-padding': root.style.getPropertyValue('--card-padding') || '1.5rem',
      '--card-gap': root.style.getPropertyValue('--card-gap') || '1rem',
      '--button-padding-y': root.style.getPropertyValue('--button-padding-y') || '1rem',
      '--button-padding-x': root.style.getPropertyValue('--button-padding-x') || '1.5rem',
      
      // Shadows
      '--card-shadow-default': root.style.getPropertyValue('--card-shadow-default') || '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      '--card-shadow-hover': root.style.getPropertyValue('--card-shadow-hover') || '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      '--card-shadow-focus': root.style.getPropertyValue('--card-shadow-focus') || '0 0 0 2px rgba(59, 130, 246, 0.5)',
      
      // Accessibility
      '--focus-outline-width': root.style.getPropertyValue('--focus-outline-width') || '2px',
      '--focus-outline-offset': root.style.getPropertyValue('--focus-outline-offset') || '2px',
      '--focus-outline-color': root.style.getPropertyValue('--focus-outline-color') || 'rgba(59, 130, 246, 0.6)',
      '--min-touch-target': root.style.getPropertyValue('--min-touch-target') || '44px',
      
      // Animation
      '--animation-duration': root.style.getPropertyValue('--animation-duration') || '0.2s',
      '--animation-easing': root.style.getPropertyValue('--animation-easing') || 'ease-in-out'
    };
    
    // Create enhanced CSSStyleDeclaration object with proper properties
    const htmlEl = el as HTMLElement;
    const enhancedStyle = {
      // Essential CSS properties for testing - safely access style properties
      fontSize: (htmlEl.style?.fontSize) || '16px',
      lineHeight: (htmlEl.style?.lineHeight) || '1.5',
      fontWeight: (htmlEl.style?.fontWeight) || '400',
      outlineWidth: (htmlEl.style?.outlineWidth) || '2px',
      margin: (htmlEl.style?.margin) || '8px',
      padding: (htmlEl.style?.padding) || '8px',
      width: (htmlEl.style?.width) || 'auto',
      height: (htmlEl.style?.height) || 'auto',
      // Return our CSS variables when requested
      getPropertyValue: (prop: string) => {
        // Return our CSS variables if requested
        if (cssVariables[prop as keyof typeof cssVariables]) {
          return cssVariables[prop as keyof typeof cssVariables];
        }
        // Return basic style properties
        if (prop === 'font-size') return enhancedStyle.fontSize;
        if (prop === 'line-height') return enhancedStyle.lineHeight;
        if (prop === 'font-weight') return enhancedStyle.fontWeight;
        if (prop === 'outline-width') return enhancedStyle.outlineWidth;
        if (prop === 'margin') return enhancedStyle.margin;
        if (prop === 'padding') return enhancedStyle.padding;
        if (prop === 'width') return enhancedStyle.width;
        if (prop === 'height') return enhancedStyle.height;
        // Fallback
        return '';
      }
    };
    
    return enhancedStyle as CSSStyleDeclaration;
  };
  
  // Stub performance APIs for design system monitoring
  const originalPerformance = window.performance;
  window.performance = {
    ...originalPerformance,
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
    getEntriesByName: vi.fn(() => []),
    getEntriesByType: vi.fn(() => []),
    navigation: originalPerformance.navigation,
    timing: originalPerformance.timing
  } as unknown as Performance;
  
  // Stub PerformanceObserver if needed
  if (!window.PerformanceObserver) {
    window.PerformanceObserver = class MockPerformanceObserver {
      constructor(public callback: PerformanceObserverCallback) {}
      observe() {}
      disconnect() {}
      takeRecords() { return []; }
    } as unknown as typeof PerformanceObserver;
  }
});

// MOCK-FACTORY-001: Complete MockFactory API implementation
import { createMocks } from './mocks';
const { notification, api } = createMocks();

// Apply centralized mocks to avoid circular dependencies
vi.mock('@/utils/time', () => ({
  getCountdownText: vi.fn().mockImplementation((startTime: Date | string | number, _options = {}) => {
    console.log('🔧 DIRECT MOCK: getCountdownText called with startTime:', startTime);
    const date = typeof startTime === 'string' || typeof startTime === 'number' ? new Date(startTime) : startTime;
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const minutesUntil = Math.floor(diffMs / (1000 * 60));
    
    if (minutesUntil > 0) {
      return `in ${minutesUntil}m`;
    } else if (minutesUntil < 0) {
      return `${Math.abs(minutesUntil)}m ago`;
    } else {
      return 'now';
    }
  }),
  
  minutesPast: vi.fn().mockImplementation((time: Date | string | number, _options = {}) => {
    console.log('🔧 DIRECT MOCK: minutesPast called with time:', time);
    const date = typeof time === 'string' || typeof time === 'number' ? new Date(time) : time;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return Math.max(0, diffMinutes);
  }),
  
  getMinutesUntil: vi.fn().mockImplementation((startTime: Date | string | number, _options = {}) => {
    console.log('🔧 DIRECT MOCK: getMinutesUntil called with startTime:', startTime);
    const date = typeof startTime === 'string' || typeof startTime === 'number' ? new Date(startTime) : startTime;
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const result = Math.floor(diffMs / (1000 * 60));
    console.log('🔧 DIRECT MOCK: getMinutesUntil result:', result);
    return result;
  }),
  
  isStartingSoon: vi.fn().mockImplementation((startTime: Date | string | number, thresholdMinutes = 15, _options = {}) => {
    console.log('🔧 DIRECT MOCK: isStartingSoon called with startTime:', startTime, 'thresholdMinutes:', thresholdMinutes);
    const date = typeof startTime === 'string' || typeof startTime === 'number' ? new Date(startTime) : startTime;
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const minutesUntil = Math.floor(diffMs / (1000 * 60));
    const result = minutesUntil > 0 && minutesUntil <= thresholdMinutes;
    console.log('🔧 DIRECT MOCK: isStartingSoon result:', result, 'minutesUntil:', minutesUntil);
    return result;
  }),
  
  isRunningLate: vi.fn().mockImplementation((startTime: Date | string | number, lateThresholdMinutes = 10, _options = {}) => {
    console.log('🔧 DIRECT MOCK: isRunningLate called with startTime:', startTime, 'lateThresholdMinutes:', lateThresholdMinutes);
    const date = typeof startTime === 'string' || typeof startTime === 'number' ? new Date(startTime) : startTime;
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const minutesUntil = Math.floor(diffMs / (1000 * 60));
    const result = minutesUntil < 0 && minutesUntil >= -lateThresholdMinutes;
    console.log('🔧 DIRECT MOCK: isRunningLate result:', result, 'minutesUntil:', minutesUntil);
    return result;
  }),
  
  isOverdue: vi.fn().mockImplementation((startTime: Date | string | number, overdueThresholdMinutes = 30, _options = {}) => {
    console.log('🔧 DIRECT MOCK: isOverdue called with startTime:', startTime, 'overdueThresholdMinutes:', overdueThresholdMinutes);
    const date = typeof startTime === 'string' || typeof startTime === 'number' ? new Date(startTime) : startTime;
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const minutesUntil = Math.floor(diffMs / (1000 * 60));
    const result = minutesUntil < -overdueThresholdMinutes;
    console.log('🔧 DIRECT MOCK: isOverdue result:', result, 'minutesUntil:', minutesUntil);
    return result;
  }),
  
  // Add other functions that might be imported
  formatDuration: vi.fn().mockReturnValue('1h 30m'),
  getUrgencyLevel: vi.fn().mockReturnValue('normal'),
  clearTimeCache: vi.fn(),
  getTimeCacheStats: vi.fn().mockReturnValue({ size: 0, hitRate: 1, memoryUsage: 0 })
}));

vi.mock('@/services/notificationService', () => notification);
vi.mock('@/lib/api', () => api);

// Note: Global vi.mock declarations replaced with centralized mock factory.
// Tests should now use createTestMocks() directly for dependency injection.
// Example: const { api, time, notification } = createTestMocks();

// Mock performance monitoring service
vi.mock('@/services/performanceMonitoring', () => ({
  default: {
    generateReport: vi.fn(() => ({
      overall: { score: 85, grade: 'B', recommendations: [] },
      memory: { pressure: 'low' },
      network: { online: true, rtt: 50 },
      notifications: { sent: 0, failed: 0 }
    })),
    trackComponent: vi.fn(),
    startMeasurement: vi.fn(() => vi.fn()),
  },
  usePerformanceMonitoring: vi.fn(() => ({
    trackUpdate: vi.fn(),
    trackError: vi.fn(),
    measure: vi.fn(() => vi.fn()),
  })),
}));

// Mock offline support service
vi.mock('@/services/offlineSupport', () => ({
  default: {
    getState: vi.fn(() => ({ 
      isOnline: true, 
      queuedActions: [], 
      lastSync: new Date() 
    })),
    addAction: vi.fn(),
    processQueue: vi.fn(),
  },
}));

// Mock authService to prevent initialization failures
vi.mock('@/services/authService', () => ({
  authService: {
    isLoggedIn: vi.fn(() => false),
    parseToken: vi.fn(() => null),
    getProfile: vi.fn(async () => null),
    clearToken: vi.fn(),
    shouldRefreshToken: vi.fn(() => false),
    login: vi.fn(async () => {}),
    register: vi.fn(async () => {}),
    updateProfile: vi.fn(async () => {}),
  },
  AuthError: class AuthError extends Error { constructor(message: string) { super(message); } },
  NetworkError: class NetworkError extends Error { constructor(message: string) { super(message); } },
  ValidationError: class ValidationError extends Error { constructor(message: string) { super(message); } },
}));

// Apply browser API mocks globally in beforeAll
beforeAll(() => {
  // Note: Mock factory globals removed to prevent circular dependencies
  // Individual tests should use createTestMocks() for dependency injection
  // setupCleanConsole(); // Commented out because CI-STRICT-001 overrides console methods
});

// Enhanced JSDOM environment setup (fallback for any missing mocks)
if (!global.ResizeObserver) {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// IntersectionObserver fallback
if (!global.IntersectionObserver) {
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
    get root() { return null; }
    get rootMargin() { return '0px'; }
    get thresholds() { return []; }
    takeRecords() { return []; }
  };
}

// Enhanced matchMedia mock for responsive design testing
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: query.includes('max-width: 768px'), // Default mobile breakpoint
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn().mockReturnValue(false)
  } as MediaQueryList);
}

// createRange stub for editors and portals
if (!document.createRange) {
  document.createRange = () => ({
    setStart: () => {},
    setEnd: () => {},
    commonAncestorContainer: document.body,
    createContextualFragment: (html: string) => {
      const template = document.createElement('template');
      template.innerHTML = html;
      return template.content;
    },
  } as Range);
}

// Navigation and scroll mocks
global.scrollTo = () => {};
global.scroll = () => {};

// Performance API mock for monitoring tests
if (!global.performance.mark) {
  global.performance.mark = vi.fn();
}
if (!global.performance.measure) {
  global.performance.measure = vi.fn();
}

// Enhanced console management using test environment utilities
afterAll(() => { 
  restoreConsole();
});
