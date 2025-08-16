import { describe, it, expect, vi } from 'vitest';
// Mock server-driven board filters so unit tests start with a truly neutral state
// (avoids implicit tech filter injection via peekBoardServerFilters)
vi.mock('@/state/boardServerFilters', () => ({
  setBoardTechFilter: () => {},
  peekBoardServerFilters: () => ({ techId: undefined })
}));
import type { BoardCard } from '../../../types/models';
import { BoardFilterProvider, useBoardFilters } from '../../../contexts/BoardFilterContext';
import React from 'react';
import { renderHook, act } from '@testing-library/react';

function Wrapper({ children }: { children: React.ReactNode }) {
  // Ensure clean state for each hook render (no persisted filters)
  try { localStorage.removeItem('adm.board.filters.v1'); } catch { /* ignore */ }
  return <BoardFilterProvider>{children}</BoardFilterProvider>;
}

const baseCards = (overrides: Partial<BoardCard>[] = []): BoardCard[] => {
  const seed: BoardCard[] = [
    { id: 'a', customerName: 'Alice Smith', servicesSummary: 'Brake Service', status: 'SCHEDULED', position: 1, techAssigned: 't1' } as unknown as BoardCard,
    { id: 'b', customerName: 'Bob Jones', servicesSummary: 'Oil Change', status: 'IN_PROGRESS', position: 2, techAssigned: 't2' } as unknown as BoardCard,
    { id: 'c', customerName: 'Charlie', servicesSummary: 'Tire Rotation', status: 'COMPLETED', position: 3, techAssigned: 't1' } as unknown as BoardCard,
  ];
  overrides.forEach((o, i) => { if (seed[i]) Object.assign(seed[i], o); });
  return seed;
};

describe('Board filter logic', () => {
  it('filters by status list', () => {
    const { result } = renderHook(() => useBoardFilters(), { wrapper: Wrapper });
    const cards = baseCards();
    act(() => { result.current.setFilters({ statuses: ['IN_PROGRESS'] }); });
    const filtered = result.current.applyFilters(cards);
    expect(filtered.map(c => c.id)).toEqual(['b']);
  });

  it('filters by technician single-select', () => {
    const { result } = renderHook(() => useBoardFilters(), { wrapper: Wrapper });
    const cards = baseCards();
    act(() => { result.current.setFilters({ techs: ['t1'] }); });
    const filtered = result.current.applyFilters(cards);
    expect(filtered.map(c => c.id).sort()).toEqual(['a','c']);
  });

  it('filters by search tokens (AND match)', () => {
    const { result } = renderHook(() => useBoardFilters(), { wrapper: Wrapper });
    const cards = baseCards();
    act(() => { result.current.setFilters({ search: 'Alice Brake' }); });
    const filtered = result.current.applyFilters(cards);
    expect(filtered.map(c => c.id)).toEqual(['a']);
  });

  it('combines filters (status + tech + search)', () => {
    const { result } = renderHook(() => useBoardFilters(), { wrapper: Wrapper });
    const cards = baseCards();
    act(() => { result.current.setFilters({ statuses: ['COMPLETED'], techs: ['t1'], search: 'Charlie Tire' }); });
    const filtered = result.current.applyFilters(cards);
    expect(filtered.map(c => c.id)).toEqual(['c']);
  });

  it('returns all when no filters active', () => {
    const { result } = renderHook(() => useBoardFilters(), { wrapper: Wrapper });
    const cards = baseCards();
    const filtered = result.current.applyFilters(cards);
    expect(filtered.length).toBe(cards.length);
  });
});
