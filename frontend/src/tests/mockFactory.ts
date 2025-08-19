/**
 * Sprint 7 Task 4: Test Mock Factory
 * Centralized reusable mock implementations for comprehensive testing
 *
 * Features:
 * - Time utilities comprehensive mocking
 * - API service mock factory with realistic responses
 * - Browser API sophisticated mocking
 * - Performance measurement mocks
 * - Notification system mocks
 * - Cache and storage mocks
 */

import { vi, type MockedFunction } from 'vitest'
import type {
  MockTimeConfig,
  MockApiConfig,
  TestMockFactoryConfig,
  MockApiRequestParams,
  MockAppointmentData,
  MockIntersectionObserverOptions,
  MockGeolocationOptions,
  MockIntersectionObserverEntry,
  MockResizeObserverEntry,
  MockGeolocationPosition,
  MockGeolocationError,
  MockAppointmentStatus
} from '../types/test'

// ===============================
// TIME UTILITIES MOCK FACTORY
// ===============================

// Export test factory types
export type { TestMockFactoryConfig, MockTimeConfig, MockApiConfig } from '../types/test';

export function createTimeMocks(config: MockTimeConfig = {}) {
  const {
    fixedNow = new Date('2024-01-15T10:00:00Z'),
    autoAdvance = false,
    cacheEnabled = true
  } = config;

  let currentTime = fixedNow.getTime();
  const cache = new Map<string, { result: number; timestamp: number }>();

  // Helper function for getting minutes until
  const getMinutesUntilHelper = (startTime: Date | string | number) => {
    try {
      const start = new Date(startTime);
      const now = new Date(currentTime);
      return Math.round((start.getTime() - now.getTime()) / (1000 * 60));
    } catch {
      return 0;
    }
  };

  const timeMocks = {
    // Core time calculation functions
    getMinutesUntil: vi.fn(getMinutesUntilHelper),

    isStartingSoon: vi.fn((startTime: Date | string | number, thresholdMinutes = 15) => {
      const minutes = getMinutesUntilHelper(startTime);
      return minutes >= 0 && minutes <= thresholdMinutes;
    }),

    isRunningLate: vi.fn((startTime: Date | string | number, bufferMinutes = 5) => {
      const minutes = getMinutesUntilHelper(startTime);
      return minutes < 0 && minutes >= -bufferMinutes;
    }),

    isOverdue: vi.fn((startTime: Date | string | number, overdueMinutes = 15) => {
      const minutes = getMinutesUntilHelper(startTime);
      return minutes < -overdueMinutes;
    }),

    getUrgencyLevel: vi.fn((startTime: Date | string | number) => {
      const minutes = getMinutesUntilHelper(startTime);
      if (minutes < -15) return 'critical';
      if (minutes < 0) return 'high';
      if (minutes <= 15) return 'medium';
      return 'normal';
    }),

    formatDuration: vi.fn((minutes: number) => {
      if (minutes < 60) return `${minutes}m`;
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }),

    getCountdownText: vi.fn((minutes: number) => {
      if (minutes > 0) return `${minutes}m until start`;
      if (minutes === 0) return 'Starting now';
      return `${Math.abs(minutes)}m overdue`;
    }),

    minutesPast: vi.fn((time: Date | string | number) => {
      try {
        const target = new Date(time);
        const now = new Date(currentTime);
        return Math.round((now.getTime() - target.getTime()) / (1000 * 60));
      } catch {
        return 0;
      }
    }),

    // Cache management functions
    clearTimeCache: vi.fn(() => {
      cache.clear();
    }),

    getTimeCacheStats: vi.fn(() => ({
      size: cache.size,
      hitRate: cacheEnabled ? Math.random() * 0.3 + 0.7 : 1, // 70-100% hit rate
      memoryUsage: cache.size * 64, // Approximate bytes per entry
    })),

    // Time manipulation utilities for testing
    setCurrentTime: (newTime: Date | string | number) => {
      currentTime = new Date(newTime).getTime();
    },

    advanceTime: (minutes: number) => {
      currentTime += minutes * 60 * 1000;
      if (autoAdvance) {
        // Trigger any time-dependent callbacks
        vi.advanceTimersByTime(minutes * 60 * 1000);
      }
    },

    getCurrentTime: () => new Date(currentTime),

    reset: () => {
      currentTime = fixedNow.getTime();
      cache.clear();
      // Reset only mock call history, preserve implementations
      Object.values(timeMocks).forEach(mock => {
        if (typeof mock === 'function' && 'mockClear' in mock) {
          (mock as MockedFunction<(...args: unknown[]) => unknown>).mockClear();
        }
      });
    }
  };

  return timeMocks;
}

// ===============================
// API SERVICE MOCK FACTORY
// ===============================

