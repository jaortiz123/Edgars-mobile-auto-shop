/**
 * P1-T-002: Redesigned Mock Factory
 * Centralized mock factory to resolve circular dependencies and provide consistent test mocks
 */

import { vi } from 'vitest';
import * as centralizedApiMock from '../../test/mocks/api';

// Time calculation utilities for appointment timing tests
interface TimeMock {
  setCurrentTime: (isoString: string) => void;
  getCurrentTime: () => string;
  getMinutesUntil: (targetTime: string) => number;
  isStartingSoon: (appointmentTime: string, bufferMinutes?: number) => boolean;
  isRunningLate: (appointmentTime: string, bufferMinutes?: number) => boolean;
  isOverdue: (appointmentTime: string, bufferMinutes?: number) => boolean;
}

// API mock interface
interface ApiMock {
  getAppointments: ReturnType<typeof vi.fn>;
  createAppointment: ReturnType<typeof vi.fn>;
  updateAppointmentStatus: ReturnType<typeof vi.fn>;
  getDrawer: ReturnType<typeof vi.fn>;
  getStats: ReturnType<typeof vi.fn>;
}

// Notification system mock
interface NotificationMock {
  addNotification: ReturnType<typeof vi.fn>;
  removeNotification: ReturnType<typeof vi.fn>;
  markAsRead: ReturnType<typeof vi.fn>;
  getNotifications: ReturnType<typeof vi.fn>;
  clearAll: ReturnType<typeof vi.fn>;
}

interface TestMocks {
  time: TimeMock;
  api: ApiMock;
  notification: NotificationMock;
  resetAll: () => void;
}

// Current time for mock calculations
let mockCurrentTime = new Date().toISOString();

// Create time mock utilities
function createTimeMock(): TimeMock {
  return {
    setCurrentTime: (isoString: string) => {
      mockCurrentTime = isoString;
    },
    getCurrentTime: () => mockCurrentTime,
    getMinutesUntil: (targetTime: string) => {
      const current = new Date(mockCurrentTime);
      const target = new Date(targetTime);
      return Math.round((target.getTime() - current.getTime()) / (1000 * 60));
    },
    isStartingSoon: (appointmentTime: string, bufferMinutes = 15) => {
      const current = new Date(mockCurrentTime);
      const appointment = new Date(appointmentTime);
      const minutesUntil = Math.round((appointment.getTime() - current.getTime()) / (1000 * 60));
      return minutesUntil > 0 && minutesUntil <= bufferMinutes;
    },
    isRunningLate: (appointmentTime: string, bufferMinutes = 15) => {
      const current = new Date(mockCurrentTime);
      const appointment = new Date(appointmentTime);
      const minutesLate = Math.round((current.getTime() - appointment.getTime()) / (1000 * 60));
      return minutesLate > 0 && minutesLate <= bufferMinutes;
    },
    isOverdue: (appointmentTime: string, bufferMinutes = 15) => {
      const current = new Date(mockCurrentTime);
      const appointment = new Date(appointmentTime);
      const minutesLate = Math.round((current.getTime() - appointment.getTime()) / (1000 * 60));
      return minutesLate > bufferMinutes;
    }
  };
}

// Create API mock
function createApiMock(): ApiMock {
  return {
    getAppointments: vi.fn().mockImplementation(centralizedApiMock.getAppointments),
    createAppointment: vi.fn().mockImplementation(centralizedApiMock.createAppointment),
    updateAppointmentStatus: vi.fn().mockImplementation(centralizedApiMock.updateAppointmentStatus),
    getDrawer: vi.fn().mockImplementation(centralizedApiMock.getDrawer),
    getStats: vi.fn().mockImplementation(centralizedApiMock.getStats),
  };
}

// Create notification mock
function createNotificationMock(): NotificationMock {
  const notifications: Array<{ id: string; message: string; read: boolean; timestamp: string }> = [];
  
  return {
    addNotification: vi.fn().mockImplementation((notification: unknown) => {
      const newNotif = {
        id: `mock-${Date.now()}`,
        message: typeof notification === 'object' && notification && 'message' in notification ? 
          (notification as { message: string }).message : String(notification),
        read: false,
        timestamp: new Date().toISOString(),
        ...(typeof notification === 'object' && notification ? notification as Record<string, unknown> : {})
      };
      notifications.push(newNotif);
      return newNotif.id;
    }),
    removeNotification: vi.fn().mockImplementation((id: string) => {
      const index = notifications.findIndex(n => n.id === id);
      if (index > -1) notifications.splice(index, 1);
    }),
    markAsRead: vi.fn().mockImplementation((id: string) => {
      const notification = notifications.find(n => n.id === id);
      if (notification) notification.read = true;
    }),
    getNotifications: vi.fn().mockImplementation(() => [...notifications]),
    clearAll: vi.fn().mockImplementation(() => {
      notifications.length = 0;
    })
  };
}

/**
 * Main mock factory function
 * Creates isolated mock instances for testing
 */
export default function createTestMocks(): TestMocks {
  const time = createTimeMock();
  const api = createApiMock();
  const notification = createNotificationMock();

  return {
    time,
    api,
    notification,
    resetAll: () => {
      vi.clearAllMocks();
      // Reset time to current time
      mockCurrentTime = new Date().toISOString();
    }
  };
}

/**
 * Utility helper for test functions that need mocks
 */
export function withMocks<T>(testFn: (mocks: TestMocks) => T | Promise<T>) {
  return (async () => {
    const mocks = createTestMocks();
    try {
      const result = await testFn(mocks);
      return result;
    } finally {
      mocks.resetAll();
    }
  });
}

export type { TestMocks };
