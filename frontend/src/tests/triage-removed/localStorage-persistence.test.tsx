import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@test-utils';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AppointmentProvider } from '../contexts/AppointmentContext';

// Mock the API module
vi.mock('@/lib/api', () => ({
  getDrawer: vi.fn().mockResolvedValue({
    appointment: {
      id: 'test-appointment-123',
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
      id: 'cust-123',
      name: 'Test Customer',
      phone: '+1-555-0123',
      email: 'test@example.com'
    },
    vehicle: {
      id: 'veh-123',
      year: 2020,
      make: 'Toyota',
      model: 'Camry',
      vin: 'TEST123456'
    },
    services: []
  }),
  createAppointmentService: vi.fn().mockResolvedValue({
    service: {
      id: 'service-123',
      name: 'Test Service',
      notes: 'Test notes',
      estimated_hours: 1,
      estimated_price: 100,
      category: 'Test'
    }
  })
}));

// Mock Tabs component
vi.mock('@/components/ui/Tabs', () => ({
  Tabs: ({ children, value, onValueChange, tabs }: any) => (
    <div data-testid="tabs">
      {tabs.map((tab: any) => (
        <button
          key={tab.value}
          onClick={() => onValueChange(tab.value)}
          data-testid={`tab-${tab.value}`}
          className={value === tab.value ? 'active' : ''}
        >
          {tab.label}
        </button>
      ))}
      {children}
    </div>
  )
}));

// Import the component after mocking
import AppointmentDrawer from '../components/admin/AppointmentDrawer';

// Test wrapper
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <AppointmentProvider>
        {children}
      </AppointmentProvider>
    </BrowserRouter>
  );
}