export function createApiMocks(config: MockApiConfig = {}) {
  const {
    networkDelay = 100,
    failureRate = 0,
    enableCaching = true,
    responseVariations = true
  } = config;

  const responseCache = new Map<string, Record<string, unknown>>();
  let requestCounter = 0;

  const simulateNetworkDelay = () =>
    new Promise(resolve => setTimeout(resolve, networkDelay + Math.random() * 50));

  const shouldFail = () => Math.random() < failureRate;

  const generateResponseVariation = <T extends Record<string, unknown>>(baseResponse: T): T => {
    if (!responseVariations) return baseResponse;

    return {
      ...baseResponse,
      meta: {
        ...(baseResponse.meta as Record<string, unknown> || {}),
        requestId: `req-${++requestCounter}`,
        timestamp: new Date().toISOString(),
        processingTime: Math.random() * 200 + 50
      }
    };
  };

  return {
    // Core API methods
    getAppointments: vi.fn().mockImplementation(async (params: MockApiRequestParams = {}) => {
      await simulateNetworkDelay();
      if (shouldFail()) throw new Error('Network error');

      const cacheKey = `appointments-${JSON.stringify(params)}`;
      if (enableCaching && responseCache.has(cacheKey)) {
        return responseCache.get(cacheKey);
      }

      const response = generateResponseVariation({
        success: true,
        data: {
          items: [
            {
              id: 'apt-1',
              customer_name: 'John Doe',
              service: 'Oil Change',
              scheduled_at: '2024-01-15T14:00:00Z',
              status: 'scheduled',
              total_amount: 75.00,
              paid_amount: 0
            },
            {
              id: 'apt-2',
              customer_name: 'Jane Smith',
              service: 'Brake Inspection',
              scheduled_at: '2024-01-15T16:30:00Z',
              status: 'in_progress',
              total_amount: 150.00,
              paid_amount: 150.00
            }
          ],
          nextCursor: params.cursor ? null : 'next-page-token',
          totalCount: 2
        },
        errors: null,
        meta: { requestId: `req-${requestCounter}` }
      });

      if (enableCaching) responseCache.set(cacheKey, response);
      return response;
    }),

    createAppointment: vi.fn().mockImplementation(async (appointmentData: Partial<MockAppointmentData>) => {
      await simulateNetworkDelay();
      if (shouldFail()) throw new Error('Failed to create appointment');

      return generateResponseVariation({
        success: true,
        data: {
          id: `apt-${Date.now()}`,
          ...appointmentData,
          status: 'scheduled',
          created_at: new Date().toISOString()
        },
        errors: null
      });
    }),

    updateAppointmentStatus: vi.fn().mockImplementation(async (id: string, status: MockAppointmentStatus) => {
      await simulateNetworkDelay();
      if (shouldFail()) throw new Error('Failed to update appointment');

      return generateResponseVariation({
        success: true,
        data: {
          id,
          status,
          updated_at: new Date().toISOString()
        },
        errors: null
      });
    }),

    moveAppointment: vi.fn().mockImplementation(async (id: string, newTime: string) => {
      await simulateNetworkDelay();
      if (shouldFail()) throw new Error('Failed to move appointment');

      return generateResponseVariation({
        success: true,
        data: {
          id,
          scheduled_at: newTime,
          updated_at: new Date().toISOString()
        },
        errors: null
      });
    }),

    getDashboardStats: vi.fn().mockImplementation(async () => {
      await simulateNetworkDelay();
      if (shouldFail()) throw new Error('Failed to load dashboard stats');

      return generateResponseVariation({
        success: true,
        data: {
          totals: {
            today: Math.floor(Math.random() * 10) + 5,
            week: Math.floor(Math.random() * 50) + 25,
            unpaid_total: Math.floor(Math.random() * 2000) + 500
          },
          countsByStatus: {
            scheduled: Math.floor(Math.random() * 8) + 2,
            in_progress: Math.floor(Math.random() * 3) + 1,
            completed: Math.floor(Math.random() * 15) + 10,
            cancelled: Math.floor(Math.random() * 2)
          },
          carsOnPremises: [
            { license: 'ABC-123', customer: 'John Doe', arrival: '09:30' },
            { license: 'XYZ-789', customer: 'Jane Smith', arrival: '11:15' }
          ]
        },
        errors: null
      });
    }),

    // Board and dashboard methods to match the existing API interface
    getBoard: vi.fn().mockImplementation(async () => {
      await simulateNetworkDelay();
      if (shouldFail()) throw new Error('Failed to load board');

      return generateResponseVariation({
        columns: [
          { key: 'SCHEDULED', title: 'Scheduled', count: 1, sum: 500 },
          { key: 'IN_PROGRESS', title: 'In Progress', count: 1, sum: 750 },
          { key: 'COMPLETED', title: 'Completed', count: 1, sum: 300 }
        ],
        cards: [
          {
            id: 'test-1',
            customerName: 'John Doe',
            vehicle: '2020 Toyota Camry',
            servicesSummary: 'Oil Change, Brake Inspection',
            status: 'SCHEDULED',
            position: 1,
            price: 500,
            start: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            end: new Date(Date.now() + 90 * 60 * 1000).toISOString()
          }
        ]
      });
    }),

    getStats: vi.fn().mockImplementation(async () => {
      await simulateNetworkDelay();
      if (shouldFail()) throw new Error('Failed to load stats');

      return generateResponseVariation({
        jobsToday: Math.floor(Math.random() * 10) + 5,
        carsOnPremises: Math.floor(Math.random() * 5) + 2,
        scheduled: Math.floor(Math.random() * 8) + 2,
        inProgress: Math.floor(Math.random() * 3) + 1,
        ready: Math.floor(Math.random() * 3) + 1,
        completed: Math.floor(Math.random() * 15) + 10,
        noShow: Math.floor(Math.random() * 2),
        unpaidTotal: Math.floor(Math.random() * 2000) + 500
      });
    }),

    // Testing utilities
    clearCache: () => responseCache.clear(),
    getRequestCount: () => requestCounter,
    setFailureRate: (rate: number) => { config.failureRate = rate; },
    setNetworkDelay: (delay: number) => { config.networkDelay = delay; },
    reset: () => {
      responseCache.clear();
      requestCounter = 0;
      config.failureRate = failureRate;
      config.networkDelay = networkDelay;
    }
  };
}

