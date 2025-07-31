/**
 * Sprint 7 Task 4: Mock Factory Basic Validation Test  
 * Simple test to validate the mock factory system is working
 */

import { describe, it, expect } from 'vitest';
import { createMockFactory, createTimeMocks, createApiMocks, createNotificationMocks } from './mockFactory';

describe('Sprint 7 Task 4: Mock Factory Basic Validation', () => {
  describe('Mock Factory Creation', () => {
    it('should create a mock factory with all components', () => {
      const factory = createMockFactory();
      
      expect(factory).toBeDefined();
      expect(factory.time).toBeDefined();
      expect(factory.api).toBeDefined();
      expect(factory.browser).toBeDefined();
      expect(factory.notifications).toBeDefined();
      expect(factory.resetAll).toBeDefined();
      expect(factory.applyGlobally).toBeDefined();
    });

    it('should create time mocks with expected functions', () => {
      const timeMocks = createTimeMocks();
      
      expect(timeMocks.getMinutesUntil).toBeDefined();
      expect(timeMocks.isStartingSoon).toBeDefined();
      expect(timeMocks.isRunningLate).toBeDefined();
      expect(timeMocks.isOverdue).toBeDefined();
      expect(timeMocks.getUrgencyLevel).toBeDefined();
      expect(timeMocks.formatDuration).toBeDefined();
      expect(timeMocks.getCountdownText).toBeDefined();
      expect(timeMocks.minutesPast).toBeDefined();
      expect(timeMocks.setCurrentTime).toBeDefined();
      expect(timeMocks.advanceTime).toBeDefined();
      expect(timeMocks.getCurrentTime).toBeDefined();
      expect(timeMocks.reset).toBeDefined();
    });

    it('should create API mocks with expected functions', () => {
      const apiMocks = createApiMocks();
      
      expect(apiMocks.getAppointments).toBeDefined();
      expect(apiMocks.createAppointment).toBeDefined();
      expect(apiMocks.updateAppointmentStatus).toBeDefined();
      expect(apiMocks.moveAppointment).toBeDefined();
      expect(apiMocks.getDashboardStats).toBeDefined();
      expect(apiMocks.clearCache).toBeDefined();
      expect(apiMocks.getRequestCount).toBeDefined();
      expect(apiMocks.setFailureRate).toBeDefined();
      expect(apiMocks.setNetworkDelay).toBeDefined();
      expect(apiMocks.reset).toBeDefined();
    });

    it('should create notification mocks with expected functions', () => {
      const notificationMocks = createNotificationMocks();
      
      expect(notificationMocks.addNotification).toBeDefined();
      expect(notificationMocks.removeNotification).toBeDefined();
      expect(notificationMocks.clearAllNotifications).toBeDefined();
      expect(notificationMocks.getNotifications).toBeDefined();
      expect(notificationMocks.notifyArrival).toBeDefined();
      expect(notificationMocks.notifyLate).toBeDefined();
      expect(notificationMocks.notifyOverdue).toBeDefined();
      expect(notificationMocks.markNotificationAsRead).toBeDefined();
      expect(notificationMocks.getNotificationCount).toBeDefined();
      expect(notificationMocks.getNotificationsByType).toBeDefined();
      expect(notificationMocks.reset).toBeDefined();
    });
  });

  describe('Time Mock Functionality', () => {
    it('should provide time manipulation functions', () => {
      const timeMocks = createTimeMocks();
      const baseTime = new Date('2024-01-15T10:00:00Z');
      
      timeMocks.setCurrentTime(baseTime);
      expect(timeMocks.getCurrentTime().getTime()).toBe(baseTime.getTime());
      
      timeMocks.advanceTime(30);
      const expectedTime = new Date(baseTime.getTime() + 30 * 60 * 1000);
      expect(timeMocks.getCurrentTime().getTime()).toBe(expectedTime.getTime());
    });

    it('should calculate minutes correctly', () => {
      const timeMocks = createTimeMocks();
      const baseTime = new Date('2024-01-15T10:00:00Z');
      timeMocks.setCurrentTime(baseTime);
      
      const futureTime = new Date(baseTime.getTime() + 30 * 60 * 1000);
      const result = timeMocks.getMinutesUntil(futureTime.toISOString());
      expect(result).toBe(30);
    });

    it('should format duration correctly', () => {
      const timeMocks = createTimeMocks();
      
      expect(timeMocks.formatDuration(30)).toBe('30m');
      expect(timeMocks.formatDuration(90)).toBe('1h 30m');
      expect(timeMocks.formatDuration(120)).toBe('2h');
    });
  });

  describe('API Mock Functionality', () => {
    it('should provide realistic appointment data', async () => {
      const apiMocks = createApiMocks();
      const response = await apiMocks.getAppointments();
      
      expect(response.success).toBe(true);
      expect(response.data.items).toBeDefined();
      expect(Array.isArray(response.data.items)).toBe(true);
      expect(response.data.items.length).toBeGreaterThan(0);
      
      const appointment = response.data.items[0];
      expect(appointment).toHaveProperty('id');
      expect(appointment).toHaveProperty('customer_name');
      expect(appointment).toHaveProperty('service');
      expect(appointment).toHaveProperty('scheduled_at');
      expect(appointment).toHaveProperty('status');
    });

    it('should track request count', async () => {
      const apiMocks = createApiMocks();
      const initialCount = apiMocks.getRequestCount();
      
      await apiMocks.getAppointments();
      expect(apiMocks.getRequestCount()).toBe(initialCount + 1);
    });
  });

  describe('Notification Mock Functionality', () => {
    it('should create and manage notifications', () => {
      const notificationMocks = createNotificationMocks();
      
      const id = notificationMocks.addNotification('info', 'Test message');
      expect(typeof id).toBe('string');
      expect(notificationMocks.getNotificationCount()).toBe(1);
      
      const notifications = notificationMocks.getNotifications();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('info');
      expect(notifications[0].message).toBe('Test message');
    });

    it('should handle appointment notifications', () => {
      const notificationMocks = createNotificationMocks();
      
      notificationMocks.notifyArrival('John Doe');
      notificationMocks.notifyLate('Jane Smith', 10);
      notificationMocks.notifyOverdue('Bob Johnson', 20);
      
      expect(notificationMocks.getNotificationCount()).toBe(3);
      
      const notifications = notificationMocks.getNotifications();
      const types = notifications.map((n: { type: string }) => n.type);
      expect(types).toContain('arrival');
      expect(types).toContain('late');
      expect(types).toContain('overdue');
    });
  });

  describe('Mock Factory Integration', () => {
    it('should reset all mocks', () => {
      const factory = createMockFactory();
      
      // Create some state
      factory.notifications!.addNotification('test', 'message');
      factory.time.setCurrentTime('2024-01-01T00:00:00Z');
      
      expect(factory.notifications!.getNotificationCount()).toBe(1);
      
      // Reset
      factory.resetAll();
      
      expect(factory.notifications!.getNotificationCount()).toBe(0);
    });

    it('should apply global mocks without errors', () => {
      const factory = createMockFactory();
      
      expect(() => {
        factory.applyGlobally();
      }).not.toThrow();
      
      // Verify some globals were set
      expect(global.IntersectionObserver).toBeDefined();
      expect(global.ResizeObserver).toBeDefined();
    });
  });
});
