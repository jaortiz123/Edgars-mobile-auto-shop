import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useBoardStore } from '@/state/useBoardStore';
import type { BoardCard, BoardColumn } from '@/types/models';

vi.mock('@/lib/api', async () => {
  const actual = (await vi.importActual('@/lib/api')) as Record<string, unknown>;
  return {
    ...actual,
    moveAppointment: vi.fn(async () => { throw new Error('Server fail'); }),
  };
});

describe('useBoardStore moveAppointment rollback', () => {
  beforeEach(() => {
    useBoardStore.getState().clear();
    useBoardStore.getState().replaceBoard(
      [{ key: 'SCHEDULED', title: 'Scheduled', count: 1, sum: 0 } as unknown as BoardColumn],
      [{ id: '1', status: 'SCHEDULED', position: 1, customerName: 'A', vehicle: 'Car', headline: 'Job' } as unknown as BoardCard]
    );
  });

  it('rolls back state on API failure', async () => {
    const original = useBoardStore.getState().cardsById['1'];
    expect(original.status).toBe('SCHEDULED');
    await expect(useBoardStore.getState().moveAppointment('1', { status: 'IN_PROGRESS', position: 1 }))
      .rejects.toThrow('Server fail');
    const after = useBoardStore.getState().cardsById['1'];
    expect(after.status).toBe('SCHEDULED');
  });
});
