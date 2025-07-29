import React from 'react';
import { describe, it, beforeEach, vi, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import appRender from './render';
import * as api from '@/lib/api';
import { toast } from '@/lib/toast';
import { useAppointments } from '@/contexts/AppointmentContext';
import type { BoardColumn, BoardCard, DashboardStats, AppointmentStatus } from '@/types/models';

// Mock API and toast
vi.mock('@/lib/api');
vi.mock('@/lib/toast');

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

describe('AppointmentContext.optimisticMove', () => {
  beforeEach(() => {
    // Reset mocks
    vi.mocked(api.getBoard).mockResolvedValue({ columns: initialColumns, cards: initialCards });
    vi.mocked(api.getStats).mockResolvedValue(dummyStats);
    vi.mocked(api.moveAppointment).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('success path', async () => {
    vi.mocked(api.moveAppointment).mockResolvedValue({ id: '1', status: 'IN_PROGRESS', position: 2 });
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
    vi.mocked(api.moveAppointment).mockRejectedValue({ response: { status: 500 } });
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
    vi.mocked(api.moveAppointment).mockRejectedValue({ response: { status: 429 } });
    appRender(<TestComponent />);
    await waitFor(() => expect(screen.getByTestId('cards').textContent).toContain('1-SCHEDULED-1'));
    userEvent.click(screen.getByText('Move'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Too many moves. Please wait a moment.', { key: 'move-rate-1' }));
    expect(screen.getByTestId('cards').textContent).toContain('1-SCHEDULED-1');
  });

  it('400 invalid-transition path rolls back and shows invalid-transition toast', async () => {
    vi.mocked(api.moveAppointment).mockRejectedValue({ response: { status: 400, data: { errors: [{ detail: 'Not allowed transition' }] } } });
    appRender(<TestComponent />);
    await waitFor(() => expect(screen.getByTestId('cards').textContent).toContain('1-SCHEDULED-1'));
    userEvent.click(screen.getByText('Move'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('That status change is not allowed.', { key: 'move-invalid-1' }));
    expect(screen.getByTestId('cards').textContent).toContain('1-SCHEDULED-1');
  });
});
