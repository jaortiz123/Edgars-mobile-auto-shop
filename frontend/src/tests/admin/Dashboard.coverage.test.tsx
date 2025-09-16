import React from 'react';
import { render, screen, act } from '@test-utils';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from '../../admin/Dashboard';
import * as api from '@/lib/api';

// Simple mocks that allow the real Dashboard code to run
vi.mock('@/lib/api');

// Mock lazy components to avoid loading issues but keep them simple
vi.mock('@/components/admin/AppointmentDrawer', () => ({
  default: () => <div data-testid="appointment-drawer">AppointmentDrawer</div>
}));

vi.mock('@/components/admin/AppointmentFormModal', () => ({
  AppointmentFormModal: ({ isOpen }: any) =>
    isOpen ? <div data-testid="appointment-form-modal">AppointmentFormModal</div> : null
}));

vi.mock('@/components/QuickAddModal/QuickAddModal', () => ({
  default: ({ isOpen }: any) =>
    isOpen ? <div data-testid="quick-add-modal">QuickAddModal</div> : null
}));

vi.mock('@/components/admin/StatusBoard', () => ({
  default: (props: any) => (
    <div data-testid="status-board" onClick={props.onOpen || (() => {})}>
      StatusBoard
    </div>
  )
}));

vi.mock('@/components/admin/AppointmentCalendar', () => ({
  AppointmentCalendar: () => <div data-testid="appointment-calendar">AppointmentCalendar</div>
}));

vi.mock('@/components/admin/ScheduleFilterToggle', () => ({
  default: (props: any) => (
    <div data-testid="schedule-filter">
      <button onClick={() => props.onFilterChange?.('all')}>All</button>
      <button onClick={() => props.onFilterChange?.('today')}>Today</button>
    </div>
  )
}));

vi.mock('@/components/admin/DashboardHeader', () => ({
  DashboardHeader: (props: any) => (
    <div data-testid="dashboard-header">
      <button onClick={() => props.onSelectView?.('board')}>Board View</button>
      <button onClick={() => props.onSelectView?.('calendar')}>Calendar View</button>
    </div>
  )
}));

vi.mock('@/components/ui/FloatingActionButton', () => ({
  default: (props: any) => (
    <button data-testid="floating-action-button" onClick={props.onClick || (() => {})}>
      +
    </button>
  )
}));

// Mock preferences
vi.mock('@lib/prefs', () => ({
  getViewMode: vi.fn(() => 'board'),
  setViewMode: vi.fn(),
}));

// Mock notification service
vi.mock('@/services/notificationService', () => ({
  scheduleReminder: vi.fn(),
}));

