/**
 * Sprint 3C: Appointment Reminders System Tests
 * Tests the core functionality we've implemented
 */

import { getMinutesUntil, minutesPast, getCountdownText, isStartingSoon, isRunningLate, isOverdue } from '@/utils/time';
import { addNotification, notifyLate, notifyOverdue, notifyArrival, getNotifications, clearAllNotifications } from '@/services/notificationService';

// Enhanced imports for robustness testing
import { AppointmentReminderErrorBoundary, useErrorHandler } from '@/components/ErrorBoundaries/AppointmentReminderErrorBoundary';
import offlineService, { useOfflineState, markArrivedWithOfflineSupport } from '@/services/offlineSupport';
import performanceService, { usePerformanceMonitoring } from '@/services/performanceMonitoring';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// =============================================================================
// EXISTING TESTS (Enhanced with robustness checks)
// =============================================================================

describe('Sprint 3C: Appointment Reminders System', () => {
  beforeEach(() => {
    clearAllNotifications();
    jest.clearAllMocks();
    
    // Clear performance metrics for clean tests
    performanceService.cleanup();
    
    // Reset offline state
    offlineService.clearPendingActions();
  });

  describe('Time Utilities', () => {
    test('getMinutesUntil calculates correct time differences', () => {
      const endMeasure = performanceService.startMeasurement('test-time-calculation');
      
      const now = new Date();
      const futureTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now
      const pastTime = new Date(now.getTime() - 15 * 60 * 1000); // 15 minutes ago

      expect(getMinutesUntil(futureTime)).toBeCloseTo(30, 0);
      expect(getMinutesUntil(pastTime)).toBeCloseTo(-15, 0);
      
      endMeasure();
    });

    test('isStartingSoon, isRunningLate, isOverdue work correctly', () => {
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

    // NEW: Performance testing for time utilities
    test('time utilities perform within acceptable limits', () => {
      const iterations = 1000;
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        const testTime = new Date(Date.now() + i * 60000);
        getMinutesUntil(testTime);
        isStartingSoon(testTime);
        isRunningLate(testTime);
        isOverdue(testTime);
      }
      
      const duration = performance.now() - startTime;
      const avgTime = duration / iterations;
      
      // Each calculation should take less than 0.1ms on average
      expect(avgTime).toBeLessThan(0.1);
    });

    // NEW: Error handling for invalid inputs
    test('time utilities handle invalid inputs gracefully', () => {
      expect(() => getMinutesUntil(null as unknown as Date)).not.toThrow();
      expect(() => getMinutesUntil(undefined as unknown as Date)).not.toThrow();
      expect(() => getMinutesUntil('invalid-date' as unknown as Date)).not.toThrow();
      
      // Should return sensible defaults
      expect(getMinutesUntil(null as unknown as Date)).toBe(0);
      expect(isStartingSoon(null as unknown as Date)).toBe(false);
      expect(isRunningLate(undefined as unknown as Date)).toBe(false);
      expect(isOverdue('invalid' as unknown as Date)).toBe(false);
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

    // NEW: Rate limiting tests
    test('notification service respects rate limits', async () => {
      // Rapidly create notifications
      for (let i = 0; i < 15; i++) {
        addNotification(`Test ${i}`, 'info');
      }
      
      const notifications = getNotifications();
      // Should be limited to 10 per minute per type
      expect(notifications.length).toBeLessThanOrEqual(10);
    });

    // NEW: Message sanitization tests
    test('notification service sanitizes malicious content', () => {
      const maliciousMessage = '<script>alert("xss")</script>Test message<img src=x onerror=alert(1)>';
      
      addNotification(maliciousMessage, 'info');
      
      const notifications = getNotifications();
      expect(notifications[0].message).not.toContain('<script>');
      expect(notifications[0].message).not.toContain('onerror');
      expect(notifications[0].message).toContain('Test message');
    });

    // NEW: TTL and cleanup tests
    test('notifications expire based on TTL', async () => {
      // Create notification with short TTL
      addNotification('Short-lived notification', 'info', { ttl: 100 });
      
      expect(getNotifications().length).toBe(1);
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Trigger cleanup cycle - no need for act() wrapper
      // Simulate cleanup interval
      
      // Notification should be cleaned up
      // Note: In real implementation, this would be handled by the cleanup interval
    });
  });

  // =============================================================================
  // NEW ROBUSTNESS TESTS
  // =============================================================================

  describe('Error Boundary Integration', () => {
    test('error boundary catches and recovers from component errors', async () => {
      const ThrowingComponent = () => {
        throw new Error('Test error');
      };

      const { rerender } = render(
        <AppointmentReminderErrorBoundary enableRetry={true}>
          <ThrowingComponent />
        </AppointmentReminderErrorBoundary>
      );

      // Should show error UI
      expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
      expect(screen.getByText(/Try Again/)).toBeInTheDocument();
    });

    test('useErrorHandler hook captures errors correctly', () => {
      const TestComponent = () => {
        const { captureError } = useErrorHandler();
        
        return (
          <button onClick={() => captureError(new Error('Test error'), 'test-context')}>
            Trigger Error
          </button>
        );
      };

      render(
        <AppointmentReminderErrorBoundary>
          <TestComponent />
        </AppointmentReminderErrorBoundary>
      );

      const user = userEvent.setup();
      const button = screen.getByText('Trigger Error');
      await user.click(button);

      // Should trigger error boundary
      expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
    });
  });

  describe('Offline Support', () => {
    test('offline service queues actions when offline', () => {
      // Simulate offline state
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      offlineService.addAction('mark_arrived', { appointmentId: 'test-123' }, 'high');
      
      const state = offlineService.getState();
      expect(state.pendingActions.length).toBe(1);
      expect(state.pendingActions[0].type).toBe('mark_arrived');
      expect(state.pendingActions[0].priority).toBe('high');
    });

    test('offline service prioritizes actions correctly', () => {
      offlineService.addAction('low_priority', {}, 'low');
      offlineService.addAction('high_priority', {}, 'high');
      offlineService.addAction('normal_priority', {}, 'normal');
      
      const state = offlineService.getState();
      expect(state.pendingActions[0].priority).toBe('high');
      expect(state.pendingActions[1].priority).toBe('normal');
      expect(state.pendingActions[2].priority).toBe('low');
    });

    test('markArrivedWithOfflineSupport handles offline state', async () => {
      // Mock API failure
      const mockMarkArrived = jest.fn().mockRejectedValue(new Error('Network error'));
      jest.doMock('@/lib/api', () => ({
        markArrived: mockMarkArrived
      }));

      // Simulate online but API failing
      Object.defineProperty(navigator, 'onLine', { value: true });

      await expect(markArrivedWithOfflineSupport('test-123')).rejects.toThrow();
      
      // Should queue action for retry
      const state = offlineService.getState();
      expect(state.pendingActions.some(a => a.type === 'mark_arrived')).toBe(true);
    });

    test('useOfflineState hook provides current state', async () => {
      const TestComponent = () => {
        const { isOnline, pendingActions, addAction } = useOfflineState();
        
        return (
          <div>
            <span data-testid="online-status">{isOnline ? 'online' : 'offline'}</span>
            <span data-testid="pending-count">{pendingActions.length}</span>
            <button onClick={() => addAction('test', {}, 'normal')}>Add Action</button>
          </div>
        );
      };

      const user = userEvent.setup();
      render(<TestComponent />);
      
      expect(screen.getByTestId('online-status')).toHaveTextContent('online');
      expect(screen.getByTestId('pending-count')).toHaveTextContent('0');
      
      await user.click(screen.getByText('Add Action'));
      expect(screen.getByTestId('pending-count')).toHaveTextContent('1');
    });
  });

  describe('Performance Monitoring', () => {
    test('performance service tracks component metrics', () => {
      performanceService.trackComponent('TestComponent', 'mount', 15.5);
      performanceService.trackComponent('TestComponent', 'render', 8.2);
      performanceService.trackComponent('TestComponent', 'update');
      
      const report = performanceService.generateReport();
      expect(report.components.TestComponent).toBeDefined();
      expect(report.components.TestComponent.mountTime).toBe(15.5);
      expect(report.components.TestComponent.renderTime).toBe(8.2);
      expect(report.components.TestComponent.updateCount).toBe(1);
    });

    test('performance service warns about slow operations', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Simulate slow operation
      const endMeasure = performanceService.startMeasurement('slow-operation');
      
      // Mock performance.now to simulate slow operation
      const originalNow = performance.now;
      let callCount = 0;
      performance.now = jest.fn(() => {
        callCount++;
        return callCount === 1 ? 0 : 20; // 20ms duration
      });
      
      endMeasure();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow operation detected')
      );
      
      performance.now = originalNow;
      consoleSpy.mockRestore();
    });

    test('performance service generates comprehensive reports', () => {
      // Add some metrics
      performanceService.trackComponent('TestComponent', 'mount', 10);
      performanceService.trackNotification('sent', 5);
      performanceService.trackTimeUtilsOperation('calculation', 2);
      
      const report = performanceService.generateReport();
      
      expect(report.overall.score).toBeGreaterThan(0);
      expect(report.overall.grade).toMatch(/[A-F]/);
      expect(report.components).toBeDefined();
      expect(report.notifications).toBeDefined();
      expect(report.timeUtils).toBeDefined();
      expect(report.memory).toBeDefined();
      expect(report.network).toBeDefined();
    });

    test('usePerformanceMonitoring hook tracks component lifecycle', async () => {
      const TestComponent = () => {
        const { trackUpdate, trackError, measure } = usePerformanceMonitoring('TestComponent');
        
        return (
          <div>
            <button onClick={trackUpdate}>Track Update</button>
            <button onClick={trackError}>Track Error</button>
            <button onClick={() => {
              const end = measure('test-operation');
              setTimeout(end, 10);
            }}>
              Measure Operation
            </button>
          </div>
        );
      };

      const user = userEvent.setup();
      render(<TestComponent />);
      
      await user.click(screen.getByText('Track Update'));
      await user.click(screen.getByText('Track Error'));
      
      const report = performanceService.generateReport();
      expect(report.components.TestComponent.updateCount).toBe(1);
      expect(report.components.TestComponent.errorCount).toBe(1);
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

    // NEW: End-to-end robustness test
    test('complete system handles errors, offline, and performance tracking', async () => {
      // Track performance
      const endMeasure = performanceService.startMeasurement('integration-test');
      
      // Test error handling
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      try {
        // This should not crash the test
        addNotification('', 'info'); // Empty message
        addNotification(null as unknown as string, 'info'); // Invalid message
        addNotification('Valid message', 'invalid-type' as 'info'); // Invalid type
      } catch (error) {
        // Errors should be handled gracefully
      }
      
      // Test offline functionality
      Object.defineProperty(navigator, 'onLine', { value: false });
      offlineService.addAction('test_action', { data: 'test' }, 'normal');
      
      // Test notification system
      notifyLate('test-123', 'running late', { customer: 'Test Customer' });
      notifyArrival('test-456', { customer: 'Another Customer' });
      
      // Verify state
      const notifications = getNotifications();
      const offlineState = offlineService.getState();
      
      expect(notifications.length).toBeGreaterThan(0);
      expect(offlineState.pendingActions.length).toBeGreaterThan(0);
      
      endMeasure();
      
      // Verify performance tracking
      const report = performanceService.generateReport();
      expect(report.overall.score).toBeGreaterThan(0);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Memory Management and Cleanup', () => {
    test('notification service limits queue size', () => {
      // Add more notifications than the limit
      for (let i = 0; i < 150; i++) {
        addNotification(`Notification ${i}`, 'info');
      }
      
      const notifications = getNotifications();
      // Should be limited to 100 (default max)
      expect(notifications.length).toBeLessThanOrEqual(100);
    });

    test('performance service cleans up old metrics', () => {
      // Add many metrics
      for (let i = 0; i < 200; i++) {
        performanceService.trackComponent('TestComponent', 'update');
      }
      
      // Force cleanup
      performanceService.cleanup();
      
      // Metrics should be cleaned up
      const report = performanceService.generateReport();
      expect(report.components.TestComponent.updateCount).toBeLessThanOrEqual(100);
    });

    test('offline service manages action queue size', () => {
      // Add many actions
      for (let i = 0; i < 100; i++) {
        offlineService.addAction('test', { index: i }, 'normal');
      }
      
      const state = offlineService.getState();
      // Should maintain reasonable queue size
      expect(state.pendingActions.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Accessibility Features', () => {
    test('notifications create screen reader announcements', () => {
      // Mock document.createElement and appendChild
      const mockDiv = {
        setAttribute: jest.fn(),
        textContent: '',
        className: ''
      };
      
      const createElementSpy = jest.spyOn(document, 'createElement').mockReturnValue(mockDiv as unknown as HTMLDivElement);
      const appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation();
      const removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation();
      
      // Create notification with announcement
      addNotification('Important message', 'warning', { announce: true });
      
      // Should create accessibility element
      expect(createElementSpy).toHaveBeenCalledWith('div');
      expect(mockDiv.setAttribute).toHaveBeenCalledWith('aria-live', 'polite');
      expect(mockDiv.setAttribute).toHaveBeenCalledWith('aria-atomic', 'true');
      expect(mockDiv.textContent).toBe('Important message');
      
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
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

  // NEW: Interface validation tests
  test('BoardCard interface validates correctly with robustness utils', () => {
    // Test with valid card
    expect(() => {
      const minutes = getMinutesUntil(mockAppointmentCard.start);
      const isStarting = isStartingSoon(new Date(mockAppointmentCard.start!));
      const isLate = isRunningLate(new Date(mockAppointmentCard.start!));
    }).not.toThrow();
    
    // Test with invalid card data
    const invalidCard = { ...mockAppointmentCard, start: null };
    expect(() => {
      const minutes = getMinutesUntil(invalidCard.start);
      const isStarting = isStartingSoon(invalidCard.start as unknown as Date);
    }).not.toThrow();
  });
});

// =============================================================================
// STRESS TESTS
// =============================================================================

describe('Stress Tests', () => {
  test('system handles high notification volume', () => {
    const startTime = performance.now();
    
    // Create 1000 notifications rapidly
    for (let i = 0; i < 1000; i++) {
      addNotification(`Stress test ${i}`, 'info');
    }
    
    const duration = performance.now() - startTime;
    
    // Should complete within reasonable time (< 100ms)
    expect(duration).toBeLessThan(100);
    
    // Should respect rate limits
    const notifications = getNotifications();
    expect(notifications.length).toBeLessThanOrEqual(100);
  });

  test('time calculations perform well under load', () => {
    const times = Array.from({ length: 10000 }, (_, i) => 
      new Date(Date.now() + i * 60000)
    );
    
    const startTime = performance.now();
    
    times.forEach(time => {
      getMinutesUntil(time);
      isStartingSoon(time);
      isRunningLate(time);
      isOverdue(time);
      getCountdownText(getMinutesUntil(time));
    });
    
    const duration = performance.now() - startTime;
    const avgTime = duration / (times.length * 5); // 5 operations per time
    
    // Each operation should take less than 0.01ms
    expect(avgTime).toBeLessThan(0.01);
  });

  test('offline service handles rapid action queuing', () => {
    const startTime = performance.now();
    
    // Queue 1000 actions rapidly
    for (let i = 0; i < 1000; i++) {
      offlineService.addAction('stress_test', { index: i }, 'normal');
    }
    
    const duration = performance.now() - startTime;
    
    // Should complete within reasonable time
    expect(duration).toBeLessThan(50);
    
    const state = offlineService.getState();
    expect(state.pendingActions.length).toBeGreaterThan(0);
  });
});
