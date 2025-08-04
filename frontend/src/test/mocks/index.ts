/**
 * Centralized Mock Factory (P1-T-012)
 * 
 * This factory provides a single source of truth for all test mocks,
 * preventing circular dependencies and undefined mock issues.
 * 
 * All vi.mock() calls should use the outputs from this factory.
 */

import { vi } from 'vitest';

/**
 * Creates all mocks in a centralized way to prevent circular dependencies
 */
export function createMocks() {
  return {
    time: {
      // Time utilities for scheduling and formatting
      advanceTime: vi.fn((minutes: number) => {
        const now = new Date();
        return new Date(now.getTime() + minutes * 60000);
      }),
      
      formatDuration: vi.fn((minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) {
          return `${hours}h ${mins}m`;
        }
        return `${mins}m`;
      }),
      
      getCurrentTime: vi.fn(() => new Date()),
      
      isBusinessHours: vi.fn(() => true),
      
      addBusinessDays: vi.fn((date: Date, days: number) => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
      }),
      
      formatTime: vi.fn((date: Date) => date.toLocaleTimeString()),
      
      formatDate: vi.fn((date: Date) => date.toLocaleDateString()),
    },

    api: {
      // API calls with simulation controls
      getBoard: vi.fn().mockResolvedValue({
        columns: [
          { id: '1', title: 'Pending', status: 'pending' },
          { id: '2', title: 'In Progress', status: 'in_progress' },
          { id: '3', title: 'Complete', status: 'complete' }
        ],
        cards: []
      }),
      
      getStats: vi.fn().mockResolvedValue({
        totalAppointments: 0,
        pendingCount: 0,
        inProgressCount: 0,
        completedCount: 0,
        revenue: 0
      }),
      
      moveAppointment: vi.fn().mockResolvedValue({}),
      
      createAppointment: vi.fn().mockResolvedValue({ id: 'new-appointment' }),
      
      updateAppointment: vi.fn().mockResolvedValue({}),
      
      deleteAppointment: vi.fn().mockResolvedValue({}),
      
      getServices: vi.fn().mockResolvedValue([]),
      
      createService: vi.fn().mockResolvedValue({ id: 'new-service' }),
      
      updateService: vi.fn().mockResolvedValue({}),
      
      deleteService: vi.fn().mockResolvedValue({}),
      
      // Simulation controls
      simulateFailureRate: vi.fn((rate: number) => {
        // Mock implementation that can be configured per test
        console.log(`🔧 API Mock: Setting failure rate to ${rate * 100}%`);
      }),
      
      simulateLatency: vi.fn((ms: number) => {
        console.log(`🔧 API Mock: Setting latency to ${ms}ms`);
      }),
      
      // Error handling utilities
      handleApiError: vi.fn((error: unknown, defaultMessage: string) => {
        if (error instanceof Error) {
          return error.message;
        }
        return defaultMessage;
      }),
    },

    notification: {
      // Notification service mocks
      notifyArrival: vi.fn().mockResolvedValue({}),
      
      notifyLate: vi.fn().mockResolvedValue({}),
      
      notifyCompletion: vi.fn().mockResolvedValue({}),
      
      notifyReminder: vi.fn().mockResolvedValue({}),
      
      sendSMS: vi.fn().mockResolvedValue({ messageId: 'mock-sms-id' }),
      
      sendEmail: vi.fn().mockResolvedValue({ messageId: 'mock-email-id' }),
      
      // Simulation controls
      simulateDeliveryFailure: vi.fn((shouldFail: boolean) => {
        console.log(`🔧 Notification Mock: Setting delivery failure to ${shouldFail}`);
      }),
      
      simulateDelay: vi.fn((ms: number) => {
        console.log(`🔧 Notification Mock: Setting delay to ${ms}ms`);
      }),
    },

    toast: {
      // Toast notification mocks
      push: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    },

    storage: {
      // Local storage mocks
      getItem: vi.fn((key: string) => localStorage.getItem(key)),
      setItem: vi.fn((key: string, value: string) => localStorage.setItem(key, value)),
      removeItem: vi.fn((key: string) => localStorage.removeItem(key)),
      clear: vi.fn(() => localStorage.clear()),
    },

    router: {
      // React Router mocks - need to be compatible with real components
      BrowserRouter: ({ children }: { children: React.ReactNode }) => children,
      navigate: vi.fn(),
      useNavigate: vi.fn(() => vi.fn()),
      useLocation: vi.fn(() => ({ pathname: '/', search: '', hash: '', state: null })),
      useParams: vi.fn(() => ({})),
    },
  };
}

/**
 * Pre-configured mock instance for use in setup files
 */
export const mocks = createMocks();

/**
 * Reset all mocks - useful for cleanup between tests
 */
export function resetAllMocks() {
  Object.values(mocks).forEach(mockGroup => {
    Object.values(mockGroup).forEach(mock => {
      if (vi.isMockFunction(mock)) {
        mock.mockReset();
      }
    });
  });
}

/**
 * Utility to get a fresh mock factory for isolated testing
 */
export function createIsolatedMocks() {
  return createMocks();
}
