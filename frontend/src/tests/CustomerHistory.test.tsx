import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CustomerHistory from '../components/admin/CustomerHistory';

// Mock the API module before importing the component
vi.mock('@/lib/api', () => ({
  getCustomerHistory: vi.fn()
}));

// Mock the toast library  
vi.mock('../lib/toast', () => ({
  setToastPush: vi.fn(),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

// Import the mocked function after the mock is defined
import { getCustomerHistory } from '@/lib/api';

describe('CustomerHistory', () => {
  const mockOnAppointmentClick = vi.fn();
  const customerId = 'cust-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(getCustomerHistory).mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(
      <CustomerHistory 
        customerId={customerId} 
        onAppointmentClick={mockOnAppointmentClick} 
      />
    );

    // Check for skeleton loading animation using class selector
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders empty state when no appointments', async () => {
    vi.mocked(getCustomerHistory).mockResolvedValue({
      data: {
        pastAppointments: [],
        payments: []
      },
      errors: null
    });

    render(
      <CustomerHistory 
        customerId={customerId} 
        onAppointmentClick={mockOnAppointmentClick} 
      />
    );

    expect(await screen.findByText('No appointment history')).toBeInTheDocument();
    expect(screen.getByText('This customer has no completed appointments yet.')).toBeInTheDocument();
  });

  it('renders error state and allows retry', async () => {
    const user = userEvent.setup();
    vi.mocked(getCustomerHistory).mockRejectedValue(new Error('API Error'));

    render(
      <CustomerHistory 
        customerId={customerId} 
        onAppointmentClick={mockOnAppointmentClick} 
      />
    );

    expect(await screen.findByText('Failed to load customer history')).toBeInTheDocument();
    const retryButton = screen.getByText('Retry');
    expect(retryButton).toBeInTheDocument();

    // Test retry functionality
    vi.mocked(getCustomerHistory).mockResolvedValue({
      data: {
        pastAppointments: [],
        payments: []
      },
      errors: null
    });

    await user.click(retryButton);

    expect(await screen.findByText('No appointment history')).toBeInTheDocument();
    expect(getCustomerHistory).toHaveBeenCalledTimes(2);
  });

  it('renders appointments grouped by year', async () => {
    const mockData = {
      data: {
        pastAppointments: [
          {
            id: 'apt-1',
            status: 'COMPLETED',
            start: '2025-07-15T10:00:00Z',
            total_amount: 250.00,
            paid_amount: 250.00,
            created_at: '2025-07-10T09:00:00Z',
            payments: [
              {
                id: 'pay-1',
                amount: 250.00,
                method: 'cash',
                created_at: '2025-07-15T10:30:00Z'
              }
            ]
          },
          {
            id: 'apt-2',
            status: 'COMPLETED', 
            start: '2024-12-20T14:00:00Z',
            total_amount: 180.00,
            paid_amount: 100.00,
            created_at: '2024-12-18T08:00:00Z',
            payments: [
              {
                id: 'pay-2',
                amount: 100.00,
                method: 'card',
                created_at: '2024-12-20T14:45:00Z'
              }
            ]
          },
          {
            id: 'apt-3',
            status: 'NO_SHOW',
            start: '2024-11-05T16:00:00Z',
            total_amount: 120.00,
            paid_amount: 0.00,
            created_at: '2024-11-03T10:00:00Z',
            payments: []
          }
        ],
        payments: []
      },
      errors: null
    };

    vi.mocked(getCustomerHistory).mockResolvedValue(mockData);

    render(
      <CustomerHistory 
        customerId={customerId} 
        onAppointmentClick={mockOnAppointmentClick} 
      />
    );

    expect(await screen.findByText('3 past appointments')).toBeInTheDocument();

    // Should see year headers
    expect(screen.getByText('2025')).toBeInTheDocument();
    expect(screen.getByText('2024')).toBeInTheDocument();

    // Should see appointment counts by year
    expect(screen.getByText('1 appointment')).toBeInTheDocument(); // 2025
    expect(screen.getByText('2 appointments')).toBeInTheDocument(); // 2024

    // Should see year totals
    expect(screen.getByText('$250.00 total')).toBeInTheDocument(); // 2025
    expect(screen.getByText('$300.00 total')).toBeInTheDocument(); // 2024
  });

  it('expands and collapses year sections', async () => {
    const user = userEvent.setup();
    const mockData = {
      data: {
        pastAppointments: [
          {
            id: 'apt-1',
            status: 'COMPLETED',
            start: '2025-07-15T10:00:00Z',
            total_amount: 250.00,
            paid_amount: 250.00,
            created_at: '2025-07-10T09:00:00Z',
            payments: []
          }
        ],
        payments: []
      },
      errors: null
    };

    vi.mocked(getCustomerHistory).mockResolvedValue(mockData);

    render(
      <CustomerHistory 
        customerId={customerId} 
        onAppointmentClick={mockOnAppointmentClick} 
      />
    );

    expect(await screen.findByText('1 past appointment')).toBeInTheDocument();

    // Current year should be expanded by default
    expect(screen.getByText('7/15/2025')).toBeInTheDocument();

    // Click to collapse
    await user.click(screen.getByText('2025'));

    // Appointment details should be hidden
    expect(screen.queryByText('7/15/2025')).not.toBeInTheDocument();

    // Click to expand again
    await user.click(screen.getByText('2025'));

    // Appointment details should be visible again
    expect(screen.getByText('7/15/2025')).toBeInTheDocument();
  });

  it('calls onAppointmentClick when appointment is clicked', async () => {
    const user = userEvent.setup();
    const mockData = {
      data: {
        pastAppointments: [
          {
            id: 'apt-1',
            status: 'COMPLETED',
            start: '2025-07-15T10:00:00Z',
            total_amount: 250.00,
            paid_amount: 250.00,
            created_at: '2025-07-10T09:00:00Z',
            payments: []
          }
        ],
        payments: []
      },
      errors: null
    };

    vi.mocked(getCustomerHistory).mockResolvedValue(mockData);

    render(
      <CustomerHistory 
        customerId={customerId} 
        onAppointmentClick={mockOnAppointmentClick} 
      />
    );

    expect(await screen.findByText('7/15/2025')).toBeInTheDocument();

    // Click on appointment row
    // eslint-disable-next-line testing-library/no-node-access
    const appointmentRow = screen.getByText('7/15/2025').closest('div')!;
    await user.click(appointmentRow);

    expect(mockOnAppointmentClick).toHaveBeenCalledWith('apt-1');
  });

  it('displays appointment status with correct styling', async () => {
    const mockData = {
      data: {
        pastAppointments: [
          {
            id: 'apt-completed',
            status: 'COMPLETED',
            start: '2025-07-15T10:00:00Z',
            total_amount: 250.00,
            paid_amount: 250.00,
            created_at: '2025-07-10T09:00:00Z',
            payments: []
          },
          {
            id: 'apt-noshow',
            status: 'NO_SHOW',
            start: '2025-07-10T14:00:00Z',
            total_amount: 180.00,
            paid_amount: 0.00,
            created_at: '2025-07-08T10:00:00Z',
            payments: []
          },
          {
            id: 'apt-canceled',
            status: 'CANCELED',
            start: '2025-07-05T16:00:00Z',
            total_amount: 120.00,
            paid_amount: 0.00,
            created_at: '2025-07-03T12:00:00Z',
            payments: []
          }
        ],
        payments: []
      },
      errors: null
    };

    vi.mocked(getCustomerHistory).mockResolvedValue(mockData);

    render(
      <CustomerHistory 
        customerId={customerId} 
        onAppointmentClick={mockOnAppointmentClick} 
      />
    );

    expect(await screen.findByText('COMPLETED')).toBeInTheDocument();
    expect(screen.getByText('NO SHOW')).toBeInTheDocument();
    expect(screen.getByText('CANCELED')).toBeInTheDocument();
  });

  it('shows payment information correctly', async () => {
    const mockData = {
      data: {
        pastAppointments: [
          {
            id: 'apt-1',
            status: 'COMPLETED',
            start: '2025-07-15T10:00:00Z',
            total_amount: 250.00,
            paid_amount: 200.00,
            created_at: '2025-07-10T09:00:00Z',
            payments: [
              {
                id: 'pay-1',
                amount: 100.00,
                method: 'cash',
                created_at: '2025-07-15T10:30:00Z'
              },
              {
                id: 'pay-2',
                amount: 100.00,
                method: 'card',
                created_at: '2025-07-15T11:00:00Z'
              }
            ]
          }
        ],
        payments: []
      },
      errors: null
    };

    vi.mocked(getCustomerHistory).mockResolvedValue(mockData);

    render(
      <CustomerHistory 
        customerId={customerId} 
        onAppointmentClick={mockOnAppointmentClick} 
      />
    );

    expect(await screen.findByText('$250.00')).toBeInTheDocument(); // Total amount
    expect(screen.getByText('$200.00 paid')).toBeInTheDocument(); // Paid amount
    expect(screen.getByText('2 payments')).toBeInTheDocument(); // Payment count
  });
});
