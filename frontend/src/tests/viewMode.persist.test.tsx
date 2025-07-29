// --- Mocks ---------------------------------------------------------------
// Mock Toast so AppointmentContext can call toast.push / success / error safely
vi.mock('@/components/ui/Toast', () => {
  const push = vi.fn();
  const success = vi.fn();
  const error = vi.fn();
  const ToastProvider = ({ children }) => children;
  const useToast = () => ({ push, success, error });
  const toast = { push, success, error };
  return { ToastProvider, useToast, toast };
});

// Mock API to avoid real network calls when Dashboard mounts
vi.mock('@/lib/api', () => {
  const emptyStats = {
    totals: { today: 0, week: 0, unpaid_total: 0 },
    countsByStatus: {},
    carsOnPremises: [],
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockApi: any = {
    // connectivity
    isOnline: vi.fn(() => true),

    // board & appointments
    getBoard: vi.fn().mockResolvedValue({ columns: [], cards: [] }),
    getAppointments: vi.fn().mockResolvedValue({ success: true, data: { appointments: [] }, errors: null }),
    moveAppointment: vi.fn().mockResolvedValue({ data: { ok: true }, errors: null }),

    // stats & cars
    getDashboardStats: vi.fn().mockResolvedValue({ success: true, data: emptyStats, errors: null }),
    getCarsOnPremises: vi.fn().mockResolvedValue([]),
    // some code paths still call getStats
    getStats: vi.fn().mockResolvedValue(emptyStats),

    // drawer & appointment details
    getDrawer: vi.fn().mockResolvedValue({ data: { id: 'x', services: [] }, errors: null }),
    createAppointment: vi.fn().mockResolvedValue({ data: { id: 'new' }, errors: null }),
    updateAppointmentStatus: vi.fn().mockResolvedValue({ data: { ok: true }, errors: null }),

    // error helper
    handleApiError: vi.fn().mockImplementation((_e, fallback) => fallback),
  };
  return mockApi;
});

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import appRender from './render';
import Dashboard from '@/admin/Dashboard';

const STORAGE_KEY = 'viewMode';

describe('T-014: viewMode persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('defaults to board view when no storage', async () => {
    appRender(<Dashboard />);

    expect(await screen.findByTestId('board-view')).toBeInTheDocument();
    expect(screen.queryByTestId('calendar-view')).toBeNull();

    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored === null || stored === 'board').toBeTruthy();
  });

  it('renders calendar view when storage is "calendar"', async () => {
    localStorage.setItem(STORAGE_KEY, 'calendar');

    appRender(<Dashboard />);

    expect(await screen.findByTestId('calendar-view')).toBeInTheDocument();
    expect(screen.queryByTestId('board-view')).toBeNull();
  });

  it('toggle buttons write to localStorage and switch views', async () => {
    appRender(<Dashboard />);

    // default should be board
    expect(await screen.findByTestId('board-view')).toBeInTheDocument();

    // switch to calendar
    fireEvent.click(screen.getByTestId('toggle-calendar'));
    expect(await screen.findByTestId('calendar-view')).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('calendar');

    // switch back to board
    fireEvent.click(screen.getByTestId('toggle-board'));
    expect(await screen.findByTestId('board-view')).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('board');
  });
});
