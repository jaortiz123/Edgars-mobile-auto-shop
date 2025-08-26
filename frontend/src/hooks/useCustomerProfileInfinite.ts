import { useInfiniteQuery } from '@tanstack/react-query';
import { http } from '@/lib/api';
import type { CustomerProfile } from '@/types/customerProfile';

function buildUrl(id: string, opts: { vehicleId?: string; from?: string; to?: string; includeInvoices?: boolean; pageSize?: number; cursor?: string } = {}) {
  const qs = new URLSearchParams();
  if (opts.vehicleId) qs.set('vehicle_id', opts.vehicleId);
  if (opts.from) qs.set('from', opts.from);
  if (opts.to) qs.set('to', opts.to);
  if (opts.includeInvoices) qs.set('include_invoices', 'true');
  if (opts.pageSize) qs.set('limit_appointments', String(opts.pageSize));
  if (opts.cursor) qs.set('cursor', opts.cursor);
  return `/admin/customers/${id}/profile${qs.toString() ? `?${qs}` : ''}`;
}

export function useCustomerProfileInfinite(id: string, opts: { vehicleId?: string; from?: string; to?: string; includeInvoices?: boolean; pageSize?: number } = {}) {
  return useInfiniteQuery<CustomerProfile, Error>({
    queryKey: ['customerProfileInfinite', id, opts.vehicleId || null, opts.from || null, opts.to || null, !!opts.includeInvoices, opts.pageSize || 25],
    queryFn: async ({ pageParam }) => {
      const url = buildUrl(id, { ...opts, cursor: pageParam as string | undefined });
  const r = await http.get(url);
  if (r.status < 200 || r.status >= 300) throw new Error(`HTTP ${r.status}`);
  return r.data as CustomerProfile;
    },
    getNextPageParam: (lastPage) => lastPage.page?.next_cursor || undefined,
    initialPageParam: undefined,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });
}
