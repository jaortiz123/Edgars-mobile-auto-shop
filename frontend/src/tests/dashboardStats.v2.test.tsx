// Test for Dashboard Stats v2 enhancements (T-025)
import React from 'react';
import { describe, it, beforeEach, vi, expect } from 'vitest';
import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardStats from '@/components/admin/DashboardStats';
import { useAppointments } from '@/contexts/AppointmentContext';

// Mock the hooks
vi.mock('@/contexts/AppointmentContext');
vi.mock('@/components/ui/Skeleton', () => ({
  Skeleton: ({ className }: { className: string }) => (
    <div className={className} data-testid="skeleton" />
  ),
}));

const mockUseAppointments = vi.mocked(useAppointments);
const mockRefreshStats = vi.fn();

describe('DashboardStats v2 Enhancements', () => {
  const defaultStats = {
    // Legacy fields
    jobsToday: 5,
    carsOnPremises: 3,
    scheduled: 2,
    inProgress: 1,
    ready: 1,
    completed: 8,
    noShow: 0,
    unpaidTotal: 1234.56,
    // New v2 totals
    totals: {
      today_completed: 3,
      today_booked: 5,
      avg_cycle: 2.5,
      avg_cycle_formatted: '2.5h',
    },
  };

  const defaultAppointmentState = {
    columns: [],
    cards: [],
    stats: defaultStats,
    loading: false,
    view: 'calendar' as const,
    setView: vi.fn(),
    refreshBoard: vi.fn(),
    refreshStats: mockRefreshStats,
    optimisticMove: vi.fn(),
    refreshTrigger: 0,
    triggerRefresh: vi.fn(),
    isRefreshing: false,
    setRefreshing: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Set default mock implementation
    mockUseAppointments.mockReturnValue(defaultAppointmentState);
  });

  it('renders loading skeletons when stats are null', () => {
    // Override the mock for this test
    mockUseAppointments.mockReturnValue({
      ...defaultAppointmentState,
      stats: null,
    });

    render(<DashboardStats />);
    
    // Should show 10 skeleton placeholders for the new tile count
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons).toHaveLength(10);
  });

  it('renders legacy stats and new v2 metrics', () => {
    render(<DashboardStats />);

    // Check legacy metrics
    expect(screen.getByTestId('kpi-today')).toHaveTextContent('5');
    expect(screen.getByTestId('kpi-onprem')).toHaveTextContent('3');
    expect(screen.getByTestId('kpi-scheduled')).toHaveTextContent('2');
    expect(screen.getByTestId('kpi-inprogress')).toHaveTextContent('1');
    expect(screen.getByTestId('kpi-ready')).toHaveTextContent('1');
    expect(screen.getByTestId('kpi-completed')).toHaveTextContent('8');
    expect(screen.getByTestId('kpi-noshow')).toHaveTextContent('0');
    expect(screen.getByTestId('kpi-unpaid')).toHaveTextContent('$1234.56');

    // Check NEW v2 metrics
    expect(screen.getByTestId('kpi-avg-cycle')).toHaveTextContent('2.5h');
    expect(screen.getByTestId('kpi-jobs-progress')).toHaveTextContent('3/5');
  });

  it('displays progress bar for jobs today vs booked', () => {
    render(<DashboardStats />);

    const progressTile = screen.getByTestId('kpi-jobs-progress');
    
    // Should show completed/booked ratio
    expect(progressTile).toHaveTextContent('3/5');
    
    // Should show percentage complete (60% = 3/5 * 100)
    expect(progressTile).toHaveTextContent('60% complete');
    
    // Should have a progress bar with correct width
    const progressBar = progressTile.querySelector('.bg-blue-600');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveStyle({ width: '60%' });
  });

  it('handles missing totals gracefully', () => {
    mockUseAppointments.mockReturnValue({
      ...defaultAppointmentState,
      stats: {
        jobsToday: 5,
        carsOnPremises: 3,
        scheduled: 2,
        inProgress: 1,
        ready: 1,
        completed: 8,
        noShow: 0,
        unpaidTotal: 1234.56,
        // No totals object
      },
    });

    render(<DashboardStats />);

    // Should show fallback values
    expect(screen.getByTestId('kpi-avg-cycle')).toHaveTextContent('N/A');
    expect(screen.getByTestId('kpi-jobs-progress')).toHaveTextContent('0/0');
    expect(screen.getByTestId('kpi-jobs-progress')).toHaveTextContent('0% complete');
  });

  it('handles zero booked jobs correctly', () => {
    mockUseAppointments.mockReturnValue({
      ...defaultAppointmentState,
      stats: {
        jobsToday: 0,
        carsOnPremises: 0,
        scheduled: 0,
        inProgress: 0,
        ready: 0,
        completed: 0,
        noShow: 0,
        unpaidTotal: 0,
        totals: {
          today_completed: 0,
          today_booked: 0,
          avg_cycle: null,
          avg_cycle_formatted: 'N/A',
        },
      },
    });

    render(<DashboardStats />);

    // Should handle division by zero gracefully
    expect(screen.getByTestId('kpi-jobs-progress')).toHaveTextContent('0/0');
    expect(screen.getByTestId('kpi-jobs-progress')).toHaveTextContent('0% complete');
    
    // Progress bar should be 0 width
    const progressTile = screen.getByTestId('kpi-jobs-progress');
    const progressBar = progressTile.querySelector('.bg-blue-600');
    expect(progressBar).toHaveStyle({ width: '0%' });
  });

  it('calls refreshStats when refresh button is clicked', async () => {
    const user = userEvent.setup();

    render(<DashboardStats />);

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await user.click(refreshButton);

    expect(mockRefreshStats).toHaveBeenCalledOnce();
  });

  it('uses responsive grid layout', () => {
    const { container } = render(<DashboardStats />);

    // Should use the new responsive grid classes
    const grid = container.querySelector('.grid-cols-2.md\\:grid-cols-4.xl\\:grid-cols-5');
    expect(grid).toBeInTheDocument();
  });
});
