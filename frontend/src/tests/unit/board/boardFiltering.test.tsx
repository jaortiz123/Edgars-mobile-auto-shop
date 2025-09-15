import { describe, it, expect, beforeEach } from 'vitest';
import type { BoardCard } from '@/types/models';
import { BoardFilterProvider, useBoardFilters } from '@/contexts/BoardFilterContext';
import { setBoardTechFilter } from '@/state/boardServerFilters';
import React from 'react';
import { renderHook, act } from '@test-utils';

function wrapper({ children }: { children: React.ReactNode }) {
  return <BoardFilterProvider>{children}</BoardFilterProvider>;
}

const baseCards = (overrides: Partial<BoardCard>[] = []): BoardCard[] => {
  const seed: BoardCard[] = [
    { id: 'a', customerName: 'Alice Smith', servicesSummary: 'Brake Service', status: 'SCHEDULED', position: 1, techAssigned: 't1' },
    { id: 'b', customerName: 'Bob Jones', servicesSummary: 'Oil Change', status: 'IN_PROGRESS', position: 2, techAssigned: 't2' },
    { id: 'c', customerName: 'Charlie', servicesSummary: 'Tire Rotation', status: 'COMPLETED', position: 3, techAssigned: 't1' },
  ] as unknown as BoardCard[];
  overrides.forEach((o, i) => { Object.assign(seed[i], o); });
  return seed;
};

describe('Board filter logic', () => {
  // Ensure no persisted filters (tech selection, etc.) interfere with baseline expectations
  beforeEach(() => {
    try { localStorage.removeItem('adm.board.filters.v1'); } catch { /* ignore */ }
    // Also reset global server filter snapshot so provider doesn't hydrate a stale tech filter
    setBoardTechFilter(undefined);
  });
  it('filters by status list', () => {
    const { result } = renderHook(() => useBoardFilters(), { wrapper });
    const cards = baseCards();
    act(() => { result.current.setFilters({ statuses: ['IN_PROGRESS'] }); });
    const filtered = result.current.applyFilters(cards);
    expect(filtered.map(c => c.id)).toEqual(['b']);
  });

  it('filters by technician single-select', () => {
    const { result } = renderHook(() => useBoardFilters(), { wrapper });
    const cards = baseCards();
    act(() => { result.current.setFilters({ techs: ['t1'] }); });
    const filtered = result.current.applyFilters(cards);
    expect(filtered.map(c => c.id).sort()).toEqual(['a','c']);
  });

  it('filters by search tokens (AND match)', () => {
    const { result } = renderHook(() => useBoardFilters(), { wrapper });
    const cards = baseCards();
    act(() => { result.current.setFilters({ search: 'Alice Brake' }); });
    const filtered = result.current.applyFilters(cards);
    expect(filtered.map(c => c.id)).toEqual(['a']);
  });

  it('combines filters (status + tech + search)', () => {
    const { result } = renderHook(() => useBoardFilters(), { wrapper });
    const cards = baseCards();
    act(() => { result.current.setFilters({ statuses: ['COMPLETED'], techs: ['t1'], search: 'Charlie Tire' }); });
    const filtered = result.current.applyFilters(cards);
    expect(filtered.map(c => c.id)).toEqual(['c']);
  });

  it('returns all when no filters active (no implicit tech filter)', () => {
    const { result } = renderHook(() => useBoardFilters(), { wrapper });
    const cards = baseCards();
    const filtered = result.current.applyFilters(cards);
    expect(filtered.length).toBe(cards.length);
  });
});
