import { useInfiniteQuery, QueryKey, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

export interface VehicleProfilePageMeta {
  next_cursor?: string | null;
}

export interface VehicleProfileStats {
  lifetime_spend: number | null;
  total_visits: number | null;
  last_service_at: string | null;
  avg_ticket: number | null;
}

export interface VehicleProfileHeader {
  vehicle_id: string;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  plate?: string | null;
  vin?: string | null;
  customer_id?: string | null;
}

export interface VehicleProfileTimelineRowService { name: string }
export interface VehicleProfileTimelineRowInvoice { total: number; paid: number; unpaid: number }
export interface VehicleProfileTimelineRow {
  id: string;
  type: string; // 'appointment' for now, future-proof
  occurred_at: string | null;
  status?: string | null;
  services: VehicleProfileTimelineRowService[];
  invoice?: VehicleProfileTimelineRowInvoice | null;
}

export interface VehicleProfileResponse {
  header: VehicleProfileHeader | null;
  stats: VehicleProfileStats | null;
  timeline: VehicleProfileTimelineRow[];
  page: VehicleProfilePageMeta;
  etag?: string | null;
}

export interface UseVehicleProfileOptions {
  pageSize?: number; // default 10
  cursor?: string;
  includeInvoices?: boolean;
  enabled?: boolean;
  filters?: { status?: string }; // future quick filters
}

function buildVehicleProfileUrl(vehicleId: string, opts: { cursor?: string; pageSize?: number; includeInvoices?: boolean; filters?: { status?: string } } = {}) {
  const qs = new URLSearchParams();
  if (opts.cursor) qs.set('cursor', opts.cursor);
  if (opts.pageSize) qs.set('page_size', String(opts.pageSize));
  if (opts.includeInvoices) qs.set('include_invoices', 'true');
  if (opts.filters?.status && opts.filters.status !== 'ALL') qs.set('status', opts.filters.status);
  return `/api/admin/vehicles/${vehicleId}/profile${qs.size ? `?${qs}` : ''}`;
}

interface FetchResult { json: VehicleProfileResponse; etag: string | null }

async function fetchVehicleProfile(vehicleId: string, opts: { cursor?: string; pageSize?: number; includeInvoices?: boolean; filters?: { status?: string }; etag?: string | null; existingFirst?: VehicleProfileResponse | undefined }) : Promise<FetchResult> {
  const url = buildVehicleProfileUrl(vehicleId, opts);
  const headers: Record<string,string> = {};
  if (opts.etag) headers['If-None-Match'] = opts.etag;
  const res = await fetch(url, { headers });
  if (res.status === 304) {
    // Not modified: reuse existing first-page data so UI doesn't flicker/clear
    if (opts.existingFirst) {
      return { json: opts.existingFirst, etag: opts.etag || null };
    }
    // Fallback (shouldn't normally happen): empty timeline shell
    return { json: { header: null, stats: null, timeline: [], page: { next_cursor: opts.cursor }, etag: opts.etag || null }, etag: opts.etag || null };
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const etag = res.headers.get('ETag');
  const json = await res.json() as VehicleProfileResponse;
  return { json: { ...json, etag }, etag };
}

export function useVehicleProfileInfinite(vehicleId: string, opts: UseVehicleProfileOptions = {}) {
  const pageSize = opts.pageSize ?? 10;
  const etagRef = useRef<string | null>(null);
  const client = useQueryClient();
  return useInfiniteQuery<VehicleProfileResponse, Error>({
    queryKey: vehicleProfileQueryKey(vehicleId, opts),
    enabled: !!vehicleId && (opts.enabled ?? true),
    queryFn: async ({ pageParam }) => {
      const existing = client.getQueryData<{ pages?: VehicleProfileResponse[] }>(vehicleProfileQueryKey(vehicleId, opts));
      const firstExisting = existing?.pages?.[0];
      // Only send If-None-Match for the FIRST page; subsequent pages should always fetch fresh page slices.
      const conditionalEtag = pageParam ? null : etagRef.current;
      const { json, etag } = await fetchVehicleProfile(vehicleId, { cursor: pageParam as string | undefined, pageSize, includeInvoices: opts.includeInvoices, filters: opts.filters, etag: conditionalEtag, existingFirst: firstExisting });
      if (etag) etagRef.current = etag; // capture for subsequent conditional requests
      return json;
    },
    getNextPageParam: (last) => last.page?.next_cursor || undefined,
    staleTime: 30_000,
    initialPageParam: undefined,
    placeholderData: (prev) => prev,
  });
}

export function vehicleProfileQueryKey(vehicleId: string, opts: UseVehicleProfileOptions): QueryKey {
  return ['vehicleProfile', vehicleId, opts.pageSize ?? 10, !!opts.includeInvoices, opts.filters?.status || 'ALL'];
}
