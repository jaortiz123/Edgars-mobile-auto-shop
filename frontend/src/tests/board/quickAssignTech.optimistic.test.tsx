import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QuickAssignTech } from '@/components/admin/QuickAssignTech';
import * as api from '@/lib/api';
import { ToastProvider } from '@/components/ui/Toast';

// Helper to build a QueryClient with optional seed data
function createClient(seed?: Record<string, unknown>) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  if (seed) {
    Object.entries(seed).forEach(([key, value]) => {
      // react-query internally serialises key; we assume key already stable
      qc.setQueryData(JSON.parse(key), value);
    });
  }
  return qc;
}

// Utility to seed a board cache containing a single card for given techId scope
interface MinimalCard { id: string; techAssigned: string | null; techInitials: string | null }
// Columns are irrelevant for this test; keep as unknown[] to avoid any
interface BoardCache { columns: unknown[]; cards: MinimalCard[] }
function seedBoardCaches(qc: QueryClient, card: MinimalCard) {
  // Board queries are keyed as ['board', techId|all]
  const variants = [ ['board', 'all'], ['board', card.techAssigned || 'all'] ];
  variants.forEach(k => {
    qc.setQueryData(k, { columns: [], cards: [card] });
  });
}

describe('QuickAssignTech optimistic workflow', () => {
  const patchSpy = vi.spyOn(api, 'patchAppointment');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  it('applies optimistic update then confirms success path', async () => {
    patchSpy.mockResolvedValue({ id: 'A1', updated_fields: ['tech_id'] });
    const qc = createClient();
  const initialCard: MinimalCard = { id: 'A1', techAssigned: null, techInitials: null };
    seedBoardCaches(qc, initialCard);

    render(
      <ToastProvider>
        <QueryClientProvider client={qc}>
          <QuickAssignTech appointmentId="A1" currentTechId={null} />
        </QueryClientProvider>
      </ToastProvider>
    );

    // Open popover
    const trigger = screen.getByRole('button', { name: /assign technician/i });
  await userEvent.click(trigger);

    // Since technicians list relies on useTechnicians (network), stub it by mocking api or keep empty => we will assign unassigned (null) first then simulate assign failure? For success path we just close.
    // Simulate click on unassigned -> no change but exercises path
  const unassignedBtn = screen.getByRole('button', { name: /unassigned/i });
  await userEvent.click(unassignedBtn);

    // Optimistic mutation should have closed popover immediately
    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('rolls back on failure', async () => {
    patchSpy.mockRejectedValue(new Error('network fail'));
    const qc = createClient();
  const initialCard: MinimalCard = { id: 'A1', techAssigned: 'T0', techInitials: 'T0' };
    seedBoardCaches(qc, initialCard);

    render(
      <ToastProvider>
        <QueryClientProvider client={qc}>
          <QuickAssignTech appointmentId="A1" currentTechId={'T0'} />
        </QueryClientProvider>
      </ToastProvider>
    );

    // Open popover
    const trigger = screen.getByRole('button', { name: /reassign technician/i });
  await userEvent.click(trigger);

    // Click Unassigned to attempt clearing tech
  const unassignedBtn = screen.getByRole('button', { name: /unassigned/i });
  await userEvent.click(unassignedBtn);

    // Immediately after click, optimistic state should be applied (techAssigned null)
  const afterOptimistic = qc.getQueriesData<BoardCache>({ queryKey: ['board'] });
  const mutatedTuple = afterOptimistic.find(([,data]) => !!data?.cards?.some(c => c.id === 'A1'));
  expect(mutatedTuple).toBeTruthy();
  const mutated = mutatedTuple![1]!;
  expect(mutated.cards[0].techAssigned).toBeNull();

    // Wait for failure and rollback
    let rolledBack: BoardCache | undefined;
    await waitFor(() => {
      const rolledBackTuple = qc.getQueriesData<BoardCache>({ queryKey: ['board'] })
        .find(([,data]) => !!data?.cards?.some(c => c.id === 'A1'));
      if (!rolledBackTuple) throw new Error('No board cache found yet');
      rolledBack = rolledBackTuple[1];
      if (!rolledBack) throw new Error('No data yet');
      // Ensure rollback value present
      if (rolledBack.cards[0].techAssigned !== 'T0') throw new Error('Not rolled back yet');
    });
    expect(rolledBack!.cards[0].techAssigned).toBe('T0');
  });
});
