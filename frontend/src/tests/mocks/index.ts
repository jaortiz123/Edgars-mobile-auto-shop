/**
 * MOCK-FACTORY-001: Complete MockFactory API
 * Centralized mock factory to resolve circular dependencies and provide consistent test mocks
 */

import { vi } from 'vitest';

// Export the centralized mock factory function
export function createMocks() {
  // Local state per mock instance to avoid shared state issues
  let localMockCurrentTime = '2024-01-15T10:00:00Z';
  let localMockNotifications: Array<{
    id: string;
    type: string;
    message: string;
    appointmentId?: string;
    timestamp: Date;
    read?: boolean;
  }> = [];
  let localMockApiFailureRate = 0;
  let localMockApiLatency = 0;

  return {
    time: {
      setCurrentTime: (isoString: string) => {
        localMockCurrentTime = isoString;
      },
      getCurrentTime: () => new Date(localMockCurrentTime),
      advanceTime: (mins: number) => {
        const current = new Date(localMockCurrentTime);
        current.setMinutes(current.getMinutes() + mins);
        localMockCurrentTime = current.toISOString();
      },
      formatDuration: (mins: number) => {
        if (mins >= 60) {
          const hours = Math.floor(mins / 60);
          const remainingMins = mins % 60;
          if (remainingMins === 0) {
            return `${hours}h`;
          }
          return `${hours}h ${remainingMins}m`;
        }
        return `${mins}m`;
      },
      clearTimeCache: () => {
        return true;
      },
      getTimeCacheStats: () => ({ size: 0, hits: 0, misses: 0 }),
      getMinutesUntil: (targetTime: string) => {
        const current = new Date(localMockCurrentTime);
        const target = new Date(targetTime);
        return Math.round((target.getTime() - current.getTime()) / (1000 * 60));
      },
      minutesPast: (targetTime: string) => {
        const current = new Date(localMockCurrentTime);
        const target = new Date(targetTime);
        return Math.round((current.getTime() - target.getTime()) / (1000 * 60));
      },
      isStartingSoon: (appointmentTime: string, bufferMinutes = 15) => {
        const current = new Date(localMockCurrentTime);
        const appointment = new Date(appointmentTime);
        const minutesUntil = Math.round((appointment.getTime() - current.getTime()) / (1000 * 60));
        return minutesUntil > 0 && minutesUntil <= bufferMinutes;
      },
      isRunningLate: (appointmentTime: string, bufferMinutes = 15) => {
        const current = new Date(localMockCurrentTime);
        const appointment = new Date(appointmentTime);
        const minutesLate = Math.round((current.getTime() - appointment.getTime()) / (1000 * 60));
        return minutesLate > 0 && minutesLate < bufferMinutes;
      },
      isOverdue: (appointmentTime: string, bufferMinutes = 15) => {
        const current = new Date(localMockCurrentTime);
        const appointment = new Date(appointmentTime);
        const minutesLate = Math.round((current.getTime() - appointment.getTime()) / (1000 * 60));
        return minutesLate > bufferMinutes;
      },
      getCountdownText: (minutesUntil: number, options: { showDirection?: boolean; accessibility?: boolean; context?: string } = {}) => {
        if (typeof minutesUntil !== 'number' || !isFinite(minutesUntil)) {
          return 'Time unavailable';
        }
        
        const { showDirection = true, accessibility = false, context = 'appointment' } = options;
        const absMinutes = Math.abs(minutesUntil);
        
        let duration: string;
        if (absMinutes < 60) {
          duration = `${absMinutes}m`;
        } else {
          const hours = Math.floor(absMinutes / 60);
          const remainingMins = absMinutes % 60;
          if (remainingMins === 0) {
            duration = `${hours}h`;
          } else {
            duration = `${hours}h ${remainingMins}m`;
          }
        }
        
        if (minutesUntil > 0) {
          if (accessibility) {
            return `${context} starts in ${duration}`;
          }
          return showDirection ? `Starts in ${duration}` : duration;
        } else if (minutesUntil < 0) {
          if (accessibility) {
            return `${context} started ${duration} ago`;
          }
          return showDirection ? `Started ${duration} ago` : duration;
        } else {
          if (accessibility) {
            return `${context} is starting now`;
          }
          return 'Starting now';
        }
      }
    },
    notification: {
      notifyArrival: (customerName: string, appointmentId?: string) => {
        const id = `arrival-${Date.now()}`;
        localMockNotifications.push({
          id,
          type: 'arrival',
          message: `${customerName} has arrived`,
          appointmentId,
          timestamp: new Date()
        });
        return id;
      },
      notifyReminder: (customerName: string, minutesUntil: number, appointmentId?: string) => {
        const id = `reminder-${Date.now()}`;
        localMockNotifications.push({
          id,
          type: 'reminder',
          message: `Reminder: ${customerName} appointment in ${minutesUntil} minutes`,
          appointmentId,
          timestamp: new Date()
        });
        return id;
      },
      notifyLate: (customerName: string, minutesLate: number, appointmentId?: string) => {
        const id = `late-${Date.now()}`;
        localMockNotifications.push({
          id,
          type: 'late',
          message: `${customerName} is ${minutesLate} minutes late`,
          appointmentId,
          timestamp: new Date()
        });
        return id;
      },
      notifyOverdue: (customerName: string, minutesOverdue: number, appointmentId?: string) => {
        const id = `overdue-${Date.now()}`;
        localMockNotifications.push({
          id,
          type: 'overdue',
          message: `${customerName} is ${minutesOverdue} minutes overdue`,
          appointmentId,
          timestamp: new Date()
        });
        return id;
      },
      getNotificationCount: () => localMockNotifications.length,
      getNotificationsByType: (type: string) => localMockNotifications.filter(n => n.type === type),
      markNotificationAsRead: (id: string) => {
        const notification = localMockNotifications.find(n => n.id === id);
        if (notification) {
          notification.read = true;
          return true;
        }
        return false;
      },
      addNotification: (notification: unknown) => {
        const id = `mock-${Date.now()}`;
        localMockNotifications.push({
          id,
          type: 'general',
          message: typeof notification === 'string' ? notification : (notification as { message: string }).message,
          timestamp: new Date(),
          ...((typeof notification === 'object' && notification) ? notification as Record<string, unknown> : {})
        });
        return id;
      },
      removeNotification: (id: string) => {
        const index = localMockNotifications.findIndex(n => n.id === id);
        if (index > -1) localMockNotifications.splice(index, 1);
      },
      markAsRead: (id: string) => {
        const notification = localMockNotifications.find(n => n.id === id);
        if (notification) notification.read = true;
      },
      getNotifications: () => [...localMockNotifications],
      clearAll: () => {
        localMockNotifications.length = 0;
      }
    },
    api: {
      simulateFailureRate: (rate: number) => {
        localMockApiFailureRate = rate;
      },
      simulateLatency: (ms: number) => {
        localMockApiLatency = ms;
      },
      simulateNetworkDelay: (ms: number) => {
        localMockApiLatency = ms;
      },
      isOnline: () => true,
      getBoard: vi.fn(async (params?: { from?: string; to?: string; techId?: string }) => {
        console.log('🔧 MOCK: getBoard called with params:', params);
        console.log('🔧 MOCK: localMockApiFailureRate:', localMockApiFailureRate);
        
        if (Math.random() < localMockApiFailureRate) {
          console.log('🔧 MOCK: Simulating network error');
          throw new Error('Network error');
        }
        
        const result = {
          columns: [
            {
              key: "SCHEDULED",
              title: "Scheduled",
              count: 1,
              sum: 250
            },
            {
              key: "IN_PROGRESS",
              title: "In Progress",
              count: 1,
              sum: 450
            },
            {
              key: "READY",
              title: "Ready",
              count: 0,
              sum: 0
            },
            {
              key: "COMPLETED",
              title: "Completed",
              count: 0,
              sum: 0
            }
          ],
          cards: [
            {
              id: "apt-happy-1",
              status: "SCHEDULED",
              position: 1,
              start: "2024-01-15T14:00:00Z",
              end: "2024-01-15T15:00:00Z",
              customerName: "Happy Path Customer",
              vehicle: "2020 Toyota Camry",
              servicesSummary: "Happy path test appointment",
              price: 250,
              tags: []
            },
            {
              id: "apt-happy-2",
              status: "IN_PROGRESS",
              position: 2,
              start: "2024-01-15T16:00:00Z",
              end: "2024-01-15T17:00:00Z",
              customerName: "Another Customer",
              vehicle: "2019 Honda Civic",
              servicesSummary: "Secondary test appointment",
              price: 450,
              tags: []
            }
          ]
        };
        
        console.log('🔧 MOCK: getBoard returning successful result:', JSON.stringify(result, null, 2));
        return result;
      }),
      getAppointments: vi.fn().mockImplementation(() => {
        if (Math.random() < localMockApiFailureRate) {
          throw new Error('Network error');
        }
        return Promise.resolve({
          success: true,
          data: {
            items: [
              {
                id: 'apt-1',
                customer_name: 'John Doe',
                service: 'Oil Change',
                appointment_time: '2024-01-15T10:00:00Z',
                status: 'confirmed'
              },
              {
                id: 'apt-2', 
                customer_name: 'Jane Smith',
                service: 'Brake Inspection',
                appointment_time: '2024-01-15T14:00:00Z',
                status: 'pending'
              }
            ]
          }
        });
      }),
      createAppointment: vi.fn().mockImplementation((data: Record<string, unknown>) => {
        if (Math.random() < localMockApiFailureRate) {
          throw new Error('Network error');
        }
        return Promise.resolve({
          success: true,
          data: {
            id: `apt-${Date.now()}`,
            ...data,
            created_at: new Date().toISOString()
          }
        });
      }),
      updateAppointmentStatus: vi.fn().mockImplementation((id: string, status: string) => {
        if (Math.random() < localMockApiFailureRate) {
          throw new Error('Network error');
        }
        return Promise.resolve({
          success: true,
          data: { id, status, updated_at: new Date().toISOString() }
        });
      }),
      getDrawer: vi.fn().mockImplementation((id: string) => {
        console.log('🔧 MOCK: getDrawer called with id:', id);
        
        if (Math.random() < localMockApiFailureRate) {
          console.log('🔧 MOCK: getDrawer simulating network error');
          return Promise.reject(new Error('Network error'));
        }
        
        const result = {
          appointment: {
            id: id,
            status: 'SCHEDULED',
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
              appointment_id: id,
              name: 'Oil Change',
              notes: 'Standard oil change with synthetic oil',
              estimated_hours: 1.0,
              estimated_price: 75.00,
              category: 'Maintenance'
            },
            {
              id: 'svc-2',
              appointment_id: id,
              name: 'Inspection',
              notes: 'Annual vehicle inspection',
              estimated_hours: 0.5,
              estimated_price: 175.00,
              category: 'Safety'
            }
          ]
        };
        
        console.log('🔧 MOCK: getDrawer returning result:', JSON.stringify(result, null, 2));
        return Promise.resolve(result);
      }),
      getAppointmentServices: vi.fn().mockImplementation((appointmentId: string) => {
        console.log('🔧 MOCK: getAppointmentServices called with appointmentId:', appointmentId);
        
        const services = [
          {
            id: 'svc-1',
            appointment_id: appointmentId,
            name: 'Oil Change',
            notes: 'Standard oil change with synthetic oil',
            estimated_hours: 1.0,
            estimated_price: 75.00,
            category: 'Maintenance'
          },
          {
            id: 'svc-2',
            appointment_id: appointmentId,
            name: 'Inspection',
            notes: 'Annual vehicle inspection',
            estimated_hours: 0.5,
            estimated_price: 175.00,
            category: 'Safety'
          }
        ];
        
        return Promise.resolve(services);
      }),
      createAppointmentService: vi.fn().mockImplementation((appointmentId: string, service: Record<string, unknown>) => {
        console.log('🔧 MOCK: createAppointmentService called:', { appointmentId, service });
        
        const newService = {
          id: `svc-${Date.now()}`,
          appointment_id: appointmentId,
          name: (service.name as string) || 'New Service',
          notes: (service.notes as string) || '',
          estimated_hours: (service.estimated_hours as number) || 1.0,
          estimated_price: (service.estimated_price as number) || 100.00,
          category: (service.category as string) || 'General'
        };
        
        return Promise.resolve({ 
          service: newService, 
          appointment_total: 500.00 
        });
      }),
      updateAppointmentService: vi.fn().mockImplementation((appointmentId: string, serviceId: string, service: Record<string, unknown>) => {
        console.log('🔧 MOCK: updateAppointmentService called:', { appointmentId, serviceId, service });
        
        const updatedService = {
          id: serviceId,
          appointment_id: appointmentId,
          name: (service.name as string) || 'Updated Service',
          notes: (service.notes as string) || '',
          estimated_hours: (service.estimated_hours as number) || 1.0,
          estimated_price: (service.estimated_price as number) || 100.00,
          category: (service.category as string) || 'General'
        };
        
        return Promise.resolve({ 
          service: updatedService, 
          appointment_total: 500.00 
        });
      }),
      deleteAppointmentService: vi.fn().mockImplementation((appointmentId: string, serviceId: string) => {
        console.log('🔧 MOCK: deleteAppointmentService called:', { appointmentId, serviceId });
        
        return Promise.resolve({ 
          message: 'Service deleted successfully', 
          appointment_total: 300.00 
        });
      }),
      getCarsOnPremises: vi.fn().mockImplementation(() => {
        return Promise.resolve([
          {
            id: 'car-1',
            make: 'Toyota',
            model: 'Camry',
            owner: 'Happy Path Customer',
            arrivalTime: '2024-01-15T13:00:00Z',
            status: 'SCHEDULED',
            pickupTime: '2024-01-15T17:00:00Z'
          }
        ]);
      }),
      getStats: vi.fn().mockImplementation(() => {
        return Promise.resolve({
          success: true,
          data: {
            total_appointments: 42,
            completed_today: 8,
            revenue_today: 850
          }
        });
      }),
      getCustomerHistory: vi.fn().mockImplementation(() => {
        if (Math.random() < localMockApiFailureRate) {
          throw new Error('Network error');
        }
        return Promise.resolve({
          success: true,
          data: {
            pastAppointments: [
              {
                id: 'apt-past-1',
                customer_name: 'John Doe',
                service: 'Oil Change',
                appointment_time: '2023-12-15T10:00:00Z',
                status: 'completed',
                payment_amount: 75.00,
                payment_status: 'paid'
              }
            ]
          }
        });
      }),
      handleApiError: vi.fn().mockImplementation((err: unknown, defaultMessage?: string): string => {
        let msg: string;
        if (err && typeof err === 'object' && 'message' in err) {
          msg = (err as { message: string }).message || defaultMessage || 'Unknown error';
        } else if (typeof err === 'string') {
          msg = err;
        } else {
          msg = defaultMessage || 'Unknown error';
        }
        return msg;
      })
    },
    resetAll: () => {
      vi.clearAllMocks();
      localMockCurrentTime = '2024-01-15T10:00:00Z';
      localMockNotifications.length = 0;
      localMockApiFailureRate = 0;
      localMockApiLatency = 0;
    }
  };
}

