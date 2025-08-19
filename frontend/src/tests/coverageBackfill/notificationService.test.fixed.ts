/**
 * P2-T-004 Coverage Tests - Notification Service
 * Tests specifically designed to achieve coverage on critical notificationService functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  addNotification,
  notifyLate,
  notifyOverdue,
  notifyArrival,
  notifyReminder,
  scheduleReminder,
  getNotifications,
  getNotificationsByType,
  getUnreadNotifications,
  markAsRead,
  markNotificationAsRead,
  markAllAsRead,
  removeNotification,
  clearAllNotifications,
  subscribe,
  updateConfig,
  getConfig,
  getStats,
  getAnalytics,
  clearAnalytics,
  initializeService,
  cleanup
} from '../../services/notificationService';

interface MockNotification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  priority?: string;
  timestamp?: Date | string;
  appointmentId?: string;
  customerName?: string;
}

describe('NotificationService Coverage Tests', () => {
  // Mock localStorage
  const mockLocalStorage = {
    store: {} as Record<string, string>,
    getItem: vi.fn((key: string) => mockLocalStorage.store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      mockLocalStorage.store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete mockLocalStorage.store[key];
    }),
    clear: vi.fn(() => {
      mockLocalStorage.store = {};
    })
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    mockLocalStorage.clear();

    // Setup localStorage mock
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });

    // Mock Date.now for consistent IDs
    vi.spyOn(Date, 'now').mockReturnValue(1640995200000);

    // Mock performance.now
    vi.spyOn(performance, 'now').mockReturnValue(100);

    // Mock document.createElement for accessibility tests
    const mockElement = {
      setAttribute: vi.fn(),
      textContent: '',
      className: '',
      style: {}
    } as unknown as HTMLElement;

    vi.spyOn(document, 'createElement').mockReturnValue(mockElement);
    vi.spyOn(document.body, 'appendChild').mockImplementation(vi.fn());
    vi.spyOn(document.body, 'removeChild').mockImplementation(vi.fn());

    // Mock console methods to avoid output during tests
    vi.spyOn(console, 'debug').mockImplementation(vi.fn());
    vi.spyOn(console, 'warn').mockImplementation(vi.fn());
    vi.spyOn(console, 'error').mockImplementation(vi.fn());

    // Mock getElementById for accessibility tests
    vi.spyOn(document, 'getElementById').mockReturnValue(null);

    // Clear notifications at start of each test
    clearAllNotifications();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Core Notification Functions', () => {
    it('should add a basic notification', () => {
      const id = addNotification('info', 'Test message');

      expect(id).toBeTruthy();
      const notifications = getNotifications();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].message).toBe('Test message');
      expect(notifications[0].type).toBe('info');
    });

    it('should add notification with all options', () => {
      const options = {
        appointmentId: 'apt-123',
        customerName: 'John Doe',
        priority: 'high' as const,
        metadata: { test: true }
      };

      const id = addNotification('reminder', 'Reminder message', options);

      expect(id).toBeTruthy();
      const notifications = getNotifications();
      expect(notifications[0]).toMatchObject({
        type: 'reminder',
        message: 'Reminder message',
        appointmentId: 'apt-123',
        customerName: 'John Doe',
        priority: 'high'
      });
    });

    it('should handle rate limiting', () => {
      // Create many notifications of the same type to trigger rate limiting
      const ids: string[] = [];
      for (let i = 0; i < 15; i++) {
        const id = addNotification('info', `Message ${i}`);
        ids.push(id);
      }

      // Some should be dropped due to rate limiting
      const emptyIds = ids.filter(id => id === '');
      expect(emptyIds.length).toBeGreaterThan(0);
    });

    it('should sanitize message input', () => {
      const maliciousMessage = '<script>alert("xss")</script>Test';
      addNotification('info', maliciousMessage);

      const notifications = getNotifications();
      expect(notifications[0].message).not.toContain('<script>');
      expect(notifications[0].message).toContain('Test');
    });
  });

  describe('Notification Retrieval', () => {
    beforeEach(() => {
      // Add test notifications
      addNotification('info', 'Info message');
      addNotification('error', 'Error message');
      addNotification('reminder', 'Reminder message');
    });

    it('should get all notifications', () => {
      const notifications = getNotifications();
      expect(notifications).toHaveLength(3);
    });

    it('should get notifications by type', () => {
      const errorNotifications = getNotificationsByType('error');
      expect(errorNotifications).toHaveLength(1);
      expect(errorNotifications[0].type).toBe('error');
    });

    it('should get unread notifications', () => {
      const allNotifications = getNotifications();
      markAsRead(allNotifications[0].id);

      const unreadNotifications = getUnreadNotifications();
      expect(unreadNotifications).toHaveLength(2);
    });
  });

  describe('Notification State Management', () => {
    it('should mark notification as read', () => {
      const id = addNotification('info', 'Test message');
      const result = markAsRead(id);

      expect(result).toBe(true);
      const notification = getNotifications().find((n: MockNotification) => n.id === id);
      expect(notification?.read).toBe(true);
    });

    it('should mark notification as read using alias method', () => {
      const id = addNotification('info', 'Test message');
      const result = markNotificationAsRead(id);

      expect(result).toBe(true);
      const notification = getNotifications().find((n: MockNotification) => n.id === id);
      expect(notification?.read).toBe(true);
    });

    it('should mark all notifications as read', () => {
      addNotification('info', 'Message 1');
      addNotification('info', 'Message 2');

      markAllAsRead();

      const notifications = getNotifications();
      expect(notifications.every((n: MockNotification) => n.read)).toBe(true);
    });

    it('should remove notification by ID', () => {
      const id = addNotification('info', 'Test message');
      const result = removeNotification(id);

      expect(result).toBe(true);
      expect(getNotifications()).toHaveLength(0);
    });

    it('should clear all notifications', () => {
      addNotification('info', 'Message 1');
      addNotification('info', 'Message 2');

      clearAllNotifications();

      expect(getNotifications()).toHaveLength(0);
    });
  });

  describe('Specialized Notification Functions', () => {
    it('should notify customer is late', () => {
      const id = notifyLate('John Doe', 'apt-123', 15);

      expect(id).toBeTruthy();
      const notifications = getNotifications();
      expect(notifications[0].type).toBe('late');
      expect(notifications[0].message).toContain('John Doe');
      expect(notifications[0].message).toContain('15 minutes late');
    });

    it('should notify appointment is overdue', () => {
      const id = notifyOverdue('Jane Smith', 'apt-456', 30);

      expect(id).toBeTruthy();
      const notifications = getNotifications();
      expect(notifications[0].type).toBe('overdue');
      expect(notifications[0].message).toContain('Jane Smith');
      expect(notifications[0].message).toContain('30 minutes overdue');
    });

    it('should notify customer arrival', () => {
      const id = notifyArrival('Bob Wilson', 'apt-789');

      expect(id).toBeTruthy();
      const notifications = getNotifications();
      expect(notifications[0].type).toBe('arrival');
      expect(notifications[0].message).toContain('Bob Wilson');
      expect(notifications[0].message).toContain('arrived');
    });

    it('should create reminder notification', () => {
      const id = notifyReminder('Alice Cooper', 'apt-101', 10);

      expect(id).toBeTruthy();
      const notifications = getNotifications();
      expect(notifications[0].type).toBe('reminder');
      expect(notifications[0].message).toContain('Alice Cooper');
      expect(notifications[0].message).toContain('10 minutes');
    });

    it('should schedule a reminder', () => {
      const id = scheduleReminder('apt-202', 'Charlie Brown', 5);

      expect(id).toBeTruthy();
      const notifications = getNotifications();
      expect(notifications[0].type).toBe('reminder');
    });
  });

  describe('Observer Pattern', () => {
    it('should subscribe to notification changes', () => {
      const observer = vi.fn();
      const unsubscribe = subscribe(observer);

      addNotification('info', 'Test message');

      expect(observer).toHaveBeenCalledWith(expect.any(Array));
      expect(observer.mock.calls[0][0]).toHaveLength(1);

      unsubscribe();
    });

    it('should unsubscribe from notification changes', () => {
      const observer = vi.fn();
      const unsubscribe = subscribe(observer);

      unsubscribe();
      addNotification('info', 'Test message');

      expect(observer).not.toHaveBeenCalled();
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const newConfig = { maxNotifications: 50, enablePersistence: false };
      updateConfig(newConfig);

      const currentConfig = getConfig();
      expect(currentConfig.maxNotifications).toBe(50);
      expect(currentConfig.enablePersistence).toBe(false);
    });

    it('should get current configuration', () => {
      const config = getConfig();

      expect(config).toHaveProperty('maxNotifications');
      expect(config).toHaveProperty('retentionPeriod');
      expect(config).toHaveProperty('enablePersistence');
    });
  });

  describe('Analytics and Statistics', () => {
    it('should track notification statistics', () => {
      addNotification('info', 'Message 1');
      addNotification('error', 'Message 2');
      addNotification('info', 'Message 3');

      const stats = getStats();

      expect(stats.total).toBe(3);
      expect(stats.byType.info).toBe(2);
      expect(stats.byType.error).toBe(1);
      expect(stats.deliveryRate).toBeGreaterThan(0);
    });

    it('should get analytics data', () => {
      addNotification('info', 'Test message');

      const analytics = getAnalytics();
      expect(analytics).toBeInstanceOf(Array);
      expect(analytics.length).toBeGreaterThan(0);
    });

    it('should clear analytics data', () => {
      addNotification('info', 'Test message');
      clearAnalytics();

      const analytics = getAnalytics();
      expect(analytics).toHaveLength(0);
    });
  });

  describe('Persistence and Storage', () => {
    it('should save notifications to localStorage when persistence enabled', () => {
      updateConfig({ enablePersistence: true });
      addNotification('info', 'Persistent message');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'notifications',
        expect.stringContaining('Persistent message')
      );
    });

    it('should load notifications from localStorage on initialization', () => {
      const testNotifications = [{
        id: 'test-1',
        type: 'info',
        message: 'Loaded message',
        timestamp: new Date().toISOString(),
        read: false,
        priority: 'medium'
      }];

      mockLocalStorage.setItem('notifications', JSON.stringify(testNotifications));

      // Re-initialize to trigger loading with stored data
      initializeService();

      const notifications = getNotifications();
      expect(notifications.some((n: MockNotification) => n.message === 'Loaded message')).toBe(true);
    });

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      // Should not throw error
      expect(() => {
        addNotification('info', 'Test message');
      }).not.toThrow();
    });
  });

  describe('Cleanup and Maintenance', () => {
    it('should cleanup expired notifications', () => {
      // Add notification with past expiration date
      const pastDate = new Date(Date.now() - 1000);
      addNotification('info', 'Expired message', {
        expiresAt: pastDate
      });

      // Add current notification
      addNotification('info', 'Current message');

      // Get notifications triggers cleanup
      const notifications = getNotifications();

      // Only current notification should remain
      expect(notifications).toHaveLength(1);
      expect(notifications[0].message).toBe('Current message');
    });

    it('should enforce maximum notification limit', () => {
      updateConfig({ maxNotifications: 3 });

      // Add more than the limit
      for (let i = 0; i < 5; i++) {
        addNotification('info', `Message ${i}`);
      }

      const notifications = getNotifications();
      expect(notifications.length).toBeLessThanOrEqual(3);
    });

    it('should cleanup service resources', () => {
      addNotification('info', 'Test message');

      cleanup();

      const notifications = getNotifications();
      expect(notifications).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in addNotification gracefully', () => {
      // Force an error by mocking a function to throw
      vi.spyOn(Math, 'random').mockImplementation(() => {
        throw new Error('Random error');
      });

      const id = addNotification('info', 'Test message');

      // Should return empty string on error
      expect(id).toBe('');

      vi.restoreAllMocks();
    });

    it('should handle malformed observer gracefully', () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        subscribe(null as unknown as (notifications: any[]) => void);
      }).not.toThrow();
    });

    it('should handle undefined notification ID in markAsRead', () => {
      const result = markAsRead('non-existent-id');
      expect(result).toBe(false);
    });

    it('should handle empty notification list operations', () => {
      clearAllNotifications();

      expect(() => {
        markAllAsRead();
        getUnreadNotifications();
        getNotificationsByType('info');
      }).not.toThrow();
    });
  });

  describe('Accessibility Features', () => {
    it('should announce notifications to screen readers when enabled', () => {
      updateConfig({ accessibilityEnabled: true });
      addNotification('info', 'Important message');

      // Should have called document.createElement for screen reader announcement
      expect(document.createElement).toHaveBeenCalledWith('div');
    });

    it('should not announce when accessibility is disabled', () => {
      updateConfig({ accessibilityEnabled: false });
      vi.clearAllMocks();

      addNotification('info', 'Test message');

      expect(document.createElement).not.toHaveBeenCalled();
    });
  });
});
