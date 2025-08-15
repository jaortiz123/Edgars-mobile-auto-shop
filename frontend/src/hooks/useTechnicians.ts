import { useQuery } from '@tanstack/react-query';
import { getTechnicians } from '@/lib/api';
import type { Technician } from '@/types/models';

// Basic cache – technicians list is tiny & rarely changes
export function useTechnicians() {
  const query = useQuery<Technician[]>({
    queryKey: ['technicians'],
    queryFn: () => getTechnicians(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const byId: Record<string, Technician> = {};
  (query.data || []).forEach(t => { byId[t.id] = t; });

  return { ...query, byId };
}
