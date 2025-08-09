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
      // expose getMinutesUntil used by tests
      getMinutesUntil: vi.fn((date: Date | string) => {
        const target = typeof date === 'string' ? new Date(date) : date;
        const diffMs = target.getTime() - Date.now();
        return Math.max(0, Math.round(diffMs / 60000));
      }),
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
      
      getAppointmentServices: vi.fn().mockImplementation((appointmentId: string) => {
        // Return an empty service list by default; tests can override via vi.mocked
        return Promise.resolve([]);
      }),
      getAppointmentMessages: vi.fn().mockImplementation((appointmentId: string) => {
        // Return an empty message list by default; tests can override via vi.mocked
        return Promise.resolve([]);
      }),
      createAppointmentMessage: vi.fn().mockImplementation((appointmentId: string, message: any) => {
        return Promise.resolve({ id: `msg-${Date.now()}`, status: 'sent' });
      }),
      getCustomerHistory: vi.fn().mockImplementation((customerId: string) => {
        return Promise.resolve({ success: true, data: { pastAppointments: [], payments: [] }, errors: null });
      }),
      
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
      _config: { maxNotifications: 100, retentionPeriod: 24*60*60*1000, rateLimitPerType: 10, enablePersistence: true, enableAnalytics: true, accessibilityEnabled: true },
      _analytics: [] as any[],
      _rateLimitMap: {} as Record<string, number[]>,
      _notifications: [] as any[],
      addNotification: vi.fn(function(type: string, message: string, options: any = {}) {
        // Simple sanitize to strip script tags
        const sanitized = String(message).replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');

        // Rate limiting per type using _config.rateLimitPerType
        const now = Date.now();
        const key = String(type);
        if (!(this as any)._rateLimitMap[key]) (this as any)._rateLimitMap[key] = [];
        // Remove timestamps older than 1 minute
        (this as any)._rateLimitMap[key] = (this as any)._rateLimitMap[key].filter((ts: number) => ts > now - 60000);
        if ((this as any)._rateLimitMap[key].length >= ((this as any)._config?.rateLimitPerType ?? 10)) {
          // Drop notification due to rate limiting
          return '';
        }
        (this as any)._rateLimitMap[key].push(now);

        const id = `mock-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
        const notification = {
          id,
          type,
          message: sanitized,
          timestamp: new Date(),
          read: false,
          priority: options.priority || (type === 'error' ? 'critical' : 'medium'),
          expiresAt: options.expiresAt || new Date(Date.now() + ((this as any)._config?.retentionPeriod || 24 * 60 * 60 * 1000)),
          retryCount: 0,
          source: 'mock',
          ...options
        };

        // store
        (this as any)._notifications.push(notification);

        // Analytics
        if ((this as any)._config?.enableAnalytics) {
          (this as any)._analytics.push({ type: 'notification_created', notificationType: type, timestamp: new Date(), metadata: { priority: notification.priority } });
        }

        // Persistence
        if ((this as any)._config?.enablePersistence && typeof globalThis.localStorage !== 'undefined') {
          try {
            const serialized = JSON.stringify((this as any)._notifications.map((n: any) => ({ ...n, timestamp: n.timestamp.toISOString(), expiresAt: n.expiresAt?.toISOString() })));
            globalThis.localStorage.setItem('notifications', serialized);
          } catch (e) {
            // ignore localStorage errors in mock
          }
        }

        // Notify observers
        if ((this as any)._observers && Array.isArray((this as any)._observers)) {
          (this as any)._observers.forEach((obs: any) => {
            try { obs([...((this as any)._notifications)]); } catch (err) { /* ignore */ }
          });
        }

        return id;
      }),

      notifyArrival: vi.fn().mockImplementation(function(customerName: string, appointmentId: string) {
        return (this as any).addNotification('arrival', `${customerName} has arrived for their appointment`, { appointmentId, customerName });
      }),
      notifyLate: vi.fn().mockImplementation(function(customerName: string, appointmentId: string, minutesLate: number) {
        return (this as any).addNotification('late', `${customerName} is running ${minutesLate} minutes late`, { appointmentId, customerName, metadata: { minutesLate } });
      }),
      notifyOverdue: vi.fn().mockImplementation(function(customerName: string, appointmentId: string, minutesOverdue: number) {
        return (this as any).addNotification('overdue', `${customerName}'s appointment is ${minutesOverdue} minutes overdue`, { appointmentId, customerName, metadata: { minutesOverdue } });
      }),
      notifyReminder: vi.fn().mockImplementation(function(customerName: string, appointmentId: string, minutesUntil: number) {
        return (this as any).addNotification('reminder', `Reminder: ${customerName}'s appointment is in ${minutesUntil} minutes`, { appointmentId, customerName, metadata: { minutesUntil } });
      }),
      scheduleReminder: vi.fn().mockImplementation(function(appointmentId: string, customerName: string, minutesUntil: number) {
        return (this as any).notifyReminder(customerName, appointmentId, minutesUntil);
      }),

      // Transport helpers
      sendSMS: vi.fn().mockResolvedValue({ messageId: 'mock-sms-id' }),
      sendEmail: vi.fn().mockResolvedValue({ messageId: 'mock-email-id' }),

      // Stateful accessors
      getNotifications: vi.fn(function() {
        // Cleanup expired
        const now = new Date();
        (this as any)._notifications = (this as any)._notifications.filter((n: any) => !(n.expiresAt && new Date(n.expiresAt) < now));
        // Enforce maxNotifications
        const max = (this as any)._config?.maxNotifications || 100;
        if ((this as any)._notifications.length > max) {
          (this as any)._notifications = (this as any)._notifications.slice(-max);
        }
        return [...(this as any)._notifications];
      }),
      getNotificationsByType: vi.fn(function(type: string) {
        return (this as any)._notifications.filter(n => n.type === type);
      }),
      getUnreadNotifications: vi.fn(function() {
        return (this as any)._notifications.filter(n => !n.read);
      }),
      getAnalytics: vi.fn(function() { return [...((this as any)._analytics || [])]; }),
      _analytics: [] as any[],
      clearAnalytics: vi.fn(function() { (this as any)._analytics = []; }),

      // Lifecycle
      initializeService: vi.fn(function() { /* no-op for mock */ }),
      cleanup: vi.fn(function() { (this as any)._notifications = []; (this as any)._observers = []; (this as any)._analytics = []; }),

      // Simulation controls
      simulateDeliveryFailure: vi.fn((shouldFail: boolean) => { /* no-op */ }),
      simulateDelay: vi.fn((ms: number) => { /* no-op */ }),

      // Observer pattern
      _observers: [] as Function[],
      subscribe: vi.fn(function(observer: (notifications: any[]) => void) {
        (this as any)._observers.push(observer);
        return () => {
          const idx = (this as any)._observers.indexOf(observer);
          if (idx !== -1) (this as any)._observers.splice(idx,1);
        };
      }),

      // Config & analytics
      updateConfig: vi.fn(function(cfg: any) { this._config = { ...(this as any)._config, ...cfg }; }),
      getConfig: vi.fn(function() { return (this as any)._config || { maxNotifications: 100, retentionPeriod: 24*60*60*1000, rateLimitPerType: 10, enablePersistence: true, enableAnalytics: true, accessibilityEnabled: true }; }),
      getStats: vi.fn(function() { return { total: (this as any)._notifications.length, byType: {}, deliveryRate: 100, errorRate: 0, avgResponseTime: 0 }; }),
      getAnalytics: vi.fn(function() { return (this as any)._analytics || []; }),
      clearAnalytics: vi.fn(function() { (this as any)._analytics = []; }),

      // Mutators
      markAsRead: vi.fn(function(id: string) {
        const n = (this as any)._notifications.find(x => x.id === id);
        if (n) { n.read = true; return true; }
        return false;
      }),
      markNotificationAsRead: vi.fn(function(id: string) { return (this as any).markAsRead(id); }),
      markAllAsRead: vi.fn(function() { (this as any)._notifications.forEach(n => n.read = true); }),
      removeNotification: vi.fn(function(id: string) {
        const idx = (this as any)._notifications.findIndex(x => x.id === id);
        if (idx !== -1) { (this as any)._notifications.splice(idx,1); return true; }
        return false;
      }),
      clearAllNotifications: vi.fn(function() { (this as any)._notifications = []; }),
      // alias used by some tests
      clearAll: vi.fn(function() { (this as any)._notifications = []; }),
    },

    toast: {
      // Minimal Toast mock used by components
      push: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      // Export a simple provider component for tests that mount components requiring it
      ToastProvider: ({ children }: { children: any }) => children,
      // For code that imports `useToast` or `toast` named export
      useToast: () => ({
        push: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn(),
      }),
      // Some modules expect a default `toast` object
      toast: {
        push: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn(),
      }
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
