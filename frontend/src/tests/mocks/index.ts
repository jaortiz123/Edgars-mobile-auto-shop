import { vi } from 'vitest';
import type { AdminAppointment, BoardColumn, BoardCard, DrawerPayload } from '@/types/admin';

// Global variable to track mock failure rate for this specific test session
let localMockApiFailureRate = 0;

export const api = {
  // Network simulation
  simulateFailureRate: (rate: number) => {
    localMockApiFailureRate = rate;
    console.log('🔧 MOCK: Set failure rate to', rate);
  },
  simulateLatency: vi.fn().mockImplementation((delay: number) => {
    console.log('🔧 MOCK: simulateLatency called with delay:', delay);
    return Promise.resolve();
  }),
  simulateNetworkDelay: vi.fn().mockImplementation(() => {
    console.log('🔧 MOCK: simulateNetworkDelay called');
    return Promise.resolve();
  }),
  isOnline: vi.fn().mockImplementation(() => {
    console.log('🔧 MOCK: isOnline called');
    return true;
  }),

  // Board operations
  getBoard: vi.fn(async (params: any = {}) => {
    console.log('🔧 MOCK: getBoard called with params:', params);
    console.log('🔧 MOCK: localMockApiFailureRate:', localMockApiFailureRate);
    
    if (localMockApiFailureRate > 0 && Math.random() < localMockApiFailureRate) {
      console.log('🔧 MOCK: getBoard simulating failure');
      throw new Error('Simulated API failure');
    }
    
    const result = {
      columns: [
        { key: 'SCHEDULED', title: 'Scheduled', count: 1, sum: 250 },
        { key: 'IN_PROGRESS', title: 'In Progress', count: 1, sum: 450 },
        { key: 'READY', title: 'Ready', count: 0, sum: 0 },
        { key: 'COMPLETED', title: 'Completed', count: 0, sum: 0 }
      ] as BoardColumn[],
      cards: [
        {
          id: 'apt-happy-1',
          status: 'SCHEDULED',
          position: 1,
          start: '2024-01-15T14:00:00Z',
          end: '2024-01-15T15:00:00Z',
          customerName: 'Happy Path Customer',
          vehicle: '2020 Toyota Camry',
          servicesSummary: 'Happy path test appointment',
          price: 250,
          tags: []
        },
        {
          id: 'apt-happy-2',
          status: 'IN_PROGRESS',
          position: 2,
          start: '2024-01-15T16:00:00Z',
          end: '2024-01-15T17:00:00Z',
          customerName: 'Another Customer',
          vehicle: '2019 Honda Civic',
          servicesSummary: 'Secondary test appointment',
          price: 450,
          tags: []
        }
      ] as BoardCard[]
    };
    
    console.log('🔧 MOCK: getBoard returning successful result:', JSON.stringify(result, null, 2));
    return result;
  }),

  // Appointment operations
  getAppointments: vi.fn().mockImplementation(() => {
    console.log('🔧 MOCK: getAppointments called');
    return Promise.resolve({
      appointments: [
        {
          id: 'apt-happy-1',
          status: 'SCHEDULED',
          start_ts: '2024-01-15T14:00:00Z',
          end_ts: '2024-01-15T15:00:00Z',
          total_amount: 250.00,
          paid_amount: 0,
          customer_name: 'Happy Path Customer',
          vehicle_label: '2020 Toyota Camry',
          customer_id: 'cust-happy-1',
          vehicle_id: 'veh-happy-1',
          tech_id: null,
          notes: 'Happy path test appointment'
        },
        {
          id: 'apt-happy-2',
          status: 'IN_PROGRESS',
          start_ts: '2024-01-15T16:00:00Z',
          end_ts: '2024-01-15T17:00:00Z',
          total_amount: 450.00,
          paid_amount: 450.00,
          customer_name: 'Another Customer',
          vehicle_label: '2019 Honda Civic',
          customer_id: 'cust-happy-2',
          vehicle_id: 'veh-happy-2',
          tech_id: 'tech-1',
          notes: 'Secondary test appointment'
        }
      ] as AdminAppointment[]
    });
  }),

  createAppointment: vi.fn().mockImplementation((appointment: any) => {
    console.log('🔧 MOCK: createAppointment called:', appointment);
    return Promise.resolve({
      id: 'new-apt-' + Date.now(),
      ...appointment,
      status: 'SCHEDULED'
    });
  }),

  updateAppointmentStatus: vi.fn().mockImplementation((id: string, status: string) => {
    console.log('🔧 MOCK: updateAppointmentStatus called:', { id, status });
    return Promise.resolve({
      id,
      status,
      updated_at: new Date().toISOString()
    });
  }),

  // Drawer operations
  getDrawer: vi.fn(async (id: string) => {
    console.log('🔧 MOCK: getDrawer called with id:', id);
    
    const mockData: DrawerPayload = {
      appointment: {
        id: id || 'apt-happy-1',
        status: 'SCHEDULED' as const,
        start: '2024-01-15T14:00:00Z',
        end: '2024-01-15T15:00:00Z',
        total_amount: 250.00,
        paid_amount: 0,
        check_in_at: null,
        check_out_at: null,
        tech_id: null
      },
      customer: {
        id: 'cust-happy-1',
        name: 'Happy Path Customer',
        phone: '+1-555-0123',
        email: 'customer@example.com'
      },
      vehicle: {
        id: 'veh-happy-1',
        year: 2020,
        make: 'Toyota',
        model: 'Camry',
        vin: 'ABC123DEF456789'
      },
      services: [
        {
          id: 'svc-1',
          appointment_id: id || 'apt-happy-1',
          name: 'Oil Change',
          description: 'Regular oil change service',
          status: 'SCHEDULED' as const,
          price: 75.00,
          estimated_duration: 30,
          actual_duration: null,
          tech_id: null,
          created_at: '2024-01-15T12:00:00Z',
          updated_at: '2024-01-15T12:00:00Z'
        },
        {
          id: 'svc-2',
          appointment_id: id || 'apt-happy-1',
          name: 'Brake Inspection',
          description: 'Comprehensive brake system inspection',
          status: 'SCHEDULED' as const,
          price: 175.00,
          estimated_duration: 60,
          actual_duration: null,
          tech_id: null,
          created_at: '2024-01-15T12:00:00Z',
          updated_at: '2024-01-15T12:00:00Z'
        }
      ]
    };
    
    console.log('🔧 MOCK: getDrawer returning data for appointment:', id);
    return mockData;
  }),

  // Service CRUD methods
  getAppointmentServices: vi.fn().mockImplementation((appointmentId: string) => {
    console.log('🔧 MOCK: getAppointmentServices called with appointmentId:', appointmentId);
    
    const services = [
      {
        id: 'svc-1',
        appointment_id: appointmentId,
        name: 'Oil Change',
        description: 'Regular oil change service',
        status: 'SCHEDULED',
        price: 75.00,
        estimated_duration: 30,
        actual_duration: null,
        tech_id: null,
        created_at: '2024-01-15T12:00:00Z',
        updated_at: '2024-01-15T12:00:00Z'
      },
      {
        id: 'svc-2',
        appointment_id: appointmentId,
        name: 'Brake Inspection',
        description: 'Comprehensive brake system inspection',
        status: 'SCHEDULED',
        price: 175.00,
        estimated_duration: 60,
        actual_duration: null,
        tech_id: null,
        created_at: '2024-01-15T12:00:00Z',
        updated_at: '2024-01-15T12:00:00Z'
      }
    ];
    
    console.log('🔧 MOCK: getAppointmentServices returning services:', services);
    return Promise.resolve(services);
  }),

  createAppointmentService: vi.fn().mockImplementation((appointmentId: string, service: any) => {
    console.log('🔧 MOCK: createAppointmentService called:', { appointmentId, service });
    
    const newService = {
      id: 'svc-new-' + Date.now(),
      appointment_id: appointmentId,
      ...service,
      status: 'SCHEDULED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('🔧 MOCK: createAppointmentService returning new service:', newService);
    return Promise.resolve({ service: newService });
  }),

  updateAppointmentService: vi.fn().mockImplementation((appointmentId: string, serviceId: string, service: any) => {
    console.log('🔧 MOCK: updateAppointmentService called:', { appointmentId, serviceId, service });
    
    const updatedService = {
      id: serviceId,
      appointment_id: appointmentId,
      ...service,
      updated_at: new Date().toISOString()
    };
    
    console.log('🔧 MOCK: updateAppointmentService returning updated service:', updatedService);
    return Promise.resolve({ service: updatedService });
  }),

  deleteAppointmentService: vi.fn().mockImplementation((appointmentId: string, serviceId: string) => {
    console.log('🔧 MOCK: deleteAppointmentService called:', { appointmentId, serviceId });
    
    return Promise.resolve({ 
      success: true,
      deletedServiceId: serviceId
    });
  }),

  // Additional utility functions
  getCarsOnPremises: vi.fn().mockImplementation(() => {
    return Promise.resolve([
      {
        id: 'veh-happy-1',
        year: 2020,
        make: 'Toyota',
        model: 'Camry',
        customer_name: 'Happy Path Customer',
        appointment_id: 'apt-happy-1',
        status: 'SCHEDULED'
      }
    ]);
  }),

  getStats: vi.fn().mockImplementation(() => {
    console.log('🔧 MOCK: getStats called');
    return Promise.resolve({
      totalAppointments: 2,
      completedToday: 0,
      revenue: 700.00,
      avgServiceTime: 45
    });
  }),

  getCustomerHistory: vi.fn().mockImplementation((customerId: string) => {
    console.log('🔧 MOCK: getCustomerHistory called with customerId:', customerId);
    return Promise.resolve({
      appointments: [],
      totalSpent: 0,
      lastVisit: null
    });
  }),

  handleApiError: vi.fn().mockImplementation((error: any) => {
    console.log('🔧 MOCK: handleApiError called with error:', error);
    return {
      message: error.message || 'An error occurred',
      status: error.status || 500
    };
  })
};

// Time utilities mock - Fixed to match real function signatures
// Time functions are now created inside the factory for proper state isolation

// Export factory function that test setup expects
export function createMocks() {
  // Local state for this mock instance
  let localMockCurrentTime = new Date('2024-01-15T10:00:00Z').getTime();
  
  // Helper function for time calculations within this instance
  const calculateMinutesUntilLocal = (startTime: Date | string | number): number => {
    try {
      const date = typeof startTime === 'string' || typeof startTime === 'number' ? new Date(startTime) : startTime;
      const now = new Date(localMockCurrentTime);
      const diffMs = date.getTime() - now.getTime();
      return Math.floor(diffMs / (1000 * 60));
    } catch (error) {
      console.log('🔧 MOCK: calculateMinutesUntilLocal error:', error);
      return 0;
    }
  };

  return {
    time: {
      getCountdownText: vi.fn().mockImplementation((startTime: Date | string | number, options: Record<string, unknown> = {}) => {
        console.log('🔧 MOCK: getCountdownText called with startTime:', startTime, 'options:', options);
        try {
          const minutesUntil = calculateMinutesUntilLocal(startTime);
          
          if (minutesUntil > 0) {
            return `in ${minutesUntil}m`;
          } else if (minutesUntil < 0) {
            return `${Math.abs(minutesUntil)}m ago`;
          } else {
            return 'now';
          }
        } catch (error) {
          console.log('🔧 MOCK: getCountdownText error:', error);
          return 'now';
        }
      }),
      minutesPast: vi.fn().mockImplementation((time: Date | string | number, options: Record<string, unknown> = {}) => {
        console.log('🔧 MOCK: minutesPast called with time:', time, 'options:', options);
        try {
          const minutesUntil = calculateMinutesUntilLocal(time);
          return Math.max(0, -minutesUntil); // Return 0 if in future
        } catch (error) {
          console.log('🔧 MOCK: minutesPast error:', error);
          return 0;
        }
      }),
      getMinutesUntil: vi.fn().mockImplementation((startTime: Date | string | number, options: Record<string, unknown> = {}) => {
        console.log('🔧 MOCK: getMinutesUntil called with startTime:', startTime, 'options:', options);
        const result = calculateMinutesUntilLocal(startTime);
        console.log('🔧 MOCK: getMinutesUntil result:', result);
        return result;
      }),
      isStartingSoon: vi.fn().mockImplementation((startTime: Date | string | number, thresholdMinutes: number = 15, options: Record<string, unknown> = {}) => {
        console.log('🔧 MOCK: isStartingSoon called with startTime:', startTime, 'thresholdMinutes:', thresholdMinutes, 'options:', options);
        try {
          const minutesUntil = calculateMinutesUntilLocal(startTime);
          const result = minutesUntil > 0 && minutesUntil <= thresholdMinutes;
          console.log('🔧 MOCK: isStartingSoon result:', result, 'minutesUntil:', minutesUntil);
          return result;
        } catch (error) {
          console.log('🔧 MOCK: isStartingSoon error:', error);
          return false;
        }
      }),
      isRunningLate: vi.fn().mockImplementation((startTime: Date | string | number, lateThresholdMinutes: number = 10, options: Record<string, unknown> = {}) => {
        console.log('🔧 MOCK: isRunningLate called with startTime:', startTime, 'lateThresholdMinutes:', lateThresholdMinutes, 'options:', options);
        try {
          const minutesUntil = calculateMinutesUntilLocal(startTime);
          const result = minutesUntil < 0 && Math.abs(minutesUntil) >= lateThresholdMinutes;
          console.log('🔧 MOCK: isRunningLate result:', result, 'minutesUntil:', minutesUntil);
          return result;
        } catch (error) {
          console.log('🔧 MOCK: isRunningLate error:', error);
          return false;
        }
      }),
      isOverdue: vi.fn().mockImplementation((startTime: Date | string | number, overdueThresholdMinutes: number = 30, options: Record<string, unknown> = {}) => {
        console.log('🔧 MOCK: isOverdue called with startTime:', startTime, 'overdueThresholdMinutes:', overdueThresholdMinutes, 'options:', options);
        try {
          const minutesUntil = calculateMinutesUntilLocal(startTime);
          const result = minutesUntil < -overdueThresholdMinutes;
          console.log('🔧 MOCK: isOverdue result:', result, 'minutesUntil:', minutesUntil);
          return result;
        } catch (error) {
          console.log('🔧 MOCK: isOverdue error:', error);
          return false;
        }
      }),
      setCurrentTime: vi.fn().mockImplementation((time: string) => {
        console.log('🔧 MOCK: setCurrentTime called with:', time);
        localMockCurrentTime = new Date(time).getTime();
        console.log('🔧 MOCK: Set current time to:', time);
      }),
      getCurrentTime: vi.fn().mockImplementation(() => {
        return new Date(localMockCurrentTime);
      }),
      advanceTime: vi.fn().mockImplementation((minutes: number) => {
        console.log('🔧 MOCK: advanceTime called with:', minutes);
        localMockCurrentTime += minutes * 60 * 1000; // Add minutes in milliseconds
      })
    },
    notification: {
      notifyArrival: vi.fn().mockImplementation((customerName: string) => {
        console.log('🔧 MOCK: notifyArrival called with:', customerName);
        return `arrival-${Date.now()}`;
      }),
      getNotificationCount: vi.fn().mockImplementation(() => 0),
      addNotification: vi.fn().mockImplementation(() => `notif-${Date.now()}`),
      removeNotification: vi.fn().mockImplementation(() => true),
      markAsRead: vi.fn().mockImplementation(() => true),
      getNotifications: vi.fn().mockImplementation(() => []),
      clearAll: vi.fn().mockImplementation(() => {})
    },
    api,
    resetAll: vi.fn().mockImplementation(() => {
      vi.clearAllMocks();
    })
  };
}

// Type definitions for TypeScript compatibility
interface TimeMock {
  getCountdownText: ReturnType<typeof vi.fn>;
  minutesPast: ReturnType<typeof vi.fn>;
  getMinutesUntil: ReturnType<typeof vi.fn>;
  isStartingSoon: ReturnType<typeof vi.fn>;
  isRunningLate: ReturnType<typeof vi.fn>;
  isOverdue: ReturnType<typeof vi.fn>;
  setCurrentTime: ReturnType<typeof vi.fn>;
  getCurrentTime: ReturnType<typeof vi.fn>;
  advanceTime: ReturnType<typeof vi.fn>;
}

interface NotificationMock {
  notifyArrival: ReturnType<typeof vi.fn>;
  getNotificationCount: ReturnType<typeof vi.fn>;
  addNotification: ReturnType<typeof vi.fn>;
  removeNotification: ReturnType<typeof vi.fn>;
  markAsRead: ReturnType<typeof vi.fn>;
  getNotifications: ReturnType<typeof vi.fn>;
  clearAll: ReturnType<typeof vi.fn>;
}

interface TestMocks {
  time: TimeMock;
  api: typeof api;
  notification: NotificationMock;
  resetAll: ReturnType<typeof vi.fn>;
}

// Export the main factory function that tests expect
export default function createTestMocks(): TestMocks {
  const mocks = createMocks();
  return {
    time: mocks.time as TimeMock,
    api: mocks.api,
    notification: mocks.notification as NotificationMock,
    resetAll: mocks.resetAll as ReturnType<typeof vi.fn>
  };
}

// Export withMocks helper function
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

// Export types for TypeScript compatibility
export type { TestMocks };