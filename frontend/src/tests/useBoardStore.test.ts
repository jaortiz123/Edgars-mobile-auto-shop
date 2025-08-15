import { describe, it, expect, beforeEach } from 'vitest';
import { useBoardStore, selectFilteredCards } from '@/state/useBoardStore';
import type { BoardCard, BoardColumn } from '@/types/models';

// Helper to mutate store in tests
function seed(columns: BoardColumn[], cards: BoardCard[]) {
  useBoardStore.getState().replaceBoard(columns, cards);
}

describe('useBoardStore filtering', () => {
  beforeEach(() => {
    useBoardStore.getState().clear();
  });

  it('filters by searchText across headline, customerName, servicesSummary', () => {
    seed(
      [{ key: 'SCHEDULED', title: 'Scheduled', count: 2 } as unknown as BoardColumn],
      [
        { id: '1', status: 'SCHEDULED', position: 1, headline: 'Brake Replacement', customerName: 'Alice', servicesSummary: 'Brakes' } as BoardCard,
        { id: '2', status: 'SCHEDULED', position: 2, headline: 'Oil Change', customerName: 'Bob', servicesSummary: 'Oil' } as BoardCard
      ]
    );
    // baseline
    const all = selectFilteredCards(useBoardStore.getState());
    expect(all.length).toBe(2);

    useBoardStore.getState().setFilters({ searchText: 'brake' });
    const filtered1 = selectFilteredCards(useBoardStore.getState());
    expect(filtered1.map(c => c.id)).toEqual(['1']);

    useBoardStore.getState().setFilters({ searchText: 'bob' });
    const filtered2 = selectFilteredCards(useBoardStore.getState());
    expect(filtered2.map(c => c.id)).toEqual(['2']);

    useBoardStore.getState().setFilters({ searchText: 'oil' });
    const filtered3 = selectFilteredCards(useBoardStore.getState());
    expect(filtered3.map(c => c.id)).toEqual(['2']);
  });

  it('filters by technicianId when present', () => {
    seed(
      [{ key: 'SCHEDULED', title: 'Scheduled', count: 3 } as unknown as BoardColumn],
      [
        { id: '1', status: 'SCHEDULED', position: 1, headline: 'H1', customerName: 'A', technicianId: 't1' } as unknown as BoardCard,
        { id: '2', status: 'SCHEDULED', position: 2, headline: 'H2', customerName: 'B', technicianId: 't2' } as unknown as BoardCard,
        { id: '3', status: 'SCHEDULED', position: 3, headline: 'H3', customerName: 'C' } as unknown as BoardCard
      ]
    );
    useBoardStore.getState().setFilters({ technicianId: 't2' });
    const filtered = selectFilteredCards(useBoardStore.getState());
    expect(filtered.map(c => c.id)).toEqual(['2']);
  });

  it('combines searchText + technicianId', () => {
    seed(
      [{ key: 'SCHEDULED', title: 'Scheduled', count: 2 } as unknown as BoardColumn],
      [
        { id: '1', status: 'SCHEDULED', position: 1, headline: 'Brake Replacement', customerName: 'Alice', technicianId: 't1' } as unknown as BoardCard,
        { id: '2', status: 'SCHEDULED', position: 2, headline: 'Brake Adjust', customerName: 'Bob', technicianId: 't2' } as unknown as BoardCard
      ]
    );
    useBoardStore.getState().setFilters({ searchText: 'brake', technicianId: 't2' });
    const filtered = selectFilteredCards(useBoardStore.getState());
    expect(filtered.map(c => c.id)).toEqual(['2']);
  });

  it('filters by statuses array', () => {
    seed(
      [
        { key: 'SCHEDULED', title: 'Scheduled', count: 3 } as unknown as BoardColumn,
        { key: 'IN_PROGRESS', title: 'In Progress', count: 3 } as unknown as BoardColumn,
        { key: 'COMPLETED', title: 'Completed', count: 3 } as unknown as BoardColumn,
      ],
      [
        { id: '1', status: 'SCHEDULED', position: 1, customerName: 'A', vehicle: 'Car', headline: 'Job 1' } as unknown as BoardCard,
        { id: '2', status: 'IN_PROGRESS', position: 2, customerName: 'B', vehicle: 'Car', headline: 'Job 2' } as unknown as BoardCard,
        { id: '3', status: 'COMPLETED', position: 3, customerName: 'C', vehicle: 'Car', headline: 'Job 3' } as unknown as BoardCard,
      ]
    );
    useBoardStore.getState().setFilters({ statuses: ['SCHEDULED', 'COMPLETED'] });
    const filtered = selectFilteredCards(useBoardStore.getState());
    expect(filtered.map(c => c.id).sort()).toEqual(['1', '3']);
  });

  it('filters by date using appointmentDate field', () => {
    seed(
      [{ key: 'SCHEDULED', title: 'Scheduled', count: 2 } as unknown as BoardColumn],
      [
        { id: '1', status: 'SCHEDULED', position: 1, customerName: 'A', vehicle: 'Car', appointmentDate: '2025-08-15', headline: 'Today Job' } as unknown as BoardCard,
        { id: '2', status: 'SCHEDULED', position: 2, customerName: 'B', vehicle: 'Car', appointmentDate: '2025-08-16', headline: 'Tomorrow Job' } as unknown as BoardCard,
      ]
    );
    useBoardStore.getState().setFilters({ date: '2025-08-15' });
    const filtered = selectFilteredCards(useBoardStore.getState());
    expect(filtered.map(c => c.id)).toEqual(['1']);
  });

  it('filters by date using start fallback when appointmentDate absent', () => {
    seed(
      [{ key: 'SCHEDULED', title: 'Scheduled', count: 2 } as unknown as BoardColumn],
      [
        { id: '1', status: 'SCHEDULED', position: 1, customerName: 'A', vehicle: 'Car', start: '2025-08-15T09:00:00Z', headline: 'Start Today' } as unknown as BoardCard,
        { id: '2', status: 'SCHEDULED', position: 2, customerName: 'B', vehicle: 'Car', start: '2025-08-16T10:00:00Z', headline: 'Start Tomorrow' } as unknown as BoardCard,
      ]
    );
    useBoardStore.getState().setFilters({ date: '2025-08-15' });
    const filtered = selectFilteredCards(useBoardStore.getState());
    expect(filtered.map(c => c.id)).toEqual(['1']);
  });
});