// ===============================
// BROWSER API MOCK FACTORY
// ===============================

export function createBrowserApiMocks() {
  return {
    // Intersection Observer for lazy loading
    IntersectionObserver: vi.fn().mockImplementation((callback: (entries: MockIntersectionObserverEntry[]) => void, options: MockIntersectionObserverOptions = {}) => ({
      observe: vi.fn((element: Element) => {
        // Simulate element entering viewport after a delay
        setTimeout(() => {
          callback([{
            target: element,
            isIntersecting: true,
            intersectionRatio: 1,
            boundingClientRect: { top: 100, bottom: 200, left: 0, right: 300 } as DOMRectReadOnly,
            rootBounds: { top: 0, bottom: 600, left: 0, right: 800 } as DOMRectReadOnly,
            time: performance.now()
          }]);
        }, 100);
      }),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
      root: options.root || null,
      rootMargin: options.rootMargin || '0px',
      thresholds: Array.isArray(options.threshold) ? options.threshold : [options.threshold || 0]
    })),

    // Resize Observer for responsive components
    ResizeObserver: vi.fn().mockImplementation((callback: (entries: MockResizeObserverEntry[]) => void) => ({
      observe: vi.fn((element: Element) => {
        // Simulate resize event
        setTimeout(() => {
          callback([{
            target: element,
            contentRect: { width: 320, height: 240, top: 0, left: 0 } as DOMRectReadOnly,
            borderBoxSize: [{ inlineSize: 320, blockSize: 240 }] as readonly ResizeObserverSize[],
            contentBoxSize: [{ inlineSize: 300, blockSize: 220 }] as readonly ResizeObserverSize[]
          }]);
        }, 50);
      }),
      unobserve: vi.fn(),
      disconnect: vi.fn()
    })),

    // Media Query matching
    matchMedia: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width: 768px'), // Mock mobile breakpoint
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    })),

    // Performance API
    performance: {
      mark: vi.fn(),
      measure: vi.fn().mockReturnValue({
        name: 'test-measure',
        duration: Math.random() * 100 + 10,
        startTime: performance.now()
      }),
      getEntriesByName: vi.fn().mockReturnValue([]),
      getEntriesByType: vi.fn().mockReturnValue([]),
      clearMarks: vi.fn(),
      clearMeasures: vi.fn(),
      now: vi.fn().mockImplementation(() => Date.now())
    },

    // Local Storage with quota simulation
    localStorage: (() => {
      const storage: Record<string, string> = {};
      const QUOTA_EXCEEDED_SIZE = 5 * 1024 * 1024; // 5MB
      let currentSize = 0;

      return {
        getItem: vi.fn((key: string) => storage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          const newSize = currentSize + value.length;
          if (newSize > QUOTA_EXCEEDED_SIZE) {
            throw new Error('QuotaExceededError');
          }
          if (storage[key]) currentSize -= storage[key].length;
          storage[key] = value;
          currentSize = newSize;
        }),
        removeItem: vi.fn((key: string) => {
          if (storage[key]) {
            currentSize -= storage[key].length;
            delete storage[key];
          }
        }),
        clear: vi.fn(() => {
          Object.keys(storage).forEach(key => delete storage[key]);
          currentSize = 0;
        }),
        key: vi.fn((index: number) => Object.keys(storage)[index] || null),
        get length() { return Object.keys(storage).length; }
      };
    })(),

    // Geolocation API
    geolocation: {
      getCurrentPosition: vi.fn().mockImplementation((
        success?: (position: MockGeolocationPosition) => void,
        error?: (error: MockGeolocationError) => void,
        options?: MockGeolocationOptions
      ) => {
        setTimeout(() => {
          if (Math.random() > 0.9) { // 10% failure rate
            error?.({ code: 1, message: 'Permission denied' });
          } else {
            success?.({
              coords: {
                latitude: 40.7128 + (Math.random() - 0.5) * 0.01,
                longitude: -74.0060 + (Math.random() - 0.5) * 0.01,
                accuracy: Math.random() * 100 + 10,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null
              },
              timestamp: Date.now()
            });
          }
        }, options?.timeout || 1000);
      }),
      watchPosition: vi.fn().mockReturnValue(1),
      clearWatch: vi.fn()
    }
  };
}

