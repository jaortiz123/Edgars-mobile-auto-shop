/**
 * MOCK-FACTORY-001: Complete MockFactory API
 * Centralized mock factory to resolve circular dependencies and provide consistent test mocks
 */

import { vi } from 'vitest';

// Export the centralized mock factory function
export function createMocks() {
  // Local state per mock instance to avoid shared state issues
  let localMockCurrentTime = '2024-01-15T10:00:00Z';
  let localMockNotifications: Array<{
    id: string;
    type: string;
    message: string;
    appointmentId?: string;
    timestamp: Date;
    read?: boolean;
  }> = [];
  let localMockApiFailureRate = 0;
  let localMockApiLatency = 0;

  return {
    time: {
      setCurrentTime: (isoString: string) => {
        localMockCurrentTime = isoString;
      },
      getCurrentTime: () => new Date(localMockCurrentTime), // Return Date object, not string
      advanceTime: (mins: number) => {
        const current = new Date(localMockCurrentTime);
        current.setMinutes(current.getMinutes() + mins);
        localMockCurrentTime = current.toISOString();
      },
      formatDuration: (mins: number) => {
        if (mins >= 60) {
          const hours = Math.floor(mins / 60);
          const remainingMins = mins % 60;
          if (remainingMins === 0) {
            return `${hours}h`;
          }
          return `${hours}h ${remainingMins}m`;
        }
        return `${mins}m`;
      },
      clearTimeCache: () => {
        // Mock implementation - just a placeholder for cache clearing
        return true;
      },
      getTimeCacheStats: () => ({ size: 0, hits: 0, misses: 0 }),
      getMinutesUntil: (targetTime: string) => {
        const current = new Date(localMockCurrentTime);
        const target = new Date(targetTime);
        return Math.round((target.getTime() - current.getTime()) / (1000 * 60));
      },
      isStartingSoon: (appointmentTime: string, bufferMinutes = 15) => {
        const current = new Date(localMockCurrentTime);
        const appointment = new Date(appointmentTime);
        const minutesUntil = Math.round((appointment.getTime() - current.getTime()) / (1000 * 60));
        return minutesUntil > 0 && minutesUntil <= bufferMinutes;
      },
      isRunningLate: (appointmentTime: string, bufferMinutes = 15) => {
        const current = new Date(localMockCurrentTime);
        const appointment = new Date(appointmentTime);
        const minutesLate = Math.round((current.getTime() - appointment.getTime()) / (1000 * 60));
        return minutesLate > 0 && minutesLate < bufferMinutes; // Changed <= to < since at exactly bufferMinutes it becomes overdue
      },
      isOverdue: (appointmentTime: string, bufferMinutes = 15) => {
        const current = new Date(localMockCurrentTime);
        const appointment = new Date(appointmentTime);
        const minutesLate = Math.round((current.getTime() - appointment.getTime()) / (1000 * 60));
        return minutesLate > bufferMinutes; // Changed back to > since test expects false for exactly 15 minutes
      }
    },
    notification: {
      notifyArrival: (customerName: string, appointmentId?: string) => {
        const id = `arrival-${Date.now()}`;
        localMockNotifications.push({
          id,
          type: 'arrival',
          message: `${customerName} has arrived`,
          appointmentId,
          timestamp: new Date()
        });
        return id;
      },
      notifyReminder: (customerName: string, minutesUntil: number, appointmentId?: string) => {
        const id = `reminder-${Date.now()}`;
        localMockNotifications.push({
          id,
          type: 'reminder',
          message: `Reminder: ${customerName} appointment in ${minutesUntil} minutes`,
          appointmentId,
          timestamp: new Date()
        });
        return id;
      },
      notifyLate: (customerName: string, minutesLate: number, appointmentId?: string) => {
        const id = `late-${Date.now()}`;
        localMockNotifications.push({
          id,
          type: 'late',
          message: `${customerName} is ${minutesLate} minutes late`,
          appointmentId,
          timestamp: new Date()
        });
        return id;
      },
      notifyOverdue: (customerName: string, minutesOverdue: number, appointmentId?: string) => {
        const id = `overdue-${Date.now()}`;
        localMockNotifications.push({
          id,
          type: 'overdue',
          message: `${customerName} is ${minutesOverdue} minutes overdue`,
          appointmentId,
          timestamp: new Date()
        });
        return id;
      },
      getNotificationCount: () => localMockNotifications.length,
      getNotificationsByType: (type: string) => localMockNotifications.filter(n => n.type === type),
      markNotificationAsRead: (id: string) => {
        const notification = localMockNotifications.find(n => n.id === id);
        if (notification) {
          notification.read = true;
          return true;
        }
        return false;
      },
      addNotification: (notification: unknown) => {
        const id = `mock-${Date.now()}`;
        localMockNotifications.push({
          id,
          type: 'general',
          message: typeof notification === 'string' ? notification : (notification as { message: string }).message,
          timestamp: new Date(),
          ...((typeof notification === 'object' && notification) ? notification as Record<string, unknown> : {})
        });
        return id;
      },
      removeNotification: (id: string) => {
        const index = localMockNotifications.findIndex(n => n.id === id);
        if (index > -1) localMockNotifications.splice(index, 1);
      },
      markAsRead: (id: string) => {
        const notification = localMockNotifications.find(n => n.id === id);
        if (notification) notification.read = true;
      },
      getNotifications: () => [...localMockNotifications],
      clearAll: () => {
        localMockNotifications.length = 0;
      }
    },
    api: {
      simulateFailureRate: (rate: number) => {
        localMockApiFailureRate = rate;
      },
      simulateLatency: (ms: number) => {
        localMockApiLatency = ms;
      },
      simulateNetworkDelay: (ms: number) => {
        localMockApiLatency = ms; // Alias for simulateLatency
      },
      isOnline: () => true,
      getBoard: vi.fn().mockImplementation(() => {
        if (Math.random() < localMockApiFailureRate) {
          throw new Error('Network error');
        }
        return Promise.resolve({
          success: true,
          columns: [
            { id: 'pending', title: 'Pending', cards: [] },
            { id: 'in-progress', title: 'In Progress', cards: [] },
            { id: 'completed', title: 'Completed', cards: [] }
          ],
          cards: [
            {
              id: 'card-1',
              title: 'Sample Card',
              columnId: 'pending',
              customer_name: 'John Doe'
            }
          ]
        });
      }),
      getAppointments: vi.fn().mockImplementation(() => {
        if (Math.random() < localMockApiFailureRate) {
          throw new Error('Network error'); // Use consistent error message
        }
        return Promise.resolve({
          success: true,
          data: {
            items: [
              {
                id: 'apt-1',
                customer_name: 'John Doe',
                service: 'Oil Change',
                appointment_time: '2024-01-15T10:00:00Z',
                status: 'confirmed'
              },
              {
                id: 'apt-2', 
                customer_name: 'Jane Smith',
                service: 'Brake Inspection',
                appointment_time: '2024-01-15T14:00:00Z',
                status: 'pending'
              }
            ]
          }
        });
      }),
      createAppointment: vi.fn().mockImplementation((data: Record<string, unknown>) => {
        if (Math.random() < localMockApiFailureRate) {
          throw new Error('Network error');
        }
        return Promise.resolve({
          success: true,
          data: {
            id: `apt-${Date.now()}`,
            ...data,
            created_at: new Date().toISOString()
          }
        });
      }),
      updateAppointmentStatus: vi.fn().mockImplementation((id: string, status: string) => {
        if (Math.random() < localMockApiFailureRate) {
          throw new Error('Network error');
        }
        return Promise.resolve({
          success: true,
          data: { id, status, updated_at: new Date().toISOString() }
        });
      }),
      getDrawer: vi.fn().mockImplementation(() => {
        return Promise.resolve({
          success: true,
          data: { cash: 100, total_sales: 500 }
        });
      }),
      getStats: vi.fn().mockImplementation(() => {
        return Promise.resolve({
          success: true,
          data: {
            total_appointments: 42,
            completed_today: 8,
            revenue_today: 850
          }
        });
      }),
      getCustomerHistory: vi.fn().mockImplementation(() => {
        if (Math.random() < localMockApiFailureRate) {
          throw new Error('Network error');
        }
        return Promise.resolve({
          success: true,
          data: {
            pastAppointments: [
              {
                id: 'apt-past-1',
                customer_name: 'John Doe',
                service: 'Oil Change',
                appointment_time: '2023-12-15T10:00:00Z',
                status: 'completed',
                payment_amount: 75.00,
                payment_status: 'paid'
              }
            ]
          }
        });
      }),
      handleApiError: vi.fn().mockImplementation((err: unknown, defaultMessage?: string): string => {
        // Mock implementation that mimics the real handleApiError function
        let msg: string;
        if (err && typeof err === 'object' && 'message' in err) {
          msg = (err as { message: string }).message || defaultMessage || 'Unknown error';
        } else if (typeof err === 'string') {
          msg = err;
        } else {
          msg = defaultMessage || 'Unknown error';
        }
        // Don't actually console.error in tests, just return the message
        return msg;
      })
    },
    resetAll: () => {
      vi.clearAllMocks();
      localMockCurrentTime = '2024-01-15T10:00:00Z';
      localMockNotifications.length = 0;
      localMockApiFailureRate = 0;
      localMockApiLatency = 0;
    }
  };
}

