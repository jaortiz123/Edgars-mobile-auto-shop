import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuickAssignTech from '@/components/admin/QuickAssignTech';
import { ToastProvider } from '@/components/ui/Toast';
import * as api from '@/lib/api';
import { useBoardStore } from '@/state/useBoardStore';

vi.mock('@/hooks/useTechnicians', () => ({
  useTechnicians: () => ({ data: [{ id: 'T0', name: 'Tech Zero', initials: 'T0' }], isLoading: false })
}));

describe('QuickAssignTech optimistic workflow (zustand store)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let patchSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store
    useBoardStore.setState({ columns: [], cardsById: {}, cardIds: [], lastFetchedAt: null });
  });

  it('applies optimistic update then confirms success path', async () => {
    const spy = vi.spyOn(api, 'patchAppointment').mockResolvedValue({ id: 'A1', updated_fields: ['tech_id'] } as unknown as { id: string; updated_fields?: string[] });
    patchSpy = spy;
    // seed card
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useBoardStore.getState().replaceBoard([], [{ id: 'A1', techAssigned: null, status: 'SCHEDULED', position: 0 } as any]);

    render(<ToastProvider><QuickAssignTech appointmentId="A1" currentTechId={null} /></ToastProvider>);
    const trigger = screen.getByRole('button', { name: /assign technician/i });
    await userEvent.click(trigger);
    const unassignedBtn = screen.getByRole('button', { name: /unassigned/i });
    await userEvent.click(unassignedBtn);
    await waitFor(() => expect(patchSpy).toHaveBeenCalledTimes(1));
  });

  it('rolls back on failure', async () => {

    // Introduce a slight async delay before rejecting so we can observe the optimistic state
    const spy = vi.spyOn(api, 'patchAppointment').mockImplementation(() => new Promise((_, reject) => {
      setTimeout(() => reject(new Error('network fail')), 15);
    }) as unknown as ReturnType<typeof api.patchAppointment>);
    patchSpy = spy as unknown as typeof patchSpy;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useBoardStore.getState().replaceBoard([], [{ id: 'A1', techAssigned: 'T0', status: 'SCHEDULED', position: 0 } as any]);

    render(<ToastProvider><QuickAssignTech appointmentId="A1" currentTechId={'T0'} /></ToastProvider>);
    const trigger = screen.getByRole('button', { name: /reassign technician/i });
    await userEvent.click(trigger);
    const unassignedBtn = screen.getByRole('button', { name: /unassigned/i });
    await userEvent.click(unassignedBtn);

    // optimistic clear
    await waitFor(() => {
      const card = useBoardStore.getState().cardsById['A1'];
      if (!card) throw new Error('card missing');
      if (card.techAssigned !== null) throw new Error('not cleared');
    });

    // rollback
    await waitFor(() => {
      const card = useBoardStore.getState().cardsById['A1'];
      if (!card) throw new Error('card missing');
      if (card.techAssigned !== 'T0') throw new Error('not rolled back');
    });
  });
});
