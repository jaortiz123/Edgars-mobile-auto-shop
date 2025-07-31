/**
 * Sprint 7 Task 4: Enhanced Test Utilities
 * Advanced testing utilities that work with the mock factory system
 */

import { vi, type MockedFunction } from 'vitest'
import { mockFactory, type TestMockFactoryConfig } from './mockFactory'
import type { MockNotification } from '../types/test'

// ===============================
// TEST SCENARIO BUILDERS
// ===============================

export interface AppointmentTestScenario {
  id: string;
  customerName: string;
  service: string;
  scheduledAt: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  totalAmount?: number;
  paidAmount?: number;
  arrivalTime?: string;
  notes?: string;
}

export function createAppointmentScenario(overrides: Partial<AppointmentTestScenario> = {}): AppointmentTestScenario {
  const baseTime = new Date('2024-01-15T10:00:00Z');
  const defaultScenario: AppointmentTestScenario = {
    id: `apt-${Date.now()}`,
    customerName: 'Test Customer',
    service: 'Oil Change',
    scheduledAt: new Date(baseTime.getTime() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from base
    status: 'scheduled',
    totalAmount: 75.00,
    paidAmount: 0,
    ...overrides
  };

  return defaultScenario;
}

export function createMultipleAppointmentScenarios(count: number = 3): AppointmentTestScenario[] {
  const baseTime = new Date('2024-01-15T09:00:00Z');
  const scenarios: AppointmentTestScenario[] = [];

  for (let i = 0; i < count; i++) {
    const scheduledTime = new Date(baseTime.getTime() + i * 90 * 60 * 1000); // 90 minutes apart
    
    scenarios.push(createAppointmentScenario({
      id: `apt-${i + 1}`,
      customerName: `Customer ${i + 1}`,
      service: ['Oil Change', 'Brake Service', 'Tire Rotation', 'Engine Diagnostic'][i % 4],
      scheduledAt: scheduledTime.toISOString(),
      status: (['scheduled', 'in_progress', 'completed'][i % 3]) as 'scheduled' | 'in_progress' | 'completed',
      totalAmount: 50 + (i * 25),
      paidAmount: i % 2 === 0 ? 0 : 50 + (i * 25) // Alternate paid/unpaid
    }));
  }

  return scenarios;
}

// ===============================
// TIME-BASED TEST UTILITIES
// ===============================

export class TimeTestController {
  private mockFactory = mockFactory;

  constructor(private initialTime = new Date('2024-01-15T10:00:00Z')) {
    this.mockFactory.time.setCurrentTime(initialTime);
  }

  // Set up specific time scenarios
  setupUpcomingAppointment(minutesFromNow: number = 30) {
    const appointmentTime = new Date(this.getCurrentTime().getTime() + minutesFromNow * 60 * 1000);
    return {
      appointmentTime,
      scenario: createAppointmentScenario({
        scheduledAt: appointmentTime.toISOString()
      })
    };
  }

  setupOverdueAppointment(minutesOverdue: number = 15) {
    const appointmentTime = new Date(this.getCurrentTime().getTime() - minutesOverdue * 60 * 1000);
    return {
      appointmentTime,
      scenario: createAppointmentScenario({
        scheduledAt: appointmentTime.toISOString(),
        status: 'scheduled' // Still scheduled but overdue
      })
    };
  }

  setupStartingSoonAppointment(minutesUntilStart: number = 10) {
    return this.setupUpcomingAppointment(minutesUntilStart);
  }

  // Time manipulation methods
  getCurrentTime() {
    return this.mockFactory.time.getCurrentTime();
  }

  advanceTime(minutes: number) {
    this.mockFactory.time.advanceTime(minutes);
    return this.getCurrentTime();
  }

  setTime(newTime: Date | string) {
    this.mockFactory.time.setCurrentTime(newTime);
    return this.getCurrentTime();
  }

  // Simulate real-time progression for testing
  async simulateRealTimeFor(totalMinutes: number, intervalMinutes: number = 1) {
    const steps = Math.ceil(totalMinutes / intervalMinutes);
    const events: Array<{ time: Date; minute: number }> = [];

    for (let step = 0; step < steps; step++) {
      this.advanceTime(intervalMinutes);
      events.push({
        time: this.getCurrentTime(),
        minute: (step + 1) * intervalMinutes
      });
      
      // Allow React updates to process
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    return events;
  }
}

// ===============================
// API TEST CONTROLLERS
// ===============================

export class ApiTestController {
  private mockFactory = mockFactory;

  constructor(config: TestMockFactoryConfig['api'] = {}) {
    // Reinitialize API mocks with specific config if provided
    if (Object.keys(config).length > 0) {
      this.mockFactory.api.reset();
      Object.assign(this.mockFactory.api, config);
    }
  }

  // Simulate network conditions
  simulateSlowNetwork(delayMs: number = 2000) {
    this.mockFactory.api.setNetworkDelay(delayMs);
  }

  simulateNetworkFailures(failureRate: number = 0.3) {
    this.mockFactory.api.setFailureRate(failureRate);
  }

  simulateUnreliableNetwork() {
    this.simulateSlowNetwork(1500);
    this.simulateNetworkFailures(0.2);
  }

  restoreNormalNetwork() {
    this.mockFactory.api.setNetworkDelay(100);
    this.mockFactory.api.setFailureRate(0);
  }

  // Set up specific API response scenarios
  setupAppointmentResponses(scenarios: AppointmentTestScenario[]) {
    this.mockFactory.api.getAppointments.mockResolvedValue({
      success: true,
      data: {
        items: scenarios,
        nextCursor: null,
        totalCount: scenarios.length
      },
      errors: null
    });
  }

  setupEmptyAppointments() {
    this.mockFactory.api.getAppointments.mockResolvedValue({
      success: true,
      data: {
        items: [],
        nextCursor: null,
        totalCount: 0
      },
      errors: null
    });
  }

  setupApiError(method: keyof typeof mockFactory.api, error: Error | string) {
    const mockMethod = this.mockFactory.api[method] as MockedFunction<(...args: unknown[]) => unknown>;
    if (mockMethod && typeof mockMethod.mockRejectedValue === 'function') {
      mockMethod.mockRejectedValue(typeof error === 'string' ? new Error(error) : error);
    }
  }

  // Get mock call information
  getApiCallCount(method: keyof typeof mockFactory.api): number {
    const mockMethod = this.mockFactory.api[method] as MockedFunction<(...args: unknown[]) => unknown>;
    return mockMethod?.mock?.calls?.length || 0;
  }

  getLastApiCall(method: keyof typeof mockFactory.api) {
    const mockMethod = this.mockFactory.api[method] as MockedFunction<(...args: unknown[]) => unknown>;
    const calls = mockMethod?.mock?.calls;
    return calls?.[calls.length - 1];
  }

  reset() {
    this.mockFactory.api.reset();
  }
}

// ===============================
// NOTIFICATION TEST UTILITIES
// ===============================

export class NotificationTestController {
  private mockFactory = mockFactory;

  expectNotification(type: string, messagePattern?: string | RegExp) {
    const notifications = this.mockFactory.notifications!.getNotifications();
    const matching = notifications.filter((n: MockNotification) => {
      const typeMatches = n.type === type;
      if (!messagePattern) return typeMatches;
      
      if (typeof messagePattern === 'string') {
        return typeMatches && n.message.includes(messagePattern);
      } else {
        return typeMatches && messagePattern.test(n.message);
      }
    });

    return {
      toHaveBeenCalled: () => matching.length > 0,
      toHaveBeenCalledTimes: (times: number) => matching.length === times,
      notifications: matching
    };
  }

  expectArrivalNotification(customerName: string) {
    return this.expectNotification('arrival', customerName);
  }

  expectLateNotification(customerName: string) {
    return this.expectNotification('late', customerName);
  }

  expectOverdueNotification(customerName: string) {
    return this.expectNotification('overdue', customerName);
  }

  getNotificationCount() {
    return this.mockFactory.notifications!.getNotificationCount();
  }

  clearAllNotifications() {
    this.mockFactory.notifications!.clearAllNotifications();
  }
}

// ===============================
// INTEGRATED TEST ENVIRONMENT
// ===============================

export class TestEnvironment {
  public time: TimeTestController;
  public api: ApiTestController;
  public notifications: NotificationTestController;

  constructor(config: TestMockFactoryConfig = {}) {
    // Initialize mock factory with config
    mockFactory.resetAll();
    
    // Create controllers
    this.time = new TimeTestController();
    this.api = new ApiTestController(config.api);
    this.notifications = new NotificationTestController();

    // Apply global mocks
    mockFactory.applyGlobally();
  }

  // Set up common test scenarios
  setupReminderTestScenario() {
    const scenarios = [
      this.time.setupStartingSoonAppointment(10), // Starting in 10 minutes
      this.time.setupUpcomingAppointment(60),     // Starting in 1 hour
      this.time.setupOverdueAppointment(20)       // 20 minutes overdue
    ];

    this.api.setupAppointmentResponses(scenarios.map(s => s.scenario));
    return scenarios;
  }

  setupPerformanceTestScenario() {
    const manyAppointments = createMultipleAppointmentScenarios(20);
    this.api.setupAppointmentResponses(manyAppointments);
    this.api.simulateSlowNetwork(500); // Moderate network delay
    return manyAppointments;
  }

  setupOfflineTestScenario() {
    this.api.simulateNetworkFailures(1.0); // 100% failure rate
    return createMultipleAppointmentScenarios(5);
  }

  // Cleanup
  cleanup() {
    mockFactory.resetAll();
    vi.clearAllMocks();
  }

  reset() {
    this.cleanup();
    this.time = new TimeTestController();
    this.api = new ApiTestController();
    this.notifications = new NotificationTestController();
  }
}

// ===============================
// CONVENIENT TEST HELPERS
// ===============================

export function withTestEnvironment<T>(
  testFn: (env: TestEnvironment) => T | Promise<T>,
  config?: TestMockFactoryConfig
): T | Promise<T> {
  const env = new TestEnvironment(config);
  
  try {
    const result = testFn(env);
    
    // If it's a promise, handle cleanup after resolution
    if (result && typeof result === 'object' && 'then' in result) {
      return result.finally(() => env.cleanup()) as T;
    }
    
    // Synchronous result
    env.cleanup();
    return result;
  } catch (error) {
    env.cleanup();
    throw error;
  }
}

export function createTimeBasedTest(testFn: (timeController: TimeTestController) => void | Promise<void>) {
  return async () => {
    const timeController = new TimeTestController();
    
    try {
      await testFn(timeController);
    } finally {
      mockFactory.time.reset();
    }
  };
}

// Export for easy importing in tests
export default TestEnvironment;