describe('localStorage Persistence Fix', () => {
  const appointmentId = 'test-appointment-123';
  const storageKey = `appointment-form-${appointmentId}`;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should persist form state to localStorage when user types', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AppointmentDrawer
          open={true}
          onClose={() => {}}
          id={appointmentId}
        />
      </TestWrapper>
    );

    // Wait for drawer to load and switch to services tab
    await waitFor(() => {
      expect(screen.getByTestId('drawer-open')).toBeInTheDocument();
    });

    // Click the services tab
    const servicesTab = screen.getByTestId('tab-services');
    await user.click(servicesTab);

    // Wait for services content to load
    await waitFor(() => {
      expect(screen.getByTestId('add-service-button')).toBeInTheDocument();
    });

    // Click Add Service button
    const addServiceButton = screen.getByTestId('add-service-button');
    await user.click(addServiceButton);

    // Wait for form to appear
    await waitFor(() => {
      expect(screen.getByTestId('add-service-form')).toBeInTheDocument();
    });

    // Start typing in the service name field
    const serviceNameInput = screen.getByLabelText(/service name/i);
    await user.type(serviceNameInput, 'Oil Change');

    // Check if localStorage was updated
    await waitFor(() => {
      const storedData = localStorage.getItem(storageKey);
      expect(storedData).toBeTruthy();

      const parsed = JSON.parse(storedData!);
      expect(parsed.formState.name).toBe('Oil Change');
      expect(parsed.isAdding).toBe(true);
      expect(parsed.timestamp).toBeLessThanOrEqual(Date.now());
    });

    // Type in notes field
    const notesInput = screen.getByLabelText(/notes/i);
    await user.type(notesInput, 'Full synthetic oil');

    // Verify localStorage is updated with notes
    await waitFor(() => {
      const storedData = localStorage.getItem(storageKey);
      const parsed = JSON.parse(storedData!);
      expect(parsed.formState.name).toBe('Oil Change');
      expect(parsed.formState.notes).toBe('Full synthetic oil');
    });
  });

  it('should restore form state from localStorage on component re-render', async () => {
    // Pre-populate localStorage with form state
    const formState = {
      name: 'Brake Service',
      notes: 'Replace brake pads',
      estimated_hours: '2',
      estimated_price: '150',
      category: 'Safety'
    };

    const storageData = {
      formState,
      isAdding: true,
      timestamp: Date.now()
    };

    localStorage.setItem(storageKey, JSON.stringify(storageData));

    render(
      <TestWrapper>
        <AppointmentDrawer
          open={true}
          onClose={() => {}}
          id={appointmentId}
        />
      </TestWrapper>
    );

    // Wait for drawer to load and switch to services tab
    await waitFor(() => {
      expect(screen.getByTestId('drawer-open')).toBeInTheDocument();
    });

    const servicesTab = screen.getByTestId('tab-services');
    await userEvent.setup().click(servicesTab);

    // Wait for services content and form to appear (should be restored from localStorage)
    await waitFor(() => {
      expect(screen.getByTestId('add-service-form')).toBeInTheDocument();
    });

    // Verify form fields are populated from localStorage
    expect(screen.getByDisplayValue('Brake Service')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Replace brake pads')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
    expect(screen.getByDisplayValue('150')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Safety')).toBeInTheDocument();
  });

  it('should clear localStorage on successful form submission', async () => {
    const user = userEvent.setup();

    // Pre-populate localStorage
    const storageData = {
      formState: {
        name: 'Test Service',
        notes: 'Test notes',
        estimated_hours: '1',
        estimated_price: '100',
        category: 'Test'
      },
      isAdding: true,
      timestamp: Date.now()
    };
    localStorage.setItem(storageKey, JSON.stringify(storageData));

    render(
      <TestWrapper>
        <AppointmentDrawer
          open={true}
          onClose={() => {}}
          id={appointmentId}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('drawer-open')).toBeInTheDocument();
    });

    const servicesTab = screen.getByTestId('tab-services');
    await user.click(servicesTab);

    await waitFor(() => {
      expect(screen.getByTestId('add-service-form')).toBeInTheDocument();
    });

    // Submit the form
    const submitButton = screen.getByTestId('add-service-submit-button');
    await user.click(submitButton);

    // Wait for form submission to complete
    await waitFor(() => {
      // Form should be hidden after successful submission
      expect(screen.queryByTestId('add-service-form')).not.toBeInTheDocument();
    });

    // Verify localStorage is cleared
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it('should clear localStorage on form cancellation', async () => {
    const user = userEvent.setup();

    // Pre-populate localStorage
    const storageData = {
      formState: {
        name: 'Test Service',
        notes: 'Test notes',
        estimated_hours: '',
        estimated_price: '',
        category: ''
      },
      isAdding: true,
      timestamp: Date.now()
    };
    localStorage.setItem(storageKey, JSON.stringify(storageData));

    render(
      <TestWrapper>
        <AppointmentDrawer
          open={true}
          onClose={() => {}}
          id={appointmentId}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('drawer-open')).toBeInTheDocument();
    });

    const servicesTab = screen.getByTestId('tab-services');
    await user.click(servicesTab);

    await waitFor(() => {
      expect(screen.getByTestId('add-service-form')).toBeInTheDocument();
    });

    // Cancel the form
    const cancelButton = screen.getByTestId('add-service-cancel-button');
    await user.click(cancelButton);

    // Verify localStorage is cleared
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it('should handle localStorage errors gracefully', async () => {
    // Mock localStorage to throw errors
    const originalLocalStorage = window.localStorage;
    const mockLocalStorage = {
      setItem: vi.fn().mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      }),
      getItem: vi.fn().mockImplementation(() => {
        throw new Error('Storage access denied');
      }),
      removeItem: vi.fn().mockImplementation(() => {
        throw new Error('Storage access denied');
      })
    };

    // @ts-ignore
    window.localStorage = mockLocalStorage;

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AppointmentDrawer
          open={true}
          onClose={() => {}}
          id={appointmentId}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('drawer-open')).toBeInTheDocument();
    });

    const servicesTab = screen.getByTestId('tab-services');
    await user.click(servicesTab);

    await waitFor(() => {
      expect(screen.getByTestId('add-service-button')).toBeInTheDocument();
    });

    const addServiceButton = screen.getByTestId('add-service-button');
    await user.click(addServiceButton);

    await waitFor(() => {
      expect(screen.getByTestId('add-service-form')).toBeInTheDocument();
    });

    // Type in form field - should not throw error even if localStorage fails
    const serviceNameInput = screen.getByLabelText(/service name/i);
    await user.type(serviceNameInput, 'Test Service');

    // Component should still function normally
    expect(serviceNameInput).toHaveValue('Test Service');

    // Restore original localStorage
    window.localStorage = originalLocalStorage;
  });
});
