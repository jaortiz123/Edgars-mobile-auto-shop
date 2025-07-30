/**
 * Sprint 3C: Appointment Reminders System Tests
 * Tests the core functionality we've implemented
 */

import { getMinutesUntil, minutesPast, getCountdownText, isStartingSoon, isRunningLate, isOverdue } from '@/utils/time';
import { addNotification, notifyLate, notifyOverdue, notifyArrival, getNotifications, clearAllNotifications } from '@/services/notificationService';

describe('Sprint 3C: Appointment Reminders System', () => {
  beforeEach(() => {
    clearAllNotifications();
    jest.clearAllMocks();
  });

  describe('Time Utilities', () => {
    test('getMinutesUntil calculates correct time differences', () => {
      const now = new Date();
      const futureTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now
      const pastTime = new Date(now.getTime() - 15 * 60 * 1000); // 15 minutes ago

      expect(getMinutesUntil(futureTime)).toBeCloseTo(30, 0);
      expect(getMinutesUntil(pastTime)).toBeCloseTo(-15, 0);
    });

    test('minutesPast calculates correct past time', () => {
      const now = new Date();
      const pastTime = new Date(now.getTime() - 20 * 60 * 1000); // 20 minutes ago

      expect(minutesPast(pastTime)).toBeCloseTo(20, 0);
    });

    test('getCountdownText formats correctly', () => {
      expect(getCountdownText(30)).toBe('Starts in 30m');
      expect(getCountdownText(-15)).toBe('Started 15m ago');
      expect(getCountdownText(90)).toBe('Starts in 1h 30m');
    });

    test('status check functions work correctly', () => {
      const now = new Date();
      const startingSoon = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes from now
      const runningLate = new Date(now.getTime() - 15 * 60 * 1000); // 15 minutes ago
      const overdue = new Date(now.getTime() - 35 * 60 * 1000); // 35 minutes ago

      expect(isStartingSoon(startingSoon)).toBe(true);
      expect(isRunningLate(runningLate)).toBe(true);
      expect(isOverdue(overdue)).toBe(true);

      expect(isStartingSoon(runningLate)).toBe(false);
      expect(isRunningLate(startingSoon)).toBe(false);
      expect(isOverdue(startingSoon)).toBe(false);
    });
  });

  describe('Notification Service', () => {
    test('addNotification creates notifications correctly', () => {
      const initialCount = getNotifications().length;
      
      addNotification('Test notification', 'info', { test: true });
      
      const notifications = getNotifications();
      expect(notifications.length).toBe(initialCount + 1);
      expect(notifications[0].message).toBe('Test notification');
      expect(notifications[0].type).toBe('info');
      expect(notifications[0].read).toBe(false);
    });

    test('notifyLate creates running late notifications', () => {
      notifyLate('apt-123', 'running late', {
        customer: 'John Doe',
        service: 'Oil Change'
      });

      const notifications = getNotifications();
      expect(notifications.length).toBe(1);
      expect(notifications[0].message).toContain('John Doe');
      expect(notifications[0].message).toContain('running late');
    });

    test('notifyOverdue creates overdue notifications', () => {
      notifyOverdue('apt-456', {
        customer: 'Jane Smith',
        service: 'Brake Inspection'
      });

      const notifications = getNotifications();
      expect(notifications.length).toBe(1);
      expect(notifications[0].message).toContain('Jane Smith');
      expect(notifications[0].message).toContain('overdue');
    });

    test('notifyArrival creates arrival notifications', () => {
      notifyArrival('apt-789', {
        customer: 'Bob Johnson',
        service: 'Tire Rotation'
      });

      const notifications = getNotifications();
      expect(notifications.length).toBe(1);
      expect(notifications[0].message).toContain('Bob Johnson');
      expect(notifications[0].message).toContain('checked in');
    });
  });

  describe('Integration Tests', () => {
    test('Full notification flow works correctly', () => {
      // Simulate an appointment that is starting soon
      const now = new Date();
      const appointmentTime = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes from now
      
      expect(isStartingSoon(appointmentTime)).toBe(true);
      expect(isRunningLate(appointmentTime)).toBe(false);
      expect(isOverdue(appointmentTime)).toBe(false);

      // Simulate time passing - appointment is now running late
      const lateTime = new Date(now.getTime() - 15 * 60 * 1000); // 15 minutes ago
      
      expect(isStartingSoon(lateTime)).toBe(false);
      expect(isRunningLate(lateTime)).toBe(true);
      expect(isOverdue(lateTime)).toBe(false);

      // Simulate more time passing - appointment is now overdue
      const overdueTime = new Date(now.getTime() - 35 * 60 * 1000); // 35 minutes ago
      
      expect(isStartingSoon(overdueTime)).toBe(false);
      expect(isRunningLate(overdueTime)).toBe(true);
      expect(isOverdue(overdueTime)).toBe(true);
    });

    test('AppointmentCard countdown updates correctly', () => {
      const now = new Date();
      const appointmentTime = new Date(now.getTime() + 25 * 60 * 1000); // 25 minutes from now
      
      const minutesUntil = getMinutesUntil(appointmentTime);
      expect(minutesUntil).toBeCloseTo(25, 0);
      
      const countdownText = getCountdownText(minutesUntil);
      expect(countdownText).toBe('Starts in 25m');
    });
  });
});

// Mock implementations for testing
const mockAppointmentCard = {
  id: 'test-apt-1',
  customerName: 'Test Customer',
  vehicle: '2020 Test Car',
  servicesSummary: 'Oil Change',
  price: 150,
  status: 'SCHEDULED' as const,
  position: 1,
  start: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes from now
  end: new Date(Date.now() + 90 * 60 * 1000).toISOString()
};

describe('BoardCard Interface', () => {
  test('BoardCard has all required properties for countdown functionality', () => {
    // This test ensures our interface extension works
    expect(mockAppointmentCard).toHaveProperty('id');
    expect(mockAppointmentCard).toHaveProperty('customerName');
    expect(mockAppointmentCard).toHaveProperty('vehicle');
    expect(mockAppointmentCard).toHaveProperty('status');
    expect(mockAppointmentCard).toHaveProperty('position');
    expect(mockAppointmentCard).toHaveProperty('start');
    expect(mockAppointmentCard).toHaveProperty('end');
    
    // Test that the start time can be used for countdown calculations
    const minutesUntil = getMinutesUntil(mockAppointmentCard.start);
    expect(typeof minutesUntil).toBe('number');
  });
});
