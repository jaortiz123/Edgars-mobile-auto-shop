import '@testing-library/jest-dom/vitest'
import 'whatwg-fetch'

import { expect, vi, beforeAll, afterAll } from 'vitest'
import { toHaveNoViolations } from 'jest-axe'
expect.extend(toHaveNoViolations)

// Global API mock to prevent test failures on missing exports
vi.mock('@/lib/api', () => ({
  isOnline: vi.fn(() => true),
  getBoard: vi.fn().mockResolvedValue({ columns: [], cards: [] }),
  getAppointments: vi.fn().mockResolvedValue({ success: true, data: { items: [], nextCursor: null }, errors: null }),
  moveAppointment: vi.fn().mockResolvedValue({ success: true, data: { ok: true }, errors: null }),
  getDashboardStats: vi.fn().mockResolvedValue({ success: true, data: { totals: { today: 0, week: 0, unpaid_total: 0 }, countsByStatus: {}, carsOnPremises: [] }, errors: null }),
  getCarsOnPremises: vi.fn().mockResolvedValue([]),
  getStats: vi.fn().mockResolvedValue({ totals: { today: 0, week: 0, unpaid_total: 0 }, countsByStatus: {}, carsOnPremises: [] }),
  getDrawer: vi.fn().mockImplementation((id: string) => {
    console.log(`🔧 Global getDrawer mock called with id: ${id}`);
    return Promise.resolve({
      appointment: { 
        id: id,
        status: 'scheduled', 
        total_amount: 150, 
        paid_amount: 0, 
        check_in_at: null 
      },
      customer: { name: 'Test Customer' },
      vehicle: { year: '2020', make: 'Test', model: 'Car' },
      services: []
    });
  }),
  createAppointment: vi.fn().mockResolvedValue({ success: true, data: { id: 'new' }, errors: null }),
  updateAppointmentStatus: vi.fn().mockResolvedValue({ success: true, data: { ok: true }, errors: null }),
  handleApiError: vi.fn().mockImplementation((_e, fallback) => fallback),
}));

// JSDOM gaps
if (!global.ResizeObserver) {
  // minimal mock
  // @ts-ignore
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// matchMedia mock (used by some UI libs)
if (!window.matchMedia) {
  // @ts-ignore
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {}, // deprecated
    removeListener() {}, // deprecated
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return false },
  })
}

// createRange stub (some editors/portals need it)
if (!document.createRange) {
  // @ts-ignore
  document.createRange = () => ({
    setStart: () => {},
    setEnd: () => {},
    commonAncestorContainer: document.body,
    createContextualFragment: (html: string) => {
      const template = document.createElement('template')
      template.innerHTML = html
      return template.content
    },
  })
}

// scrollTo noop
// @ts-ignore
global.scrollTo = () => {}

// Suppress noisy act() warnings while preserving real errors
const realError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    const msg = String(args[0] ?? '');
    if (msg.includes('act(')) return;
    realError(...args);
  };
});

afterAll(() => { 
  console.error = realError; 
});
