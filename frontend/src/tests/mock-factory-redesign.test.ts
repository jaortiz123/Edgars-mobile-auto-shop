/**
 * P1-T-002: Mock Factory Redesign Validation Test
 * Tests the new dependency-injection mock factory to ensure it resolves circular dependencies
 */

import { describe, it, expect, vi } from 'vitest';
import createTestMocks, { withMocks, type TestMocks } from './mocks/index';

describe('P1-T-002: Redesigned Mock Factory', () => {
  describe('createTestMocks() factory function', () => {
    it('should create isolated mocks without circular dependencies', () => {
      const mocks = createTestMocks();

      expect(mocks).toBeDefined();
      expect(mocks.time).toBeDefined();
      expect(mocks.api).toBeDefined();
      expect(mocks.notification).toBeDefined();
      expect(mocks.resetAll).toBeDefined();

      // Verify mocks are independent (no cross-references)
      expect(typeof mocks.time.getMinutesUntil).toBe('function');
      expect(typeof mocks.api.getAppointments).toBe('function');
      expect(typeof mocks.notification.addNotification).toBe('function');
    });

    it('should provide working time mocks', () => {
      const { time } = createTestMocks();

      // Set a specific time
      time.setCurrentTime('2024-01-15T10:00:00Z');

      // Test time calculations
      const futureTime = '2024-01-15T10:30:00Z'; // 30 minutes from now
      expect(time.getMinutesUntil(futureTime)).toBe(30);
      expect(time.isStartingSoon(futureTime)).toBe(false);

      const soonTime = '2024-01-15T10:10:00Z'; // 10 minutes from now
      expect(time.getMinutesUntil(soonTime)).toBe(10);
      expect(time.isStartingSoon(soonTime)).toBe(true);

      const pastTime = '2024-01-15T09:45:00Z'; // 15 minutes ago
      expect(time.getMinutesUntil(pastTime)).toBe(-15);
      expect(time.isRunningLate(pastTime)).toBe(false); // beyond buffer
      expect(time.isOverdue(pastTime)).toBe(false); // not overdue yet
    });

    it('should provide working API mocks', async () => {
      const { api } = createTestMocks();

      // Test basic API functionality
      const appointments = await api.getAppointments();
      expect(appointments.success).toBe(true);
      expect(appointments.data.items).toHaveLength(2);
      expect(appointments.data.items[0].customer_name).toBe('John Doe');

      // Test API mock tracking
      expect(api.getAppointments).toHaveBeenCalledTimes(1);

      // Test network simulation
      api.simulateNetworkDelay(200);
      api.simulateFailureRate(0); // No failures for this test

      const board = await api.getBoard();
      expect(board.columns).toHaveLength(4); // Fixed: SCHEDULED, IN_PROGRESS, READY, COMPLETED
      expect(board.cards).toHaveLength(2); // Fixed: Two test appointments
    });

    it('should provide working notification mocks', () => {
      const { notification } = createTestMocks();

      // Test notification creation
      const notifId = notification.notifyArrival('John Doe', 'apt-123');
      expect(typeof notifId).toBe('string');
      expect(notification.getNotificationCount()).toBe(1);

      // Test notification retrieval
      const notifications = notification.getNotifications();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('arrival');
      expect(notifications[0].message).toContain('John Doe');

      // Test notification filtering
      notification.notifyLate('Jane Smith', 10, 'apt-456');
      expect(notification.getNotificationCount()).toBe(2);

      const arrivalNotifs = notification.getNotificationsByType('arrival');
      expect(arrivalNotifs).toHaveLength(1);

      const lateNotifs = notification.getNotificationsByType('late');
      expect(lateNotifs).toHaveLength(1);
    });

    it('should reset all mocks correctly', () => {
      const mocks = createTestMocks();

      // Use the mocks
      mocks.time.setCurrentTime('2024-01-15T11:00:00Z'); // Different time
      mocks.api.getAppointments();
      mocks.notification.notifyArrival('Test User');

      // Verify they have state
      expect(mocks.time.getCurrentTime().getTime()).not.toBe(new Date('2024-01-15T10:00:00Z').getTime());
      expect(mocks.api.getAppointments).toHaveBeenCalledTimes(1);
      expect(mocks.notification.getNotificationCount()).toBe(1);

      // Reset and verify clean state
      mocks.resetAll();

      expect(mocks.time.getCurrentTime().getTime()).toBe(new Date('2024-01-15T10:00:00Z').getTime());
      expect(mocks.api.getAppointments).toHaveBeenCalledTimes(0);
      expect(mocks.notification.getNotificationCount()).toBe(0);
    });
  });

  describe('withMocks() helper', () => {
    it('should provide mocks to test function', withMocks(({ time, api, notification }) => {
      expect(time).toBeDefined();
      expect(api).toBeDefined();
      expect(notification).toBeDefined();

      // Use the mocks
      time.setCurrentTime('2024-01-15T10:00:00Z');
      expect(time.getCurrentTime().getTime()).toBe(new Date('2024-01-15T10:00:00Z').getTime());
    }));

    it('should handle async test functions', withMocks(async ({ api }) => {
      const result = await api.getAppointments();
      expect(result.success).toBe(true);
      expect(result.data.items).toHaveLength(2);
    }));

    it('should automatically reset mocks after test', withMocks(({ notification }) => {
      notification.notifyArrival('Test User');
      expect(notification.getNotificationCount()).toBe(1);
      // Reset happens automatically after this test
    }));

    it('should verify mocks were reset from previous test', withMocks(({ notification }) => {
      // This should be 0 if reset worked correctly
      expect(notification.getNotificationCount()).toBe(0);
    }));
  });

  describe('Integration scenarios', () => {
    it('should handle appointment timing workflow', withMocks(({ time, api, notification }) => {
      // Set up scenario: appointment starting soon
      time.setCurrentTime('2024-01-15T10:00:00Z');
      const appointmentTime = '2024-01-15T10:10:00Z'; // 10 minutes from now

      // Check timing
      expect(time.isStartingSoon(appointmentTime)).toBe(true);
      expect(time.getMinutesUntil(appointmentTime)).toBe(10);

      // Notify about upcoming appointment
      const notifId = notification.notifyReminder('John Doe', 10, 'apt-123');
      expect(notifId).toBeDefined();

      // Advance time - appointment is now overdue
      time.advanceTime(30); // 30 minutes later (now 16 minutes overdue)
      expect(time.isOverdue(appointmentTime)).toBe(true);

      // Send overdue notification
      notification.notifyOverdue('John Doe', 15, 'apt-123');
      expect(notification.getNotificationCount()).toBe(2);

      const overdueNotifs = notification.getNotificationsByType('overdue');
      expect(overdueNotifs).toHaveLength(1);
      expect(overdueNotifs[0].message).toContain('15 minutes overdue');
    }));

    it('should handle API error scenarios', withMocks(async ({ api }) => {
      // Simulate network failures
      api.simulateFailureRate(1.0); // 100% failure rate

      try {
        await api.getAppointments();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('Network error');
      }

      // Reset to normal
      api.simulateFailureRate(0);
      const result = await api.getAppointments();
      expect(result.success).toBe(true);
    }));

    it('should handle complex notification scenarios', withMocks(({ notification }) => {
      // Create various notification types
      notification.notifyArrival('John Doe', 'apt-1');
      notification.notifyLate('Jane Smith', 5, 'apt-2');
      notification.notifyOverdue('Bob Johnson', 20, 'apt-3');
      notification.notifyReminder('Alice Brown', 15, 'apt-4');

      expect(notification.getNotificationCount()).toBe(4);

      // Test filtering
      expect(notification.getNotificationsByType('arrival')).toHaveLength(1);
      expect(notification.getNotificationsByType('late')).toHaveLength(1);
      expect(notification.getNotificationsByType('overdue')).toHaveLength(1);
      expect(notification.getNotificationsByType('reminder')).toHaveLength(1);

      // Test mark as read
      const notifications = notification.getNotifications();
      const firstNotifId = notifications[0].id;

      expect(notification.markNotificationAsRead(firstNotifId)).toBe(true);

      const updatedNotifications = notification.getNotifications();
      const markedNotif = updatedNotifications.find(n => n.id === firstNotifId);
      expect(markedNotif?.read).toBe(true);
    }));
  });

  describe('No circular dependencies', () => {
    it('should not have cross-references between mocks', () => {
      const mocks = createTestMocks();

      // Each mock should be independent
      expect(mocks.time).not.toBe(mocks.api);
      expect(mocks.time).not.toBe(mocks.notification);
      expect(mocks.api).not.toBe(mocks.notification);

      // Mocks should not reference each other internally
      expect(JSON.stringify(mocks.time)).not.toContain('api');
      expect(JSON.stringify(mocks.time)).not.toContain('notification');
      expect(JSON.stringify(mocks.api)).not.toContain('time');
      expect(JSON.stringify(mocks.api)).not.toContain('notification');
      expect(JSON.stringify(mocks.notification)).not.toContain('time');
      expect(JSON.stringify(mocks.notification)).not.toContain('api');
    });

    it('should work without global vi.mock declarations', () => {
      // This test verifies that we can create and use mocks
      // without relying on global vi.mock() calls

      const { time, api, notification } = createTestMocks();

      // All functionality should work
      time.setCurrentTime('2024-01-15T10:00:00Z');
      expect(time.getMinutesUntil('2024-01-15T10:30:00Z')).toBe(30);

      notification.notifyArrival('Test User');
      expect(notification.getNotificationCount()).toBe(1);

      // API calls should work
      expect(api.isOnline()).toBe(true);
    });
  });
});
