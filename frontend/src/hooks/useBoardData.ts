import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type { BoardCard, BoardColumn, DashboardStats, AppointmentStatus } from '@/types/models';
import { resolveHeadline, ServiceDefinition } from '@/types/serviceCatalog';
import { useServiceCatalog } from './useServiceCatalog';
import { useServiceOperations } from './useServiceOperations';
import type { ServiceOperation } from '@/types/models';
import { useBoardServerFilters } from '@/state/boardServerFilters';

// Query Keys
export const qk = {
  board: ['board'] as const,
  stats: ['dashboard-stats'] as const,
};

// Transform cards to enrich headline if catalog data present
function enrichCards(
  cards: BoardCard[],
  catalogById: Record<string, ServiceDefinition>,
  opsById: Record<string, ServiceOperation>
): BoardCard[] {
  return cards.map(c => {
    if (c.headline) return c;
    // If backend provided primaryOperationId, use operation name directly
    if (c.primaryOperationId) {
      const op = opsById[c.primaryOperationId];
      if (op) return { ...c, headline: op.name };
    }
    if (c.primaryOperation) {
      const def = catalogById[c.primaryOperation.serviceId];
      const headline = resolveHeadline(c.primaryOperation, def, c.servicesSummary, (c.additionalOperations||[]).length);
      return { ...c, headline };
    }
    return c;
  });
}

export interface UseBoardResult {
  boardQuery: ReturnType<typeof useQuery<{ columns: BoardColumn[]; cards: BoardCard[] }>>;
  statsQuery: ReturnType<typeof useQuery<DashboardStats>>;
  moveMutation: ReturnType<typeof useMutation<{ id: string; status: AppointmentStatus; position: number }, unknown, { id: string; status: AppointmentStatus; position: number }>>;
  refresh: () => void;
  boardError: Error | null;
  statsError: Error | null;
  isFetchingBoard: boolean;
  isFetchingStats: boolean;
}

export function useBoard(): UseBoardResult {
  const qc = useQueryClient();
  const { byId } = useServiceCatalog();
  const { byId: opsById } = useServiceOperations();
  const { techId: serverTechId } = useBoardServerFilters();

  const boardQuery = useQuery<{ columns: BoardColumn[]; cards: BoardCard[] }>({
    // include server filter discriminator in key so caches are segmented per tech
  queryKey: [...qk.board, serverTechId || 'all'],
    queryFn: () => api.getBoard(serverTechId ? { techId: serverTechId } : {}),
    staleTime: 15_000,
    select: (data) => ({
      columns: data.columns,
      cards: enrichCards(data.cards, byId, opsById),
    }),
  });

  const statsQuery = useQuery<DashboardStats>({
    queryKey: qk.stats,
    queryFn: () => api.getStats({}),
    staleTime: 30_000,
  });

  const moveMutation = useMutation({
    mutationFn: (vars: { id: string; status: AppointmentStatus; position: number }) =>
      api.moveAppointment(vars.id, { status: vars.status, position: vars.position }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: qk.board });
      const prev = qc.getQueryData<{ columns: BoardColumn[]; cards: BoardCard[] }>(qk.board);
      if (prev) {
        const cards = prev.cards.map(c => c.id === vars.id ? { ...c, status: vars.status, position: vars.position } : c);
        qc.setQueryData(qk.board, { columns: prev.columns, cards });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.board, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.board });
      qc.invalidateQueries({ queryKey: qk.stats });
    }
  });

  return {
    boardQuery,
    statsQuery,
    moveMutation,
    refresh: () => {
      qc.invalidateQueries({ queryKey: qk.board });
      qc.invalidateQueries({ queryKey: qk.stats });
  },
  boardError: boardQuery.error as Error | null,
  statsError: statsQuery.error as Error | null,
  isFetchingBoard: boardQuery.isFetching,
  isFetchingStats: statsQuery.isFetching
  };
}
