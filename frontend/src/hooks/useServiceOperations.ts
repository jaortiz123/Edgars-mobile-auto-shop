import { useQuery } from '@tanstack/react-query';
import { getServiceOperations } from '@/lib/api';
import type { ServiceOperation } from '@/types/models';
import { useRef } from 'react';

// Simple versioning so we can invalidate cache structure later if schema changes
const CACHE_KEY = 'service_operations_cache_v1';
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24h (adjust later if needed)

interface CacheShape {
  updatedAt: number;
  ops: ServiceOperation[];
}

function readCache(): CacheShape | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheShape;
    if (!parsed || !Array.isArray(parsed.ops)) return null;
    if (Date.now() - (parsed.updatedAt || 0) > MAX_CACHE_AGE_MS) return null; // stale
    return parsed;
  } catch { return null; }
}

function writeCache(ops: ServiceOperation[]) {
  if (typeof window === 'undefined') return;
  try {
    const payload: CacheShape = { updatedAt: Date.now(), ops };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch { /* ignore quota / privacy errors */ }
}

export function useServiceOperations() {
  // Read cache once (avoid re-reading every render)
  const cacheRef = useRef<CacheShape | null>(readCache());

  const query = useQuery<ServiceOperation[]>({
    queryKey: ['service-operations'],
    queryFn: async () => {
      const fresh = await getServiceOperations();
      // Persist fresh list if different length or ids changed
      try {
        const cached = cacheRef.current?.ops || [];
        if (
          cached.length !== fresh.length ||
          cached.some((c, i) => c.id !== fresh[i]?.id || c.name !== fresh[i]?.name)
        ) {
          writeCache(fresh);
          cacheRef.current = { updatedAt: Date.now(), ops: fresh };
        }
      } catch { /* ignore */ }
      return fresh;
    },
    // Provide cached data immediately if present
    initialData: cacheRef.current?.ops,
    // Always allow background refresh; we still treat data as relatively static
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const byId: Record<string, ServiceOperation> = {};
  const data = query.data || cacheRef.current?.ops || [];
  for (const op of data) byId[op.id] = op;

  return { ...query, data, byId, isFromCache: !!cacheRef.current && !query.isFetched };
}
