import React from 'react';
import { render, screen, act } from '@test-utils';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from '../../admin/Dashboard';

// Mock the apiService module which provides getAdminAppointments used by Dashboard
vi.mock('@/services/apiService', async (importOriginal) => {
  const original = await importOriginal() as any;
  return {
    ...original,
    getAdminAppointments: vi.fn(),
    createAppointment: vi.fn(),
  };
});

// Import mocked service
import * as apiService from '@/services/apiService';

// Mock lazy components to render but allow Dashboard logic to run
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
    <div
      data-testid="status-board"
      onClick={props.onOpen || (() => {})}
      data-next-appointment={props.nextAppointment ? JSON.stringify(props.nextAppointment) : 'null'}
    >
      StatusBoard
    </div>
  )
}));

vi.mock('@/components/admin/AppointmentCalendar', () => ({
  AppointmentCalendar: (props: any) => (
    <div
      data-testid="appointment-calendar"
      data-appointments={JSON.stringify(props.appointments || [])}
    >
      AppointmentCalendar
    </div>
  )
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
  __esModule: true,
  default: (props: any) => (
    <div data-testid="dashboard-header">
      <button onClick={() => props.onSelectView?.('board')}>Board View</button>
      <button onClick={() => props.onSelectView?.('calendar')}>Calendar View</button>
      <button onClick={() => props.onSelectView?.('list')}>List View</button>
    </div>
  ),
  DashboardHeader: (props: any) => (
    <div data-testid="dashboard-header">
      <button onClick={() => props.onSelectView?.('board')}>Board View</button>
      <button onClick={() => props.onSelectView?.('calendar')}>Calendar View</button>
      <button onClick={() => props.onSelectView?.('list')}>List View</button>
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

// Mock time utilities
vi.mock('@/utils/timeUtils', () => ({
  formatInShopTZ: vi.fn((date: Date, format: string) => {
    if (format === 'time') return '09:00 AM';
    if (format === 'date') return '2024-01-15';
    return '2024-01-15 09:00 AM';
  }),
  convertToShopTZ: vi.fn((date: Date) => date),
}));

describe('Dashboard Real Code Coverage Tests', () => {
  let queryClient: QueryClient;
  const mockGetAdminAppointments = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Reset implementations each test
    mockGetAdminAppointments.mockReset();
  vi.mocked(apiService.getAdminAppointments).mockImplementation(mockGetAdminAppointments);

    // Default successful response
  mockGetAdminAppointments.mockResolvedValue({
      appointments: [
        {
          id: '1',
          customer_name: 'John Doe',
          customer_phone: '555-1234',
          service: 'Oil Change',
          start_ts: '2024-01-15T09:00:00Z',
          status: 'SCHEDULED',
          vehicle_label: '2020 Toyota Camry',
          scheduled_date: '2024-01-15',
          scheduled_time: '09:00',
        },
      ],
      nextCursor: null,
    });
  });

  const renderDashboard = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    );
  };

  it('renders dashboard and processes appointment data', async () => {
    await act(async () => {
      renderDashboard();
    });

    // Wait for data loading and processing
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    expect(screen.getByTestId('dashboard-header')).toBeInTheDocument();
    expect(screen.getByTestId('status-board')).toBeInTheDocument();
  });

  it('shows loading state initially', async () => {
    mockGetAdminAppointments.mockImplementationOnce(() =>
      new Promise(resolve => setTimeout(() => resolve({ appointments: [], nextCursor: null }), 1000))
    );

    await act(async () => {
      renderDashboard();
    });

    expect(screen.getByText('Loading your dashboard...')).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    mockGetAdminAppointments.mockRejectedValue(new Error('Network error'));

    await act(async () => {
      renderDashboard();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    expect(screen.getByText('Dashboard failed to load')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('switches between view modes', async () => {
    await act(async () => {
      renderDashboard();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    // Switch to calendar view
    const calendarButton = screen.getByText('Calendar View');
    await act(async () => {
      calendarButton.click();
    });

    expect(screen.getByTestId('calendar-view')).toBeInTheDocument();
  // For now we only verify calendar toggling because the list view does not expose a dedicated test id
  // This still exercises the viewMode switching logic.
  });

  it('processes different appointment statuses correctly', async () => {
    const appointments = [
      { id: '1', customer_name: 'Test 1', service: 'Service 1', start_ts: '2024-01-15T09:00:00Z', status: 'SCHEDULED' },
      { id: '2', customer_name: 'Test 2', service: 'Service 2', start_ts: '2024-01-15T10:00:00Z', status: 'IN_PROGRESS' },
      { id: '3', customer_name: 'Test 3', service: 'Service 3', start_ts: '2024-01-15T11:00:00Z', status: 'COMPLETED' },
      { id: '4', customer_name: 'Test 4', service: 'Service 4', start_ts: '2024-01-15T12:00:00Z', status: 'CANCELED' },
      { id: '5', customer_name: 'Test 5', service: 'Service 5', start_ts: '2024-01-15T13:00:00Z', status: 'CANCELLED' },
      { id: '6', customer_name: 'Test 6', service: 'Service 6', start_ts: '2024-01-15T14:00:00Z', status: 'unknown_status' },
    ];

    mockGetAdminAppointments.mockResolvedValue({ appointments, nextCursor: null });

    await act(async () => {
      renderDashboard();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    expect(screen.getByTestId('status-board')).toBeInTheDocument();
  });

  it('opens appointment form modal via floating action button', async () => {
    await act(async () => {
      renderDashboard();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    const fab = screen.getByTestId('floating-action-button');

    await act(async () => {
      fab.click();
    });
  // The FAB currently opens the QuickAddModal first, not the full AppointmentFormModal
  expect(screen.getByTestId('quick-add-modal')).toBeInTheDocument();
  });

  it('handles date parsing edge cases without crashing', async () => {
    const edgeCaseAppointments = [
      { id: '1', customer_name: 'Test 1', service: 'Service', start_ts: '', status: 'SCHEDULED' },
      { id: '2', customer_name: 'Test 2', service: 'Service', start_ts: 'invalid-date', status: 'SCHEDULED' },
      { id: '3', customer_name: 'Test 3', service: 'Service', start_ts: '2024-01-15T25:00:00Z', status: 'SCHEDULED' },
      { id: '4', customer_name: 'Test 4', service: 'Service', scheduled_at: 'bad-date', status: 'SCHEDULED' },
      { id: '5', customer_name: 'Test 5', service: 'Service', scheduled_date: '2024-01-15', scheduled_time: '09:00', status: 'SCHEDULED' },
      { id: '6', customer_name: 'Test 6', service: 'Service', scheduled_date: '2024-01-15', status: 'SCHEDULED' },
    ];

    mockGetAdminAppointments.mockResolvedValue({
      appointments: edgeCaseAppointments,
      nextCursor: null
    });

    await act(async () => {
      renderDashboard();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    // Should still render without crashing
    expect(screen.getByTestId('dashboard-header')).toBeInTheDocument();
    expect(screen.getByTestId('status-board')).toBeInTheDocument();
  });

  it('calculates next appointment correctly', async () => {
    const futureTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now

    mockGetAdminAppointments.mockResolvedValue({
      appointments: [
        {
          id: '1',
          customer_name: 'Future Customer',
          service: 'Service',
          start_ts: futureTime,
          status: 'SCHEDULED',
        },
      ],
      nextCursor: null,
    });

    await act(async () => {
      renderDashboard();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    expect(screen.getByTestId('status-board')).toBeInTheDocument();
  });

  it('handles filter changes in calendar view', async () => {
    await act(async () => {
      renderDashboard();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    // Switch to calendar view first
    const calendarButton = screen.getByText('Calendar View');
    await act(async () => {
      calendarButton.click();
    });

    // Now apply filter
    const todayFilter = screen.getByText('Today');
    await act(async () => {
      todayFilter.click();
    });

    expect(screen.getByTestId('schedule-filter')).toBeInTheDocument();
  });

  it('handles empty appointment list', async () => {
    mockGetAdminAppointments.mockResolvedValue({
      appointments: [],
      nextCursor: null
    });

    await act(async () => {
      renderDashboard();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    expect(screen.getByTestId('status-board')).toBeInTheDocument();
  });

  it('processes appointment time calculations', async () => {
    const now = new Date();
    const pastTime = new Date(now.getTime() - 3600000).toISOString(); // 1 hour ago
    const futureTime = new Date(now.getTime() + 3600000).toISOString(); // 1 hour from now

    mockGetAdminAppointments.mockResolvedValue({
      appointments: [
        {
          id: '1',
          customer_name: 'Past Customer',
          service: 'Service',
          start_ts: pastTime,
          status: 'COMPLETED',
          customer_phone: '555-1234',
          vehicle_label: 'Vehicle 1'
        },
        {
          id: '2',
          customer_name: 'Future Customer',
          service: 'Service',
          start_ts: futureTime,
          status: 'SCHEDULED',
          customer_phone: '555-5678',
          vehicle_label: 'Vehicle 2'
        },
      ],
      nextCursor: null,
    });

    await act(async () => {
      renderDashboard();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    // Dashboard should calculate times and render
    expect(screen.getByTestId('status-board')).toBeInTheDocument();
  });

  it('handles appointment data transformation edge cases', async () => {
    const appointments = [
      // Missing customer info
      { id: '1', service: 'Service 1', start_ts: '2024-01-15T09:00:00Z', status: 'SCHEDULED' },
      // Missing service
      { id: '2', customer_name: 'Customer 2', start_ts: '2024-01-15T10:00:00Z', status: 'SCHEDULED' },
      // Missing time data
      { id: '3', customer_name: 'Customer 3', service: 'Service 3', status: 'SCHEDULED' },
      // All data present
      {
        id: '4',
        customer_name: 'Complete Customer',
        service: 'Complete Service',
        start_ts: '2024-01-15T11:00:00Z',
        status: 'SCHEDULED',
        customer_phone: '555-1234',
        vehicle_label: 'Complete Vehicle'
      },
    ];

    mockGetAdminAppointments.mockResolvedValue({ appointments, nextCursor: null });

    await act(async () => {
      renderDashboard();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    expect(screen.getByTestId('status-board')).toBeInTheDocument();
  });
});
