import { useInfiniteQuery } from '@tanstack/react-query';
import { useETagCache } from '@/hooks/useETagCache';
import type { CustomerProfile } from '@/types/customerProfile';

function buildUrl(id: string, opts: { vehicleId?: string; from?: string; to?: string; includeInvoices?: boolean; pageSize?: number; cursor?: string } = {}) {
  const qs = new URLSearchParams();
  if (opts.vehicleId) qs.set('vehicle_id', opts.vehicleId);
  if (opts.from) qs.set('from', opts.from);
  if (opts.to) qs.set('to', opts.to);
  if (opts.includeInvoices) qs.set('include_invoices', 'true');
  if (opts.pageSize) qs.set('limit_appointments', String(opts.pageSize));
  if (opts.cursor) qs.set('cursor', opts.cursor);
  return `/api/admin/customers/${id}/profile${qs.toString() ? `?${qs}` : ''}`;
}

export function useCustomerProfileInfinite(id: string, opts: { vehicleId?: string; from?: string; to?: string; includeInvoices?: boolean; pageSize?: number } = {}) {
  const cacheKey = `customerProfileInfinite-${id}-${JSON.stringify(opts)}`;
  const etagCache = useETagCache<CustomerProfile>(cacheKey);

  return useInfiniteQuery<CustomerProfile, Error>({
    queryKey: ['customerProfileInfinite', id, opts.vehicleId || null, opts.from || null, opts.to || null, !!opts.includeInvoices, opts.pageSize || 25],
    queryFn: async ({ pageParam }) => {
      const url = buildUrl(id, { ...opts, cursor: pageParam as string | undefined });

      // For first page, use ETag caching
      const isFirstPage = !pageParam;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add ETag header for first page requests to enable 304 Not Modified responses
      if (isFirstPage) {
        Object.assign(headers, etagCache.getIfNoneMatchHeader());
      }

      const response = await fetch(url, { headers });

      // Handle 304 Not Modified - return cached data
      if (response.status === 304 && isFirstPage) {
        const cachedData = etagCache.getCachedData();
        if (cachedData) {
          return cachedData;
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as CustomerProfile;

      // Store ETag for first page responses
      if (isFirstPage) {
        const etag = response.headers.get('ETag');
        if (etag) {
          etagCache.storeETagData(etag, data);
        }
      }

      return data;
    },
    getNextPageParam: (lastPage) => lastPage.page?.next_cursor || undefined,
    initialPageParam: undefined,
    placeholderData: (prev) => prev,
    staleTime: 30_000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes garbage collection time
  });
}