// Legacy compatibility types and functions
interface TimeMock {
  setCurrentTime: (isoString: string) => void;
  getCurrentTime: () => Date;
  advanceTime: (mins: number) => void;
  formatDuration: (mins: number) => string;
  clearTimeCache: () => boolean;
  getTimeCacheStats: () => { size: number; hits: number; misses: number };
  getMinutesUntil: (targetTime: string) => number;
  isStartingSoon: (appointmentTime: string, bufferMinutes?: number) => boolean;
  isRunningLate: (appointmentTime: string, bufferMinutes?: number) => boolean;
  isOverdue: (appointmentTime: string, bufferMinutes?: number) => boolean;
}

interface ApiMock {
  simulateFailureRate: (rate: number) => void;
  simulateLatency: (ms: number) => void;
  simulateNetworkDelay: (ms: number) => void;
  isOnline: () => boolean;
  getAppointments: ReturnType<typeof vi.fn>;
  createAppointment: ReturnType<typeof vi.fn>;
  updateAppointmentStatus: ReturnType<typeof vi.fn>;
  getDrawer: ReturnType<typeof vi.fn>;
  getStats: ReturnType<typeof vi.fn>;
  getBoard: ReturnType<typeof vi.fn>;
  getCustomerHistory: ReturnType<typeof vi.fn>;
  handleApiError: ReturnType<typeof vi.fn>;
  getAppointmentServices: ReturnType<typeof vi.fn>;
  createAppointmentService: ReturnType<typeof vi.fn>;
  updateAppointmentService: ReturnType<typeof vi.fn>;
  deleteAppointmentService: ReturnType<typeof vi.fn>;
  getCarsOnPremises: ReturnType<typeof vi.fn>;
}