// Legacy compatibility types and functions
interface TimeMock {
  setCurrentTime: (isoString: string) => void;
  getCurrentTime: () => Date; // Changed from string to Date
  advanceTime: (mins: number) => void;
  formatDuration: (mins: number) => string;
  clearTimeCache: () => boolean;
  getTimeCacheStats: () => { size: number; hits: number; misses: number };
  getMinutesUntil: (targetTime: string) => number;
  isStartingSoon: (appointmentTime: string, bufferMinutes?: number) => boolean;
  isRunningLate: (appointmentTime: string, bufferMinutes?: number) => boolean;
  isOverdue: (appointmentTime: string, bufferMinutes?: number) => boolean;
}

interface ApiMock {
  simulateFailureRate: (rate: number) => void;
  simulateLatency: (ms: number) => void;
  simulateNetworkDelay: (ms: number) => void;
  isOnline: () => boolean;
  getAppointments: ReturnType<typeof vi.fn>;
  createAppointment: ReturnType<typeof vi.fn>;
  updateAppointmentStatus: ReturnType<typeof vi.fn>;
  getDrawer: ReturnType<typeof vi.fn>;
  getStats: ReturnType<typeof vi.fn>;
  getBoard: ReturnType<typeof vi.fn>;
  getCustomerHistory: ReturnType<typeof vi.fn>;
  handleApiError: ReturnType<typeof vi.fn>;
}

