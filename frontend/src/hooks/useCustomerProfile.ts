import { useQuery, QueryKey } from '@tanstack/react-query';
import { http } from '@/lib/api';
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
      const et = etagCache.get(cacheKey);
      const headers = et ? { 'If-None-Match': et } : {};

      try {
        const response = await http.get(url, {
          signal,
          headers,
          timeout: 10000  // 10 second timeout
        });
        const data = response.data as CustomerProfile;
        const newEt = response.headers?.['etag'] || undefined;
        if (newEt) etagCache.set(cacheKey, newEt);
        dataCache.set(cacheKey, data);
        return data;
      } catch (error: any) {
        if (error.response?.status === 304) {
          const cached = dataCache.get(cacheKey);
          if (cached) return cached;
        }
        throw error;
      }
    },
  placeholderData: (prev) => {
      // If we already have cached data for this key, keep it to avoid flicker
      const cacheKey = keyStr(qk);
      return dataCache.get(cacheKey) ?? prev;
    },
    staleTime: 30_000,
  });
}
