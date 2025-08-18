import { useQuery, QueryKey } from '@tanstack/react-query';
import type { CustomerProfile } from '@/types/customerProfile';

const etagCache = new Map<string, string>();
const dataCache = new Map<string, CustomerProfile>();

function keyStr(key: QueryKey) { return JSON.stringify(key); }

function buildUrl(id: string, opts: { vehicleId?: string; from?: string; to?: string; includeInvoices?: boolean; limitAppointments?: number } = {}) {
  const qs = new URLSearchParams();
  if (opts.vehicleId) qs.set('vehicle_id', opts.vehicleId);
  if (opts.from) qs.set('from', opts.from);
  if (opts.to) qs.set('to', opts.to);
  if (opts.includeInvoices) qs.set('include_invoices', 'true');
  if (opts.limitAppointments) qs.set('limit_appointments', String(opts.limitAppointments));
  return `/api/admin/customers/${id}/profile${qs.toString() ? `?${qs}` : ''}`;
}

export function useCustomerProfile(id: string, opts: { vehicleId?: string; from?: string; to?: string; includeInvoices?: boolean; limitAppointments?: number } = {}) {
  const qk: QueryKey = ['customerProfile', id, opts.vehicleId || null, opts.from || null, opts.to || null, !!opts.includeInvoices, opts.limitAppointments || null];

  return useQuery<CustomerProfile>({
    queryKey: qk,
    queryFn: async ({ signal, queryKey }) => {
      const cacheKey = keyStr(queryKey);
      const url = buildUrl(id, opts);
      // DEBUG: trace execution in tests
  // (debug logging removed)
      const et = etagCache.get(cacheKey);
      const r = await fetch(url, { signal, headers: et ? { 'If-None-Match': et } : {} });
  // (debug logging removed)
      if (r.status === 304) {
        const cached = dataCache.get(cacheKey);
        if (cached) return cached;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const raw = await r.json();
  const data: CustomerProfile = (raw && raw.data) ? raw.data : raw; // accept either envelope or direct object
      const newEt = r.headers.get('ETag') || undefined;
      if (newEt) etagCache.set(cacheKey, newEt);
      dataCache.set(cacheKey, data);
      return data;
    },
  placeholderData: (prev) => prev, // maintain previous while refetching
  staleTime: 30_000,
  });
}