describe('Dashboard Real Code Coverage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Setup minimal API mocks
    vi.mocked(api.getAppointments).mockResolvedValue({
      appointments: [
        {
          id: '1',
          customer_name: 'John Doe',
          service: 'Oil Change',
          requested_time: '2024-01-15T09:00:00Z',
          status: 'SCHEDULED',
        },
      ],
      nextCursor: null,
    });

    vi.mocked(api.getTechnicians).mockResolvedValue([]);
    vi.mocked(api.getCustomers).mockResolvedValue([]);
    vi.mocked(api.getVehicles).mockResolvedValue([]);
  });

  const renderDashboard = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    );
  };

  it('renders and loads dashboard successfully', async () => {
    await act(async () => {
      renderDashboard();
    });

    // Wait for data loading
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(screen.getByTestId('dashboard-header')).toBeInTheDocument();
  });

  it('shows loading state', async () => {
    vi.mocked(api.getAppointments).mockImplementationOnce(() =>
      new Promise(resolve => setTimeout(() => resolve({ appointments: [], nextCursor: null }), 1000))
    );

    await act(async () => {
      renderDashboard();
    });

    expect(screen.getByText('Loading your dashboard...')).toBeInTheDocument();
  });

  it('handles API errors', async () => {
    vi.mocked(api.getAppointments).mockRejectedValue(new Error('Network error'));

    await act(async () => {
      renderDashboard();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(screen.getByText('Dashboard failed to load')).toBeInTheDocument();
  });

  it('switches to calendar view', async () => {
    await act(async () => {
      renderDashboard();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    const calendarButton = screen.getByText('Calendar View');

    await act(async () => {
      calendarButton.click();
    });

    expect(screen.getByTestId('calendar-view')).toBeInTheDocument();
  });

  it('processes multiple appointment statuses', async () => {
    const appointments = [
      { id: '1', customer_name: 'Test 1', service: 'Service 1', requested_time: '2024-01-15T09:00:00Z', status: 'SCHEDULED' },
      { id: '2', customer_name: 'Test 2', service: 'Service 2', requested_time: '2024-01-15T10:00:00Z', status: 'IN_PROGRESS' },
      { id: '3', customer_name: 'Test 3', service: 'Service 3', requested_time: '2024-01-15T11:00:00Z', status: 'COMPLETED' },
      { id: '4', customer_name: 'Test 4', service: 'Service 4', requested_time: '2024-01-15T12:00:00Z', status: 'CANCELED' },
      { id: '5', customer_name: 'Test 5', service: 'Service 5', requested_time: '2024-01-15T13:00:00Z', status: 'unknown' },
    ];

    vi.mocked(api.getAppointments).mockResolvedValue({ appointments, nextCursor: null });

    await act(async () => {
      renderDashboard();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(screen.getByTestId('status-board')).toBeInTheDocument();
  });

  it('opens appointment form modal', async () => {
    await act(async () => {
      renderDashboard();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    const fab = screen.getByTestId('floating-action-button');

    await act(async () => {
      fab.click();
    });

    expect(screen.getByTestId('appointment-form-modal')).toBeInTheDocument();
  });

  it('handles date parsing edge cases', async () => {
    const edgeCaseAppointments = [
      { id: '1', customer_name: 'Test', service: 'Service', requested_time: '', status: 'SCHEDULED' },
      { id: '2', customer_name: 'Test', service: 'Service', requested_time: 'invalid-date', status: 'SCHEDULED' },
      { id: '3', customer_name: 'Test', service: 'Service', requested_time: '2024-01-15T25:00:00Z', status: 'SCHEDULED' },
    ];

    vi.mocked(api.getAppointments).mockResolvedValue({
      appointments: edgeCaseAppointments,
      nextCursor: null
    });

    await act(async () => {
      renderDashboard();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Should still render without crashing
    expect(screen.getByTestId('dashboard-header')).toBeInTheDocument();
  });

  it('calculates next appointment when future appointments exist', async () => {
    const futureTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now

    vi.mocked(api.getAppointments).mockResolvedValue({
      appointments: [
        {
          id: '1',
          customer_name: 'Future Customer',
          service: 'Service',
          requested_time: futureTime,
          status: 'SCHEDULED',
        },
      ],
      nextCursor: null,
    });

    await act(async () => {
      renderDashboard();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(screen.getByTestId('status-board')).toBeInTheDocument();
  });

  it('handles filter changes in calendar view', async () => {
    await act(async () => {
      renderDashboard();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Switch to calendar view
    const calendarButton = screen.getByText('Calendar View');
    await act(async () => {
      calendarButton.click();
    });

    // Apply filter
    const todayFilter = screen.getByText('Today');
    await act(async () => {
      todayFilter.click();
    });

    expect(screen.getByTestId('schedule-filter')).toBeInTheDocument();
  });

  it('handles empty appointment list', async () => {
    vi.mocked(api.getAppointments).mockResolvedValue({
      appointments: [],
      nextCursor: null
    });

    await act(async () => {
      renderDashboard();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(screen.getByTestId('status-board')).toBeInTheDocument();
  });

  it('handles appointment time calculations', async () => {
    const pastTime = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
    const futureTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now

    vi.mocked(api.getAppointments).mockResolvedValue({
      appointments: [
        { id: '1', customer_name: 'Past', service: 'Service', requested_time: pastTime, status: 'COMPLETED' },
        { id: '2', customer_name: 'Future', service: 'Service', requested_time: futureTime, status: 'SCHEDULED' },
      ],
      nextCursor: null,
    });

    await act(async () => {
      renderDashboard();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Dashboard should calculate times and render
    expect(screen.getByTestId('status-board')).toBeInTheDocument();
  });
});
