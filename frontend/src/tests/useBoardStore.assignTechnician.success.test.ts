import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useBoardStore } from '@/state/useBoardStore';
import type { BoardCard, BoardColumn } from '@/types/models';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/api');
  return {
    ...actual,
    patchAppointment: vi.fn(async () => ({ ok: true })),
  };
});

describe('useBoardStore assignTechnician success', () => {
  beforeEach(() => {
    useBoardStore.getState().clear();
    const cols: BoardColumn[] = [
      { key: 'SCHEDULED', title: 'Scheduled', count: 1, sum: 0 } as BoardColumn,
    ];
    const cards: BoardCard[] = [
      { id: 'A1', status: 'SCHEDULED', position: 0, customerName: 'Alpha', vehicle: 'Car', headline: 'Job', techAssigned: null } as BoardCard,
    ];
    useBoardStore.getState().replaceBoard(cols, cards);
  });

  it('updates technician locally and persists after successful API call', async () => {
    const api = await import('@/lib/api');
    const before = useBoardStore.getState().cardsById['A1'];
    expect(before.techAssigned).toBe(null);
    await useBoardStore.getState().assignTechnician('A1', 'T9');
    const after = useBoardStore.getState().cardsById['A1'];
    expect(after.techAssigned).toBe('T9');
    expect((after as unknown as { technicianId?: string }).technicianId).toBe('T9');
    expect(api.patchAppointment).toHaveBeenCalledWith('A1', { tech_id: 'T9' });
  });
});
