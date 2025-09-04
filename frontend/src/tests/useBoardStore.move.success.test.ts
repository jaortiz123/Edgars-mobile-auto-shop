import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useBoardStore } from '@/state/useBoardStore';
import type { BoardCard, BoardColumn } from '@/types/models';

vi.mock('@/lib/api', async () => {
  const actual = (await vi.importActual('@/lib/api')) as Record<string, unknown>;
  return {
    ...actual,
    moveAppointment: vi.fn(async () => ({ ok: true })),
  };
});

describe('useBoardStore moveAppointment success', () => {
  beforeEach(() => {
    useBoardStore.getState().clear();
    useBoardStore.getState().replaceBoard(
      [
        { key: 'SCHEDULED', title: 'Scheduled', count: 1, sum: 0 } as unknown as BoardColumn,
        { key: 'IN_PROGRESS', title: 'In Progress', count: 0, sum: 0 } as unknown as BoardColumn,
      ],
      [
        { id: '1', status: 'SCHEDULED', position: 0, customerName: 'A', vehicle: 'Car', headline: 'Job' } as unknown as BoardCard,
      ]
    );
  });

  it('updates status & position and keeps new values after successful API call', async () => {
    const api = await import('@/lib/api');
    const before = useBoardStore.getState().cardsById['1'];
    expect(before.status).toBe('SCHEDULED');
    await useBoardStore.getState().moveAppointment('1', { status: 'IN_PROGRESS', position: 3 });
    const after = useBoardStore.getState().cardsById['1'];
    expect(after.status).toBe('IN_PROGRESS');
    expect(after.position).toBe(3);
    expect(api.moveAppointment).toHaveBeenCalledWith('1', { status: 'IN_PROGRESS', position: 3 });
  });
});