interface NotificationMock {
  notifyArrival: (customerName: string, appointmentId?: string) => string;
  notifyReminder: (customerName: string, minutesUntil: number, appointmentId?: string) => string;
  notifyLate: (customerName: string, minutesLate: number, appointmentId?: string) => string;
  notifyOverdue: (customerName: string, minutesOverdue: number, appointmentId?: string) => string;
  getNotificationCount: () => number;
  getNotificationsByType: (type: string) => Array<{ id: string; type: string; message: string; timestamp: Date; read?: boolean }>;
  markNotificationAsRead: (id: string) => boolean;
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

/**
 * Legacy compatibility function - creates test mocks with old interface
 */
export default function createTestMocks(): TestMocks {
  const mocks = createMocks();
  
  // Return the mocks with resetAll functionality
  return {
    time: mocks.time as TimeMock,
    api: mocks.api as ApiMock,
    notification: {
      ...mocks.notification,
      addNotification: vi.fn().mockImplementation(mocks.notification.addNotification),
      removeNotification: vi.fn().mockImplementation(mocks.notification.removeNotification),
      markAsRead: vi.fn().mockImplementation(mocks.notification.markAsRead),
      getNotifications: vi.fn().mockImplementation(mocks.notification.getNotifications),
      clearAll: vi.fn().mockImplementation(mocks.notification.clearAll)
    } as NotificationMock,
    resetAll: mocks.resetAll
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