// ===============================
// NOTIFICATION MOCK FACTORY
// ===============================

export function createNotificationMocks() {
  const notifications: Array<{ id: string; type: string; message: string; timestamp: Date; [key: string]: unknown }> = [];

  return {
    addNotification: vi.fn().mockImplementation((type: string, message: string, options: Record<string, unknown> = {}) => {
      const notification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        message,
        timestamp: new Date(),
        ...options
      };
      notifications.push(notification);
      return notification.id;
    }),

    removeNotification: vi.fn().mockImplementation((id: string) => {
      const index = notifications.findIndex(n => n.id === id);
      if (index > -1) {
        notifications.splice(index, 1);
        return true;
      }
      return false;
    }),

    clearAllNotifications: vi.fn().mockImplementation(() => {
      notifications.length = 0;
    }),

    getNotifications: vi.fn().mockImplementation(() => [...notifications]),

    // Appointment-specific notification helpers
    notifyArrival: vi.fn().mockImplementation((customerName: string) => {
      const notification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'arrival',
        message: `${customerName} has arrived`,
        timestamp: new Date(),
        urgent: true,
        autoClose: false
      };
      notifications.push(notification);
      return notification.id;
    }),

    notifyLate: vi.fn().mockImplementation((customerName: string, minutesLate: number) => {
      const notification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'late',
        message: `${customerName} is ${minutesLate} minutes late`,
        timestamp: new Date(),
        urgent: true,
        autoClose: false
      };
      notifications.push(notification);
      return notification.id;
    }),

    notifyOverdue: vi.fn().mockImplementation((customerName: string, minutesOverdue: number) => {
      const notification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'overdue',
        message: `${customerName} is ${minutesOverdue} minutes overdue`,
        timestamp: new Date(),
        urgent: true,
        persistent: true
      };
      notifications.push(notification);
      return notification.id;
    }),

    markNotificationAsRead: vi.fn().mockImplementation((id: string) => {
      const notification = notifications.find(n => n.id === id);
      if (notification) {
        (notification as Record<string, unknown>).read = true;
        return true;
      }
      return false;
    }),

    // Testing utilities
    getNotificationCount: () => notifications.length,
    getNotificationsByType: (type: string) => notifications.filter(n => n.type === type),
    reset: () => {
      notifications.length = 0;
    }
  };
}

// ===============================
// MOCK FACTORY ORCHESTRATOR
// ===============================

export function createMockFactory(config: TestMockFactoryConfig = {}) {
  const timeMocks = createTimeMocks(config.time);
  const apiMocks = createApiMocks(config.api);
  const browserMocks = config.enableBrowserApis !== false ? createBrowserApiMocks() : null;
  const notificationMocks = config.enableNotifications !== false ? createNotificationMocks() : null;

  return {
    time: timeMocks,
    api: apiMocks,
    browser: browserMocks,
    notifications: notificationMocks,

    // Global reset function
    resetAll: () => {
      timeMocks.reset();
      apiMocks.reset();
      notificationMocks?.reset();
    },

    // Apply all mocks to vitest global scope
    applyGlobally: () => {
      if (browserMocks) {
        global.IntersectionObserver = browserMocks.IntersectionObserver;
        global.ResizeObserver = browserMocks.ResizeObserver;
        global.matchMedia = browserMocks.matchMedia;
        global.localStorage = browserMocks.localStorage as Storage;
        global.performance = { ...global.performance, ...browserMocks.performance };

        if (typeof navigator !== 'undefined') {
          (navigator as unknown as Record<string, unknown>).geolocation = browserMocks.geolocation;
        }
      }
    }
  };
}

// Export a default factory instance for immediate use
export const mockFactory = createMockFactory();

// Convenience exports for common use cases
export const timeMocks = mockFactory.time;
export const apiMocks = mockFactory.api;
export const browserMocks = mockFactory.browser;
export const notificationMocks = mockFactory.notifications;
