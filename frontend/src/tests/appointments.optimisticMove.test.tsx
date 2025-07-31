/**
 * Sprint 7 T5 Phase 1: Enhanced Appointments Optimistic Move Test with Mock Factory Integration
 * Successfully refactored from manual vi.mock to use mock factory patterns
 */

import React from 'react';
import { describe, it, beforeEach, vi, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import appRender from './render';
import { mockFactory } from '@/tests/mockFactory';
import { useAppointments } from '@/contexts/AppointmentContext';
import type { BoardColumn, BoardCard, DashboardStats, AppointmentStatus } from '@/types/models';

// Use mock factory for API instead of manual vi.mock
const { resetAll, api: apiMocks } = mockFactory;

// Mock Toast module to match actual implementation 
vi.mock('@/components/ui/Toast', () => {
  const push = vi.fn();
  const success = vi.fn();
  const error = vi.fn();
  const ToastProvider = ({ children }: any) => children;
  const useToast = () => ({ push, success, error });
  const toast = { push, success, error };
  return { ToastProvider, useToast, toast };
});

// Import the mocked toast after mocking
import { toast } from '@/components/ui/Toast';

// Initial test data using real statuses
const dummyStats: DashboardStats = { jobsToday:0, carsOnPremises:0, scheduled:0, inProgress:0, ready:0, completed:0, noShow:0, unpaidTotal:0 };
const initialColumns: BoardColumn[] = [
  { key: 'SCHEDULED', title: 'Scheduled', count: 1, sum: 0 },
  { key: 'IN_PROGRESS', title: 'In Progress', count: 0, sum: 0 },
];
const initialCards: BoardCard[] = [
  {
    id: '1',
    status: 'SCHEDULED',
    position: 1,
    end: null,
    customerName: 'Test',
    vehicle: 'Car',
  },
];

function TestComponent() {
  const { cards, optimisticMove } = useAppointments();
  return (
    <div>
      <div data-testid="cards">
        {cards.map((c: BoardCard) => `${c.id}-${c.status}-${c.position}`).join(',')}
      </div>
      <button onClick={() => void optimisticMove('1', { status: 'IN_PROGRESS' as AppointmentStatus, position: 2 })}>
        Move
      </button>
    </div>
  );
}

describe('AppointmentContext.optimisticMove - Enhanced with Mock Factory', () => {
  beforeEach(() => {
    // Use mock factory reset instead of manual vi.clearAllMocks
    resetAll();
    
    // Setup default API responses using mock factory
    apiMocks.getBoard.mockResolvedValue({ columns: initialColumns, cards: initialCards });
    apiMocks.getStats.mockResolvedValue(dummyStats);
    apiMocks.moveAppointment.mockReset();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it('success path with enhanced mock factory', async () => {
    apiMocks.moveAppointment.mockResolvedValue({ id: '1', status: 'IN_PROGRESS', position: 2 });
    appRender(<TestComponent />);
    
    // Wait for initial load
    await waitFor(() => expect(screen.getByTestId('cards').textContent).toContain('1-SCHEDULED-1'));
    
    // Trigger move
    userEvent.click(screen.getByText('Move'));
    
    // UI updates optimistically
    await waitFor(() => expect(screen.getByTestId('cards').textContent).toContain('1-IN_PROGRESS-2'));
    
    // Toast on success
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Appointment moved successfully', { key: 'move-1' }));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('generic 500 error path rolls back and shows error toast', async () => {
    apiMocks.moveAppointment.mockRejectedValue({ response: { status: 500 } });
    appRender(<TestComponent />);
    
    await waitFor(() => expect(screen.getByTestId('cards').textContent).toContain('1-SCHEDULED-1'));
    userEvent.click(screen.getByText('Move'));
    
    // UI updates optimistically
    await waitFor(() => expect(screen.getByTestId('cards').textContent).toContain('1-IN_PROGRESS-2'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not move appointment. Try again.', { key: 'move-fail-1' }));
    
    // Rollback to previous state
    expect(screen.getByTestId('cards').textContent).toContain('1-SCHEDULED-1');
  });

  it('429 rate limit path rolls back and shows rate-limit toast', async () => {
    apiMocks.moveAppointment.mockRejectedValue({ response: { status: 429 } });
    appRender(<TestComponent />);
    
    await waitFor(() => expect(screen.getByTestId('cards').textContent).toContain('1-SCHEDULED-1'));
    userEvent.click(screen.getByText('Move'));
    
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Too many moves. Please wait a moment.', { key: 'move-rate-1' }));
    expect(screen.getByTestId('cards').textContent).toContain('1-SCHEDULED-1');
  });

  it('400 invalid-transition path rolls back and shows invalid-transition toast', async () => {
    apiMocks.moveAppointment.mockRejectedValue({ response: { status: 400, data: { errors: [{ detail: 'Not allowed transition' }] } } });
    appRender(<TestComponent />);
    
    await waitFor(() => expect(screen.getByTestId('cards').textContent).toContain('1-SCHEDULED-1'));
    userEvent.click(screen.getByText('Move'));
    
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('That status change is not allowed.', { key: 'move-invalid-1' }));
    expect(screen.getByTestId('cards').textContent).toContain('1-SCHEDULED-1');
  });

  it('should track mock factory metrics and request patterns', async () => {
    apiMocks.moveAppointment.mockResolvedValue({ id: '1', status: 'IN_PROGRESS', position: 2 });
    appRender(<TestComponent />);
    
    await waitFor(() => expect(screen.getByTestId('cards').textContent).toContain('1-SCHEDULED-1'));
    userEvent.click(screen.getByText('Move'));
    
    await waitFor(() => {
      expect(apiMocks.moveAppointment).toHaveBeenCalledTimes(1);
      expect(apiMocks.moveAppointment).toHaveBeenCalledWith('1', { status: 'IN_PROGRESS', position: 2 });
    });
  });
});
