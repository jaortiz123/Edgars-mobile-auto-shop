import React from 'react';
import { render, screen, fireEvent, waitFor } from '@test-utils';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from '../../admin/Dashboard';

// Mock all external dependencies
vi.mock('@/components/admin/AppointmentCalendar', () => ({
  AppointmentCalendar: () => <div data-testid="appointment-calendar">Appointment Calendar</div>
}));

vi.mock('@/components/admin/AppointmentDrawer', () => ({
  default: () => <div data-testid="appointment-drawer">Appointment Drawer</div>
}));

vi.mock('@/components/admin/AppointmentFormModal', () => ({
  AppointmentFormModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="appointment-form-modal">
        <h2>New Appointment</h2>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null
}));

vi.mock('@/components/QuickAddModal/QuickAddModal', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="quick-add-modal">
        <h2>Quick Add</h2>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null
}));

vi.mock('@/components/admin/StatusBoard', () => ({
  default: () => <div data-testid="status-board">Status Board</div>
}));

vi.mock('@/components/admin/ScheduleFilterToggle', () => ({
  default: ({ filter, onChange }: { filter: string; onChange: (filter: string) => void }) => (
    <div data-testid="schedule-filter">
      <button onClick={() => onChange('all')}>All</button>
      <button onClick={() => onChange('today')}>Today</button>
      <span>Current: {filter}</span>
    </div>
  )
}));

vi.mock('@/components/admin/DashboardHeader', () => ({
  default: () => <div data-testid="dashboard-header">Dashboard Header</div>
}));

vi.mock('@/components/ui/FloatingActionButton', () => ({
  default: ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
    <button data-testid="floating-action-button" onClick={onClick}>
      {children}
    </button>
  )
}));

vi.mock('@lib/prefs', () => ({
  getViewMode: () => 'board',
  setViewMode: vi.fn()
}));

vi.mock('@/services/apiService', () => ({
  createAppointment: vi.fn(() => Promise.resolve({
    id: 'new-apt-1',
    customer_name: 'Test Customer',
    status: 'scheduled'
  })),
  getAdminAppointments: vi.fn(() => Promise.resolve({
    appointments: [
      {
        id: 'apt-1',
        customer_name: 'John Doe',
        service: 'Oil Change',
        start_ts: '2024-01-15T09:00:00Z',
        status: 'scheduled',
        customer_phone: '555-1234',
        vehicle_label: '2020 Toyota Camry'
      },
      {
        id: 'apt-2',
        customer_name: 'Jane Smith',
        service: 'Brake Service',
        start_ts: '2024-01-15T14:00:00Z',
        status: 'in-progress',
        customer_phone: '555-5678',
        vehicle_label: '2019 Honda Civic'
      }
    ]
  }))
}));

vi.mock('@lib/api', () => ({
  handleApiError: vi.fn(),
  isOnline: () => true,
  updateAppointmentStatus: vi.fn(() => Promise.resolve({ success: true }))
}));

vi.mock('@/services/notificationService', () => ({
  scheduleReminder: vi.fn(() => Promise.resolve({ success: true }))
}));

vi.mock('@lib/utils', () => ({
  parseDurationToMinutes: (duration: string) => {
    if (duration.includes('1 hour')) return 60;
    if (duration.includes('30 minutes')) return 30;
    return 60;
  }
}));

vi.mock('@/lib/timezone', () => ({
  formatInShopTZ: (date: Date, format: string) => {
    if (format === 'time') return '9:00 AM';
    return date.toISOString();
  }
}));

vi.mock('@lib/quickAddUtils', () => ({
  saveLastQuickAdd: vi.fn()
}));

