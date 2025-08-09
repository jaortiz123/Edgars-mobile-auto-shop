/**
 * Unified Mock Factory - Consolidates All Test Mock Interfaces
 * 
 * This file provides a single source of truth for all test mocks,
 * ensuring consistent interfaces across all test files.
 * 
 * CRITICAL: This solves the import issues by providing all expected
 * mock functions that tests are trying to use.
 */

import { vi, type MockedFunction } from 'vitest';

// =============================================================================
// UNIFIED INTERFACES - All Expected Mock Functions
// =============================================================================

export interface UnifiedTimeMocks {
  // Core time functions
  setCurrentTime: MockedFunction<(time: string | Date) => void>;
  getCurrentTime: MockedFunction<() => Date>;
  advanceTime: MockedFunction<(minutes: number) => void>;
  
  // Time calculation functions
  getMinutesUntil: MockedFunction<(startTime: Date | string | number) => number>;
  minutesPast: MockedFunction<(time: Date | string | number) => number>;
  
  // Duration and display functions
  formatDuration: MockedFunction<(minutes: number) => string>;
  getCountdownText: MockedFunction<(minutesUntil: number, options?: Record<string, unknown>) => string>;
  
  // Status check functions
  isStartingSoon: MockedFunction<(startTime: Date | string | number, threshold?: number) => boolean>;
  isRunningLate: MockedFunction<(startTime: Date | string | number, threshold?: number) => boolean>;
  isOverdue: MockedFunction<(startTime: Date | string | number, threshold?: number) => boolean>;
  
  // Cache management functions
  clearTimeCache: MockedFunction<() => void>;
  getTimeCacheStats: MockedFunction<() => { size: number; hits: number; misses: number }>;
  
  // Reset function
  reset: MockedFunction<() => void>;
}

export interface UnifiedNotificationMocks {
  // Core notification functions
  addNotification: MockedFunction<(message: string, type?: string, options?: Record<string, unknown>) => string>;
  removeNotification: MockedFunction<(id: string) => boolean>;
  clearAllNotifications: MockedFunction<() => void>;
  
  // Specialized notification functions
  notifyArrival: MockedFunction<(customerName: string, appointmentId?: string) => string>;
  notifyLate: MockedFunction<(customerName: string, minutesLate: number, appointmentId?: string) => string>;
  notifyOverdue: MockedFunction<(customerName: string, minutesOverdue: number, appointmentId?: string) => string>;
  notifyReminder: MockedFunction<(customerName: string, minutesUntil: number, appointmentId?: string) => string>;
  
  // Query functions
  getNotifications: MockedFunction<() => Array<{ id: string; type: string; message: string; timestamp: Date; read?: boolean }>>;
  getNotificationsByType: MockedFunction<(type: string) => Array<{ id: string; type: string; message: string; timestamp: Date; read?: boolean }>>;
  getNotificationCount: MockedFunction<() => number>;
  
  // State management functions
  markNotificationAsRead: MockedFunction<(id: string) => boolean>;
  markAsRead: MockedFunction<(id: string) => boolean>; // Alias for compatibility
  clearAll: MockedFunction<() => void>; // Alias for compatibility
  
  // Reset function
  reset: MockedFunction<() => void>;
}

export interface UnifiedApiMocks {
  getAppointments: MockedFunction<() => Promise<{ data: { items: Array<{ id: string; customer_name: string }> } }>>;
  updateAppointment: MockedFunction<(id: string, data: Record<string, unknown>) => Promise<unknown>>;
  simulateFailureRate: MockedFunction<(rate: number) => void>;
  reset: MockedFunction<() => void>;
}

export interface UnifiedMockFactory {
  time: UnifiedTimeMocks;
  notification: UnifiedNotificationMocks;
  api: UnifiedApiMocks;
  resetAll: MockedFunction<() => void>;
}

// =============================================================================
// UNIFIED MOCK FACTORY IMPLEMENTATION
// =============================================================================

