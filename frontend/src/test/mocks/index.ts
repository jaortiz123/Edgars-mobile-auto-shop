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
      // Drawer fetch used by AppointmentDrawer component
      getDrawer: vi.fn().mockImplementation((id: string) => {
        return Promise.resolve({
          appointment: {
            id: id || 'test-appointment-123',
            status: 'SCHEDULED',
            start: '2024-01-15T14:00:00Z',
            end: '2024-01-15T15:00:00Z',
            total_amount: 250.00,
            paid_amount: 0,
            check_in_at: null,
            check_out_at: null,
            tech_id: null
          },
          customer: { id: 'cust-123', name: 'Test Customer' },
          vehicle: { id: 'veh-123', make: 'Toyota', model: 'Camry', year: 2020 },
          services: []
        });
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

      // -------------------------------------------------------------
      // Message Templates (Increment 4 dynamic CRUD) - added to match
      // new api.ts exports so global vi.mock('@/lib/api') provides them.
      // Tests can override return values as needed.
      // -------------------------------------------------------------
      loadTemplatesWithFallback: vi.fn().mockResolvedValue([
        { id: 'tpl-1', slug: 'vehicle_ready_sms', label: 'Vehicle Ready', channel: 'sms', category: 'status', body: 'Hi {{customer.name}}, your vehicle is ready!', variables: ['customer.name'], is_active: true },
        { id: 'tpl-2', slug: 'appointment_reminder_sms', label: 'Reminder', channel: 'sms', category: 'reminder', body: 'Reminder: your appointment is tomorrow', variables: [], is_active: true }
      ]),
      createMessageTemplate: vi.fn().mockImplementation((payload: { slug: string; label: string; channel: 'sms' | 'email'; category?: string | null; body: string }) => Promise.resolve({
        id: 'tpl-new', slug: payload.slug, label: payload.label, channel: payload.channel, category: payload.category || null, body: payload.body, variables: [], is_active: true
      })),
      updateMessageTemplate: vi.fn().mockImplementation((idOrSlug: string, payload: { label?: string; channel?: 'sms' | 'email'; category?: string | null; body?: string; is_active?: boolean }) => Promise.resolve({
        id: idOrSlug, slug: idOrSlug, label: payload.label || 'Updated', channel: (payload.channel || 'sms'), category: payload.category || null, body: payload.body || 'Updated body', variables: [], is_active: payload.is_active !== false
      })),
      deleteMessageTemplate: vi.fn().mockResolvedValue({ deleted: true, soft: true }),
    },

    // Build notification object with closure references so functions work when imported standalone
    notification: (() => {
      const notif: any = {};
      notif._config = { maxNotifications: 100, retentionPeriod: 24*60*60*1000, rateLimitPerType: 3, enablePersistence: true, enableAnalytics: true, accessibilityEnabled: true };
      notif._analytics = [];
      notif._rateLimitMap = {} as Record<string, number[]>;
      notif._notifications = [] as any[];

      notif.addNotification = vi.fn(function(type: string, message: string, options: any = {}) {
        const sanitized = String(message).replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
        const now = Date.now();
        const key = String(type);
        if (!notif._rateLimitMap[key]) notif._rateLimitMap[key] = [];
        notif._rateLimitMap[key] = notif._rateLimitMap[key].filter((ts: number) => ts > now - 60000);
        if (notif._rateLimitMap[key].length >= (notif._config?.rateLimitPerType ?? 3)) {
          return '';
        }
        notif._rateLimitMap[key].push(now);

        let id: string;
        try {
          const rand = Math.random().toString(36).slice(2,9);
          id = `mock-${Date.now()}-${rand}`;
        } catch (e) {
          return '';
        }

        const notification = { id, type, message: sanitized, timestamp: new Date(), read: false, priority: options.priority || (type === 'error' ? 'critical' : 'medium'), expiresAt: options.expiresAt || new Date(Date.now() + (notif._config?.retentionPeriod || 24*60*60*1000)), retryCount: 0, source: 'mock', ...options };
        notif._notifications.push(notification);

        if (notif._config?.enableAnalytics) notif._analytics.push({ type: 'notification_created', notificationType: type, timestamp: new Date(), metadata: { priority: notification.priority } });

        if (notif._config?.enablePersistence && typeof globalThis.localStorage !== 'undefined') {
          try {
            const serialized = JSON.stringify(notif._notifications.map((n: any) => ({ ...n, timestamp: n.timestamp.toISOString(), expiresAt: n.expiresAt?.toISOString() })));
            globalThis.localStorage.setItem('notifications', serialized);
          } catch (e) {}
        }

        if (notif._observers && Array.isArray(notif._observers)) {
          notif._observers.forEach((obs: any) => { try { obs([...notif._notifications]); } catch (err) {} });
        }

        try {
          if (notif._config?.accessibilityEnabled && typeof document !== 'undefined' && typeof document.createElement === 'function') {
            const el = document.createElement('div');
            el.setAttribute('role', 'status');
            el.textContent = notification.message;
            if (document.body && document.body.appendChild) { document.body.appendChild(el); setTimeout(() => { try { document.body.removeChild(el); } catch (e) {} }, 0); }
          }
        } catch (e) {}

        return id;
      });

      notif.notifyArrival = vi.fn((customerName: string, appointmentId: string) => notif.addNotification('arrival', `${customerName} has arrived for their appointment`, { appointmentId, customerName }));
      notif.notifyLate = vi.fn((customerName: string, appointmentId: string, minutesLate: number) => notif.addNotification('late', `${customerName} is running ${minutesLate} minutes late`, { appointmentId, customerName, metadata: { minutesLate } }));
      notif.notifyOverdue = vi.fn((customerName: string, appointmentId: string, minutesOverdue: number) => notif.addNotification('overdue', `${customerName}'s appointment is ${minutesOverdue} minutes overdue`, { appointmentId, customerName, metadata: { minutesOverdue } }));
      notif.notifyReminder = vi.fn((customerName: string, appointmentId: string, minutesUntil: number) => notif.addNotification('reminder', `Reminder: ${customerName}'s appointment is in ${minutesUntil} minutes`, { appointmentId, customerName, metadata: { minutesUntil } }));
      notif.scheduleReminder = vi.fn((appointmentId: string, customerName: string, minutesUntil: number) => notif.notifyReminder(customerName, appointmentId, minutesUntil));

      notif.getNotifications = vi.fn(() => {
        const now = new Date();
        notif._notifications = notif._notifications.filter((n: any) => !(n.expiresAt && new Date(n.expiresAt) < now));
        const max = notif._config?.maxNotifications || 100;
        if (notif._notifications.length > max) notif._notifications = notif._notifications.slice(-max);
        return [...notif._notifications];
      });
      notif.getNotificationsByType = vi.fn((type: string) => notif._notifications.filter((n: any) => n.type === type));
      notif.getUnreadNotifications = vi.fn(() => notif._notifications.filter((n: any) => !n.read));
      notif.getAnalytics = vi.fn(() => [...notif._analytics]);
      notif.clearAnalytics = vi.fn(() => { notif._analytics = []; });

      notif.initializeService = vi.fn(() => {
        try {
          if (notif._config?.enablePersistence && typeof globalThis.localStorage !== 'undefined') {
            const stored = globalThis.localStorage.getItem('notifications');
            if (stored) {
              try { const parsed = JSON.parse(stored); notif._notifications = parsed.map((n: any) => ({ ...n, timestamp: n.timestamp ? new Date(n.timestamp) : new Date(), expiresAt: n.expiresAt ? new Date(n.expiresAt) : undefined })); } catch (e) { notif._notifications = []; }
            }
          }
        } catch (e) { notif._notifications = []; }
      });
      notif.cleanup = vi.fn(() => { notif._notifications = []; notif._observers = []; notif._analytics = []; });

      notif._observers = [] as Function[];
      notif.subscribe = vi.fn((observer: (notifications: any[]) => void) => { notif._observers.push(observer); return () => { const idx = notif._observers.indexOf(observer); if (idx !== -1) notif._observers.splice(idx,1); }; });

      notif.updateConfig = vi.fn((cfg: any) => { notif._config = { ...notif._config, ...cfg }; });
      notif.getConfig = vi.fn(() => ({ ...(notif._config || { maxNotifications: 100, retentionPeriod: 24*60*60*1000, rateLimitPerType: 3, enablePersistence: true, enableAnalytics: true, accessibilityEnabled: true }) }));
      notif.getStats = vi.fn(() => {
        const total = notif._notifications.length;
        const byType: Record<string, number> = {};
        notif._notifications.forEach((n: any) => { byType[n.type] = (byType[n.type] || 0) + 1; });
        const delivered = notif._notifications.filter((n: any) => !n.retryCount || n.retryCount === 0).length;
        const deliveryRate = total > 0 ? (delivered / total) * 100 : 100;
        const errors = notif._notifications.filter((n: any) => n.type === 'error').length;
        const errorRate = total > 0 ? (errors / total) * 100 : 0;
        return { total, byType, deliveryRate, errorRate, avgResponseTime: 0 };
      });

      notif.getAnalytics = vi.fn(() => notif._analytics || []);
      notif.clearAnalytics = vi.fn(() => { notif._analytics = []; });

      notif.markAsRead = vi.fn((id: string) => { const n = notif._notifications.find((x: any) => x.id === id); if (n) { n.read = true; return true; } return false; });
      notif.markNotificationAsRead = vi.fn((id: string) => notif.markAsRead(id));
      notif.markAllAsRead = vi.fn(() => { notif._notifications.forEach((n: any) => n.read = true); });
      notif.removeNotification = vi.fn((id: string) => { const idx = notif._notifications.findIndex((x: any) => x.id === id); if (idx !== -1) { notif._notifications.splice(idx,1); return true; } return false; });
      notif.clearAllNotifications = vi.fn(() => { notif._notifications = []; });
      notif.clearAll = vi.fn(() => { notif._notifications = []; });

      return notif;
    })(),

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