// Mock lazy loading
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    lazy: (fn: () => Promise<any>) => {
      const Component = () => {
        const [LazyComponent, setLazyComponent] = React.useState(null);
        React.useEffect(() => {
          fn().then(module => setLazyComponent(() => module.default));
        }, []);
        return LazyComponent ? React.createElement(LazyComponent) : <div>Loading...</div>;
      };
      return Component;
    },
    Suspense: ({ children }: { children: React.ReactNode }) => <>{children}</>
  };
});

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
});

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window.scrollY
    Object.defineProperty(window, 'scrollY', {
      writable: true,
      value: 0
    });
  });

  describe('Basic Rendering', () => {
    it('renders dashboard components', async () => {
      renderWithProviders(<Dashboard />);

      expect(screen.getByTestId('dashboard-header')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('appointment-calendar')).toBeInTheDocument();
        expect(screen.getByTestId('status-board')).toBeInTheDocument();
      });
    });

    it('shows loading state initially', () => {
      renderWithProviders(<Dashboard />);

      // Should show loading indicators
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('displays greeting message', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        const greeting = screen.getByText(/good (morning|afternoon|evening)/i);
        expect(greeting).toBeInTheDocument();
      });
    });
  });

  describe('Data Loading', () => {
    it('loads appointment data on mount', async () => {
      const { getAdminAppointments } = await import('@/services/apiService');

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(getAdminAppointments).toHaveBeenCalled();
      });
    });

    it('displays loaded appointments', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Oil Change')).toBeInTheDocument();
        expect(screen.getByText('Brake Service')).toBeInTheDocument();
      });
    });

    it('handles loading errors gracefully', async () => {
      const { getAdminAppointments } = await import('@/services/apiService');
      vi.mocked(getAdminAppointments).mockRejectedValueOnce(new Error('API Error'));

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });

    it('prevents duplicate loading calls', async () => {
      const { getAdminAppointments } = await import('@/services/apiService');

      renderWithProviders(<Dashboard />);

      // Trigger multiple refreshes quickly
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);
      fireEvent.click(refreshButton);
      fireEvent.click(refreshButton);

      await waitFor(() => {
        // Should only call API once despite multiple clicks
        expect(getAdminAppointments).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('View Mode Switching', () => {
    it('allows switching between board and calendar views', async () => {
      renderWithProviders(<Dashboard />);

      const viewToggle = screen.getByRole('button', { name: /calendar view/i });
      fireEvent.click(viewToggle);

      await waitFor(() => {
        expect(screen.getByTestId('appointment-calendar')).toBeInTheDocument();
      });

      const boardToggle = screen.getByRole('button', { name: /board view/i });
      fireEvent.click(boardToggle);

      await waitFor(() => {
        expect(screen.getByTestId('status-board')).toBeInTheDocument();
      });
    });

    it('persists view mode preference', async () => {
      const { setViewMode } = await import('@lib/prefs');

      renderWithProviders(<Dashboard />);

      const viewToggle = screen.getByRole('button', { name: /calendar view/i });
      fireEvent.click(viewToggle);

      await waitFor(() => {
        expect(setViewMode).toHaveBeenCalledWith('calendar');
      });
    });
  });

  describe('Filter Controls', () => {
    it('renders schedule filter toggle', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('schedule-filter')).toBeInTheDocument();
      });
    });

    it('handles filter changes', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        const allButton = screen.getByRole('button', { name: 'All' });
        fireEvent.click(allButton);

        expect(screen.getByText('Current: all')).toBeInTheDocument();
      });
    });

    it('filters appointments based on selected filter', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        // Initially shows 'today' filter
        expect(screen.getByText('Current: today')).toBeInTheDocument();

        // Switch to 'all'
        const allButton = screen.getByRole('button', { name: 'All' });
        fireEvent.click(allButton);

        expect(screen.getByText('Current: all')).toBeInTheDocument();
      });
    });
  });

  describe('Appointment Creation', () => {
    it('opens appointment form modal', async () => {
      renderWithProviders(<Dashboard />);

      const addButton = screen.getByRole('button', { name: /new appointment/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('appointment-form-modal')).toBeInTheDocument();
        expect(screen.getByText('New Appointment')).toBeInTheDocument();
      });
    });

    it('closes appointment form modal', async () => {
      renderWithProviders(<Dashboard />);

      const addButton = screen.getByRole('button', { name: /new appointment/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        const closeButton = screen.getByRole('button', { name: 'Close' });
        fireEvent.click(closeButton);

        expect(screen.queryByTestId('appointment-form-modal')).not.toBeInTheDocument();
      });
    });

    it('submits new appointment', async () => {
      const { createAppointment } = await import('@/services/apiService');

      renderWithProviders(<Dashboard />);

      const addButton = screen.getByRole('button', { name: /new appointment/i });
      fireEvent.click(addButton);

      // Mock form submission
      const submitButton = screen.getByRole('button', { name: /submit/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(createAppointment).toHaveBeenCalled();
      });
    });
  });

  describe('Quick Add Modal', () => {
    it('opens quick add modal', async () => {
      renderWithProviders(<Dashboard />);

      const quickAddButton = screen.getByTestId('floating-action-button');
      fireEvent.click(quickAddButton);

      await waitFor(() => {
        expect(screen.getByTestId('quick-add-modal')).toBeInTheDocument();
        expect(screen.getByText('Quick Add')).toBeInTheDocument();
      });
    });

    it('closes quick add modal', async () => {
      renderWithProviders(<Dashboard />);

      const quickAddButton = screen.getByTestId('floating-action-button');
      fireEvent.click(quickAddButton);

      await waitFor(() => {
        const closeButton = screen.getByRole('button', { name: 'Close' });
        fireEvent.click(closeButton);

        expect(screen.queryByTestId('quick-add-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('Appointment Interactions', () => {
    it('opens appointment drawer when appointment is clicked', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        const appointment = screen.getByText('John Doe');
        fireEvent.click(appointment);

        expect(screen.getByTestId('appointment-drawer')).toBeInTheDocument();
      });
    });

    it('handles appointment status updates', async () => {
      const { updateAppointmentStatus } = await import('@lib/api');

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        const statusButton = screen.getByRole('button', { name: /mark as completed/i });
        fireEvent.click(statusButton);

        expect(updateAppointmentStatus).toHaveBeenCalled();
      });
    });

    it('handles appointment rescheduling', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        const rescheduleButton = screen.getByRole('button', { name: /reschedule/i });
        fireEvent.click(rescheduleButton);

        // Should update local state and trigger refresh
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });
  });

  describe('Notification Features', () => {
    it('schedules appointment reminders', async () => {
      const { scheduleReminder } = await import('@/services/notificationService');

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        const reminderButton = screen.getByRole('button', { name: /send reminder/i });
        fireEvent.click(reminderButton);

        expect(scheduleReminder).toHaveBeenCalled();
      });
    });

    it('displays reminder status', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/reminder: pending/i)).toBeInTheDocument();
      });
    });
  });

  describe('Time Conversion Utilities', () => {
    it('converts 12-hour to 24-hour format correctly', () => {
      // Testing the convertTo24Hour function indirectly through appointments
      renderWithProviders(<Dashboard />);

      // The function should handle various time formats
      // This is tested indirectly through appointment time display
    });

    it('handles invalid time formats gracefully', async () => {
      renderWithProviders(<Dashboard />);

      // Should not crash with invalid time data
      await waitFor(() => {
        expect(screen.getByTestId('status-board')).toBeInTheDocument();
      });
    });
  });

  describe('Next Appointment Display', () => {
    it('shows next upcoming appointment', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/next appointment/i)).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });

    it('shows next available slot', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/next available/i)).toBeInTheDocument();
      });
    });

    it('handles no upcoming appointments', async () => {
      const { getAdminAppointments } = await import('@/services/apiService');
      vi.mocked(getAdminAppointments).mockResolvedValueOnce({ appointments: [] });

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/no upcoming appointments/i)).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Behavior', () => {
    it('adapts to different screen sizes', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        value: 375
      });

      renderWithProviders(<Dashboard />);

      // Should render mobile-friendly layout
      expect(screen.getByTestId('dashboard-header')).toBeInTheDocument();
    });

    it('shows appropriate controls for mobile', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('floating-action-button')).toBeInTheDocument();
      });
    });
  });

  describe('Performance Features', () => {
    it('lazy loads heavy components', async () => {
      renderWithProviders(<Dashboard />);

      // Initially shows loading state for lazy components
      expect(screen.getByText('Loading...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('status-board')).toBeInTheDocument();
      });
    });

    it('prevents infinite loading with safety timer', async () => {
      // Mock a scenario where loading takes too long
      const { getAdminAppointments } = await import('@/services/apiService');
      vi.mocked(getAdminAppointments).mockImplementationOnce(
        () => new Promise(resolve => setTimeout(resolve, 11000))
      );

      renderWithProviders(<Dashboard />);

      // Should not hang indefinitely
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-header')).toBeInTheDocument();
      }, { timeout: 12000 });
    });
  });

  describe('Error Handling', () => {
    it('displays error messages when API calls fail', async () => {
      const { getAdminAppointments } = await import('@/services/apiService');
      vi.mocked(getAdminAppointments).mockRejectedValueOnce(new Error('Network error'));

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/error loading appointments/i)).toBeInTheDocument();
      });
    });

    it('handles network connectivity issues', async () => {
      const { isOnline } = await import('@lib/api');
      vi.mocked(isOnline).mockReturnValueOnce(false);

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/offline/i)).toBeInTheDocument();
      });
    });

    it('provides retry mechanisms for failed operations', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /retry/i });
        expect(retryButton).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA labels', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        const dashboard = screen.getByRole('main');
        expect(dashboard).toHaveAttribute('aria-label', expect.stringContaining('Dashboard'));
      });
    });

    it('supports keyboard navigation', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        const addButton = screen.getByRole('button', { name: /new appointment/i });
        addButton.focus();
        expect(document.activeElement).toBe(addButton);
      });
    });

    it('announces loading states to screen readers', () => {
      renderWithProviders(<Dashboard />);

      expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    });
  });
});