interface NotificationMock {
  notifyArrival: (customerName: string, appointmentId?: string) => string;
  notifyReminder: (customerName: string, minutesUntil: number, appointmentId?: string) => string;
  notifyLate: (customerName: string, minutesLate: number, appointmentId?: string) => string;
  notifyOverdue: (customerName: string, minutesOverdue: number, appointmentId?: string) => string;
  getNotificationCount: () => number;
  getNotificationsByType: (type: string) => Array<{ id: string; type: string; message: string; timestamp: Date; read?: boolean }>;
  markNotificationAsRead: (id: string) => boolean;
  addNotification: ReturnType<typeof vi.fn>;
  removeNotification: ReturnType<typeof vi.fn>;
  markAsRead: ReturnType<typeof vi.fn>;
  getNotifications: ReturnType<typeof vi.fn>;
  clearAll: ReturnType<typeof vi.fn>;
}

interface TestMocks {
  time: TimeMock;
  api: ApiMock;
  notification: NotificationMock;
  resetAll: () => void;
}

export default function createTestMocks(): TestMocks {
  const mocks = createMocks();
  
  return {
    time: mocks.time as TimeMock,
    api: mocks.api as ApiMock,
    notification: {
      ...mocks.notification,
      addNotification: vi.fn().mockImplementation(mocks.notification.addNotification),
      removeNotification: vi.fn().mockImplementation(mocks.notification.removeNotification),
      markAsRead: vi.fn().mockImplementation(mocks.notification.markAsRead),
      getNotifications: vi.fn().mockImplementation(mocks.notification.getNotifications),
      clearAll: vi.fn().mockImplementation(mocks.notification.clearAll)
    } as NotificationMock,
    resetAll: mocks.resetAll
  };
}

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

export type { TestMocks };
