import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useBoardStore } from '@/state/useBoardStore';
import type { BoardCard, BoardColumn } from '@/types/models';

vi.mock('@/lib/api', async () => {
  const actual = (await vi.importActual('@/lib/api')) as Record<string, unknown>;
  return {
    ...actual,
    patchAppointment: vi.fn(async () => { throw new Error('Patch failed'); }),
  };
});

describe('assignTechnician rollback', () => {
  beforeEach(() => {
    useBoardStore.getState().clear();
    const cols: BoardColumn[] = [{ key: 'SCHEDULED', title: 'Scheduled', count: 1, sum: 0 } as BoardColumn];
    const cards: BoardCard[] = [
      { id: 'A1', status: 'SCHEDULED', position: 1, customerName: 'Alpha', vehicle: 'Car', headline: 'Job', techAssigned: 'T0' } as BoardCard,
    ];
    useBoardStore.getState().replaceBoard(cols, cards);
  });

  it('restores previous technician on API failure', async () => {
    const before = useBoardStore.getState().cardsById['A1'];
    expect(before.techAssigned).toBe('T0');
    await expect(useBoardStore.getState().assignTechnician('A1', 'T1')).rejects.toThrow('Patch failed');
    const after = useBoardStore.getState().cardsById['A1'];
    expect(after.techAssigned).toBe('T0');
  });
});