export function createUnifiedMocks(): UnifiedMockFactory {
  // Local state for isolated mock instances
  let localCurrentTime = new Date('2024-01-15T10:00:00Z').getTime();
  const localNotifications: Array<{ 
    id: string; 
    type: string; 
    message: string; 
    timestamp: Date; 
    read?: boolean;
    appointmentId?: string;
  }> = [];
  
  // Helper for time calculations
  const calculateMinutesUntil = (startTime: Date | string | number): number => {
    try {
      const date = typeof startTime === 'string' || typeof startTime === 'number' ? new Date(startTime) : startTime;
      const now = new Date(localCurrentTime);
      const diffMs = date.getTime() - now.getTime();
      return Math.floor(diffMs / (1000 * 60));
    } catch (error) {
      console.warn('🔧 UNIFIED MOCK: calculateMinutesUntil error:', error);
      return 0;
    }
  };

  // TIME MOCKS
  const timeMocks: UnifiedTimeMocks = {
    setCurrentTime: vi.fn().mockImplementation((time: string | Date) => {
      localCurrentTime = new Date(time).getTime();
      console.log('🔧 UNIFIED MOCK: setCurrentTime called with:', time);
    }),
    
    getCurrentTime: vi.fn().mockImplementation(() => {
      return new Date(localCurrentTime);
    }),
    
    advanceTime: vi.fn().mockImplementation((minutes: number) => {
      localCurrentTime += minutes * 60 * 1000;
      console.log('🔧 UNIFIED MOCK: advanceTime called with:', minutes);
    }),
    
    getMinutesUntil: vi.fn().mockImplementation(calculateMinutesUntil),
    
    minutesPast: vi.fn().mockImplementation((time: Date | string | number) => {
      const minutesUntil = calculateMinutesUntil(time);
      return Math.max(0, -minutesUntil);
    }),
    
    formatDuration: vi.fn().mockImplementation((minutes: number) => {
      if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const remainingMins = minutes % 60;
        if (remainingMins === 0) {
          return `${hours}h`;
        }
        return `${hours}h ${remainingMins}m`;
      }
      return `${minutes}m`;
    }),
    
    getCountdownText: vi.fn().mockImplementation((minutesUntil: number, options: Record<string, unknown> = {}) => {
      if (minutesUntil > 0) {
        return `Starts in ${minutesUntil}m`;
      } else if (minutesUntil < 0) {
        return `Started ${Math.abs(minutesUntil)}m ago`;
      } else {
        return 'Starting now';
      }
    }),
    
    isStartingSoon: vi.fn().mockImplementation((startTime: Date | string | number, threshold = 15) => {
      const minutesUntil = calculateMinutesUntil(startTime);
      return minutesUntil > 0 && minutesUntil <= threshold;
    }),
    
    isRunningLate: vi.fn().mockImplementation((startTime: Date | string | number, threshold = 10) => {
      const minutesUntil = calculateMinutesUntil(startTime);
      return minutesUntil < 0 && Math.abs(minutesUntil) >= threshold;
    }),
    
    isOverdue: vi.fn().mockImplementation((startTime: Date | string | number, threshold = 30) => {
      const minutesUntil = calculateMinutesUntil(startTime);
      return minutesUntil < -threshold;
    }),
    
    clearTimeCache: vi.fn().mockImplementation(() => {
      console.log('🔧 UNIFIED MOCK: clearTimeCache called');
    }),
    
    getTimeCacheStats: vi.fn().mockImplementation(() => ({
      size: 0,
      hits: 0,
      misses: 0
    })),
    
    reset: vi.fn().mockImplementation(() => {
      localCurrentTime = new Date('2024-01-15T10:00:00Z').getTime();
      // Reset all mock call history
      Object.values(timeMocks).forEach(mock => {
        if (typeof mock === 'function' && 'mockClear' in mock) {
          (mock as MockedFunction<(...args: unknown[]) => unknown>).mockClear();
        }
      });
    })
  };

  // NOTIFICATION MOCKS
  const notificationMocks: UnifiedNotificationMocks = {
    addNotification: vi.fn().mockImplementation((message: string, type = 'info', options: Record<string, unknown> = {}) => {
      const id = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localNotifications.push({
        id,
        type,
        message,
        timestamp: new Date(),
        read: false,
        ...options
      });
      console.log('🔧 UNIFIED MOCK: addNotification called with:', message, type);
      return id;
    }),
    
    removeNotification: vi.fn().mockImplementation((id: string) => {
      const index = localNotifications.findIndex(n => n.id === id);
      if (index > -1) {
        localNotifications.splice(index, 1);
        return true;
      }
      return false;
    }),
    
    clearAllNotifications: vi.fn().mockImplementation(() => {
      localNotifications.length = 0;
    }),
    
    notifyArrival: vi.fn().mockImplementation((customerName: string, appointmentId?: string) => {
      const id = `arrival-${Date.now()}`;
      localNotifications.push({
        id,
        type: 'arrival',
        message: `${customerName} has arrived`,
        appointmentId,
        timestamp: new Date(),
        read: false
      });
      console.log('🔧 UNIFIED MOCK: notifyArrival called with:', customerName);
      return id;
    }),
    
    notifyLate: vi.fn().mockImplementation((customerName: string, minutesLate: number, appointmentId?: string) => {
      const id = `late-${Date.now()}`;
      localNotifications.push({
        id,
        type: 'late',
        message: `${customerName} is ${minutesLate} minutes late`,
        appointmentId,
        timestamp: new Date(),
        read: false
      });
      console.log('🔧 UNIFIED MOCK: notifyLate called with:', customerName, minutesLate);
      return id;
    }),
    
    notifyOverdue: vi.fn().mockImplementation((customerName: string, minutesOverdue: number, appointmentId?: string) => {
      const id = `overdue-${Date.now()}`;
      localNotifications.push({
        id,
        type: 'overdue',
        message: `${customerName} is ${minutesOverdue} minutes overdue`,
        appointmentId,
        timestamp: new Date(),
        read: false
      });
      console.log('🔧 UNIFIED MOCK: notifyOverdue called with:', customerName, minutesOverdue);
      return id;
    }),
    
    notifyReminder: vi.fn().mockImplementation((customerName: string, minutesUntil: number, appointmentId?: string) => {
      const id = `reminder-${Date.now()}`;
      localNotifications.push({
        id,
        type: 'reminder',
        message: `Reminder: ${customerName} appointment in ${minutesUntil} minutes`,
        appointmentId,
        timestamp: new Date(),
        read: false
      });
      console.log('🔧 UNIFIED MOCK: notifyReminder called with:', customerName, minutesUntil);
      return id;
    }),
    
    getNotifications: vi.fn().mockImplementation(() => {
      return [...localNotifications];
    }),
    
    getNotificationsByType: vi.fn().mockImplementation((type: string) => {
      return localNotifications.filter(n => n.type === type);
    }),
    
    getNotificationCount: vi.fn().mockImplementation(() => {
      return localNotifications.length;
    }),
    
    markNotificationAsRead: vi.fn().mockImplementation((id: string) => {
      const notification = localNotifications.find(n => n.id === id);
      if (notification) {
        notification.read = true;
        return true;
      }
      return false;
    }),
    
    // Aliases for compatibility
    markAsRead: vi.fn().mockImplementation((id: string) => {
      return notificationMocks.markNotificationAsRead(id);
    }),
    
    clearAll: vi.fn().mockImplementation(() => {
      notificationMocks.clearAllNotifications();
    }),
    
    reset: vi.fn().mockImplementation(() => {
      localNotifications.length = 0;
      // Reset all mock call history
      Object.values(notificationMocks).forEach(mock => {
        if (typeof mock === 'function' && 'mockClear' in mock) {
          (mock as MockedFunction<(...args: unknown[]) => unknown>).mockClear();
        }
      });
    })
  };

  // API MOCKS
  const apiMocks: UnifiedApiMocks = {
    getAppointments: vi.fn().mockImplementation(async () => {
      return {
        data: {
          items: [
            { id: 'apt-1', customer_name: 'John Doe' },
            { id: 'apt-2', customer_name: 'Jane Smith' }
          ]
        }
      };
    }),
    
    updateAppointment: vi.fn().mockImplementation(async (id: string, data: Record<string, unknown>) => {
      console.log('🔧 UNIFIED MOCK: updateAppointment called with:', id, data);
      return { success: true, id, data };
    }),
    
    simulateFailureRate: vi.fn().mockImplementation((rate: number) => {
      console.log('🔧 UNIFIED MOCK: simulateFailureRate called with:', rate);
    }),
    
    reset: vi.fn().mockImplementation(() => {
      // Reset all mock call history
      Object.values(apiMocks).forEach(mock => {
        if (typeof mock === 'function' && 'mockClear' in mock) {
          (mock as MockedFunction<(...args: unknown[]) => unknown>).mockClear();
        }
      });
    })
  };

  // UNIFIED FACTORY
  const unifiedFactory: UnifiedMockFactory = {
    time: timeMocks,
    notification: notificationMocks,
    api: apiMocks,
    
    resetAll: vi.fn().mockImplementation(() => {
      timeMocks.reset();
      notificationMocks.reset();
      apiMocks.reset();
      console.log('🔧 UNIFIED MOCK: resetAll called');
    })
  };

  return unifiedFactory;
}

// =============================================================================
// CONVENIENCE HELPERS
// =============================================================================

/**
 * Helper function for tests that expect the `mocks` variable structure
 */
export function createMocks() {
  return createUnifiedMocks();
}

/**
 * Helper function for tests that use the `withMocks` pattern
 */
export function withMocks<T>(testFn: (mocks: UnifiedMockFactory) => T): () => T {
  return () => {
    const mocks = createUnifiedMocks();
    return testFn(mocks);
  };
}

/**
 * Create test mocks (alias for compatibility)
 */
export function createTestMocks() {
  return createUnifiedMocks();
}

console.log('✅ Unified Mock Factory loaded - provides all expected mock interfaces');
