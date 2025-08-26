import { useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/api';
import type { AxiosResponseHeaders } from 'axios';
import { useConflictManager } from '@/conflict/ConflictProvider';

export interface BasicVehicle {
  id: string | number;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  vin?: string | null;
  license_plate?: string | null;
  _etag?: string;
  etag?: string; // legacy
}

interface VehiclePatch { make?: string | null; model?: string | null; year?: number | null; vin?: string | null; license_plate?: string | null }
interface ApiResponse { data: BasicVehicle }
interface MutationResult { json: ApiResponse; etag?: string; aborted?: boolean }

// Query key chosen; adjust to match whichever component consumes base vehicle info.
function vehicleBasicKey(id: string | number) { return ['vehicleBasic', String(id)] as const; }

function getHeader(headers: AxiosResponseHeaders | Record<string, string> | undefined, key: string): string | undefined {
  if (!headers) return undefined;
  const lower = key.toLowerCase();
  const val = (headers as Record<string, string>)[lower];
  return typeof val === 'string' ? val : undefined;
}

export function useOptimisticVehicleEdit(vehicleId: string) {
  const qc = useQueryClient();
  const key = vehicleBasicKey(vehicleId);
  const { openConflict } = useConflictManager();
  return useMutation({
  mutationFn: async (patch: VehiclePatch): Promise<MutationResult> => {
      const existing = qc.getQueryData<BasicVehicle>(key);
      const etag = existing?._etag || existing?.etag;
      const res = await http.patch(`/admin/vehicles/${vehicleId}`, patch, { headers: { ...(etag ? { 'If-Match': etag } : {}) } });
      if (res.status === 412) {
        const latestRes = await http.get(`/admin/vehicles/${vehicleId}`);
        const latestJson = latestRes.data || null;
        const latestData = latestJson && (latestJson as Record<string, unknown>).data ? (latestJson as Record<string, unknown>).data : latestJson;
        const choice = await openConflict({
          kind: 'vehicle',
          id: vehicleId,
          local: (existing as unknown as Record<string, unknown>) || null,
          remote: (latestData as Record<string, unknown>) || null,
          patch: { ...patch } as Record<string, unknown>,
          fields: [
            { key: 'make', label: 'Make' },
            { key: 'model', label: 'Model' },
            { key: 'year', label: 'Year' },
            { key: 'vin', label: 'VIN' },
            { key: 'license_plate', label: 'Plate' },
          ] as unknown as { key: string; label?: string }[],
        });
        if (choice === 'discard') {
          if (latestData) {
            const etagHdr = getHeader(latestRes.headers as unknown as Record<string, string>, 'ETag');
            qc.setQueryData(key, { ...(existing || {}), ...latestData, _etag: etagHdr || existing?._etag });
          }
          const etagHdr = getHeader(latestRes.headers as unknown as Record<string, string>, 'ETag');
          return { json: { data: { id: vehicleId } as BasicVehicle }, etag: etagHdr, aborted: true };
        }
        if (choice === 'overwrite') {
          const retryRes = await http.patch(`/admin/vehicles/${vehicleId}`, patch);
          const retryJson: ApiResponse = retryRes.data as ApiResponse;
          const retryEtag = getHeader(retryRes.headers as unknown as Record<string, string>, 'ETag');
      return { json: retryJson, etag: retryEtag };
        }
        throw Object.assign(new Error('Conflict unresolved'), { status: 412, handled: true });
      }
      const json: ApiResponse = res.data as ApiResponse;
      const newEtag = getHeader(res.headers as unknown as Record<string, string>, 'ETag');
    return { json, etag: newEtag };
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<BasicVehicle>(key);
      if (prev) {
        const optimistic: BasicVehicle = { ...prev, ...patch };
        qc.setQueryData(key, optimistic);
      }
      return { prev };
    },
    onError: (err, _vars, ctx) => { if ((err as { handled?: boolean })?.handled) return; if (ctx?.prev) qc.setQueryData(key, ctx.prev); },
    onSuccess: (result) => {
      if (result.aborted) return;
      const prev = qc.getQueryData<BasicVehicle>(key) || ({} as BasicVehicle);
      const merged: BasicVehicle = { ...prev, ...result.json.data };
      if (result.etag) merged._etag = result.etag;
      qc.setQueryData(key, merged);
    },
  });
}
