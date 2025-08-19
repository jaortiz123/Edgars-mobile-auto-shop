// Node environment test setup (no DOM dependencies)
import { vi, beforeAll, afterAll } from 'vitest'

// Mock performance monitoring service
vi.mock('@/services/performanceMonitoring', () => ({
  default: {
    generateReport: vi.fn(() => ({
      overall: { score: 85, grade: 'B', recommendations: [] },
      memory: { pressure: 'low' },
      network: { online: true, rtt: 50 },
      notifications: { sent: 0, failed: 0 }
    })),
    trackComponent: vi.fn(),
    startMeasurement: vi.fn(() => vi.fn()),
  },
  usePerformanceMonitoring: vi.fn(() => ({
    trackUpdate: vi.fn(),
    trackError: vi.fn(),
    measure: vi.fn(() => vi.fn()),
  })),
}));

// Mock offline support service
vi.mock('@/services/offlineSupport', () => ({
  default: {
    getState: vi.fn(() => ({
      isOnline: true,
      queuedActions: [],
      lastSync: new Date()
    })),
    addAction: vi.fn(),
    processQueue: vi.fn(),
  },
}));

// Mock globals for Node environment (minimal setup)
global.performance = {
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
} as Partial<Performance> as Performance;

// Mock process.env if not available
if (!global.process) {
  global.process = {
    env: { NODE_ENV: 'test' }
  } as unknown as NodeJS.Process;
}

beforeAll(() => {
  // Node-specific setup
});

afterAll(() => {
  // Node-specific cleanup
});
